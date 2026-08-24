import { test, expect } from '@playwright/test'
import { loginAs, botEmail, PASSWORD, serviceClient, userIdByEmail, shot } from './_helpers'

// D29 1번 — 오픈에서 성사된 협업(campaign_id 없음)에도 딜시트가 있어야 한다.
//   [ ] 광고주가 /advertiser/deals/{proposalId} 로 표를 연다 (9단계)
//   [ ] 단계를 넘기면 DB proposals.stage 가 실제로 바뀐다 (D23 — 화면 말고 DB)
//   [ ] 인플루언서도 같은 표를 보되 정산·복사·행선택은 없다
//       (D29 PROMPT-4 로 단계·세무자료는 인플루언서에게도 열렸다 — 25번 스펙에서 본다)
//   [ ] 들어가는 길: 인플 schedule/[id] 의 「딜시트 열기 →」, 광고주 대화 헤더의 「딜시트」

const advEmail = botEmail('adv')
const infEmail = botEmail('inf-pc')

test.describe.configure({ mode: 'serial' })

// 확정된(양쪽 confirmed) 오픈 협업 한 건을 집는다 — 단계 → 버튼이 뜨는 건.
async function pickOpenDeal() {
  const sb = serviceClient()
  const advId = await userIdByEmail(advEmail)
  const { data } = await sb
    .from('proposals')
    .select('id, schedule_id, stage')
    .is('campaign_id', null)
    .eq('advertiser_id', advId)
    .eq('advertiser_confirmed', true)
    .eq('influencer_confirmed', true)
    .order('created_at', { ascending: true })
    .limit(1)
  if (!data?.length) throw new Error('확정된 오픈 협업이 없어요 — full-collab 을 먼저 돌려주세요')
  return data[0]
}

async function stageOf(id: string) {
  const sb = serviceClient()
  const { data } = await sb.from('proposals').select('stage').eq('id', id).maybeSingle()
  return data?.stage ?? null
}

// 단계마다 넘기는 사람이 달라졌다(D29 PROMPT-4). 어느 쪽을 보는 시험인지에 따라
// 시작 단계를 맞춰두고, 끝나면 원래 값으로 되돌린다.
async function setStage(id: string, stage: string) {
  const sb = serviceClient()
  await sb.from('proposals').update({ stage }).eq('id', id)
}

test('D29-3 · 광고주: 오픈 협업 딜시트가 열리고, 단계 이동이 DB에 남는다', async ({ browser }) => {
  const deal = await pickOpenDeal()
  const original = await stageOf(deal.id)
  await setStage(deal.id, '수락') // 광고주 차례인 단계에서 시작
  console.log('[D29] 오픈 협업:', deal.id, '원래 단계:', original, '→ 시험 시작 단계: 수락')

  const { ctx, page } = await loginAs(browser, advEmail, PASSWORD, '**/advertiser/**')
  try {
    await page.goto(`/advertiser/deals/${deal.id}`)
    await page.waitForTimeout(1500)
    await shot(page, 'd29-adv-open-dealsheet')

    // 표가 떴는가 — 기본 9단계(협의·수락·가이드·방문·원고·수정/컨펌·게재·게재뒤수정·정산)
    await expect(page.getByText('인플루언서', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('/9').first(), '오픈 협업은 기본 9단계로 연다').toBeVisible()
    // 오픈엔 복사할 캠페인 원본이 없다
    await expect(page.getByText('복사 재등록')).toHaveCount(0)

    // 단계 → 를 누르면 DB 가 바뀌어야 한다. RLS 가 막으면 화면만 넘어간다(D23).
    const arrow = page.getByRole('button', { name: '→', exact: true }).first()
    await expect(arrow, '광고주 차례(수락)라 단계 이동 버튼이 있어야 한다').toBeVisible()
    await arrow.click()
    await page.waitForTimeout(1500)
    const after = await stageOf(deal.id)
    console.log('[D29] 단계(후):', after)
    expect(after, '화면만 넘어가고 DB 가 그대로면 실패다').toBe('가이드')
    await shot(page, 'd29-adv-stage-advanced')
  } finally {
    if (original) await setStage(deal.id, original)
    await ctx.close()
  }
})

test('D29-4 · 인플루언서: 같은 표를 보되 정산·복사·행선택은 없다', async ({ browser }) => {
  const deal = await pickOpenDeal()
  const original = await stageOf(deal.id)
  await setStage(deal.id, '수락') // 광고주 차례 — 인플루언서에겐 버튼이 없어야 한다

  const { ctx, page } = await loginAs(browser, infEmail, PASSWORD, '**/influencer/**')
  try {
    await page.goto(`/influencer/deals/${deal.id}`)
    await page.waitForTimeout(1500)
    await shot(page, 'd29-inf-open-dealsheet')

    await expect(page.getByText('/9').first(), '인플루언서도 단계를 본다').toBeVisible()
    await expect(page.locator('select'), '정산 상태는 광고주가 정한다').toHaveCount(0)
    await expect(page.locator('input[type="checkbox"]'), '정산 선택은 광고주 몫').toHaveCount(0)
    await expect(page.getByText('복사 재등록')).toHaveCount(0)
    await expect(page.getByText('결제일 변경 제안')).toHaveCount(0)
    // 광고주 차례라 버튼 대신 기다린다는 말이 보여야 한다 (버튼만 없으면 멈춘 것처럼 보인다)
    await expect(page.getByRole('button', { name: '→', exact: true })).toHaveCount(0)
    await expect(
      page.getByText('광고주가 확인하면 넘어가요').first(),
      '내 차례가 아닐 때 무엇을 기다리는지 보여야 한다',
    ).toBeVisible()
    // 신고는 양쪽 다 할 수 있다
    await expect(page.getByRole('button', { name: '운영팀에 알리기' }).first()).toBeVisible()

    // 들어가는 길 — 그날 일정에서 「딜시트 열기 →」
    await page.goto(`/influencer/schedule/${deal.schedule_id}`)
    await page.waitForTimeout(1200)
    const open = page.getByRole('link', { name: '딜시트 열기 →' }).first()
    if (await open.isVisible().catch(() => false)) {
      await open.click()
      await page.waitForTimeout(1200)
      expect(page.url(), '딜시트 열기는 대화가 아니라 딜시트로 가야 한다').toContain('/influencer/deals/')
      await shot(page, 'd29-inf-link-from-schedule')
    } else {
      console.log('[D29] 이 일정엔 시간이 잡힌 건이 없어 「딜시트 열기」가 없음 — 링크 확인 생략')
    }
  } finally {
    if (original) await setStage(deal.id, original)
    await ctx.close()
  }
})

test('D29-5 · 광고주 대화 헤더에 딜시트 입구가 있다', async ({ browser }) => {
  const sb = serviceClient()
  const advId = await userIdByEmail(advEmail)
  const { data: convs } = await sb
    .from('conversations')
    .select('id')
    .eq('advertiser_id', advId)
    .eq('kind', 'personal')
    .limit(1)
  if (!convs?.length) { console.log('[D29] 개인 대화가 없어 생략'); return }

  const { ctx, page } = await loginAs(browser, advEmail, PASSWORD, '**/advertiser/**')
  await page.goto(`/advertiser/messages/${convs[0].id}`)
  await page.waitForTimeout(2000)
  await shot(page, 'd29-adv-message-header')
  const link = page.getByRole('link', { name: '딜시트', exact: true }).first()
  await expect(link).toBeVisible()
  await link.click()
  await page.waitForTimeout(1500)
  expect(page.url()).toContain('/advertiser/deals/')
  await shot(page, 'd29-adv-dealsheet-from-message')
  await ctx.close()
})
