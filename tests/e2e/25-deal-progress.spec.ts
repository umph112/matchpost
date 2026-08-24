import { test, expect } from '@playwright/test'
import { loginAs, botEmail, PASSWORD, serviceClient, userIdByEmail, shot } from './_helpers'

// D29 PROMPT-2 — 진행 기록(단계·세무자료·정산상태)을 서버액션으로 옮겼다.
//   [ ] 캠페인 딜시트에서도 단계 이동이 DB 에 남는다 (findings 17 은 여기서 시작된 결함)
//   [ ] 당사자가 아니면 조용히 넘어가지 않고 화면에 에러가 뜬다
//
// D29 PROMPT-4 — 단계마다 넘기는 사람이 다르다(STAGE_OWNER).
//   [ ] 인플루언서가 「원고」를 넘기면 DB 에 남는다
//   [ ] 인플루언서가 「수락」을 넘기려 하면 액션이 거절한다
//   [ ] 광고주가 「원고」를 넘기려 하면 액션이 거절한다

const advEmail = botEmail('adv')
const infEmail = botEmail('inf-pc')

test.describe.configure({ mode: 'serial' })

async function stageOf(id: string) {
  const sb = serviceClient()
  const { data } = await sb.from('proposals').select('stage').eq('id', id).maybeSingle()
  return data?.stage ?? null
}

// 캠페인에 걸린 확정 협업 한 건 — 단계 → 버튼이 뜨는 건.
async function pickCampaignDeal() {
  const sb = serviceClient()
  const advId = await userIdByEmail(advEmail)
  const { data } = await sb
    .from('proposals')
    .select('id, campaign_id, stage')
    .not('campaign_id', 'is', null)
    .eq('advertiser_id', advId)
    .eq('advertiser_confirmed', true)
    .eq('influencer_confirmed', true)
    .is('settled_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
  return data?.[0] ?? null
}

test('D29P2-1 · 캠페인 딜시트: 단계 이동이 DB 에 남는다', async ({ browser }) => {
  const deal = await pickCampaignDeal()
  if (!deal) { console.log('[D29P2] 확정된 캠페인 협업이 없어 생략'); return }
  const before = await stageOf(deal.id)
  console.log('[D29P2] 캠페인 협업:', deal.id, '단계(전):', before)

  const { ctx, page } = await loginAs(browser, advEmail, PASSWORD, '**/advertiser/**')
  await page.goto(`/advertiser/campaigns/${deal.campaign_id}`)
  await page.waitForTimeout(2000)
  await shot(page, 'd29p2-campaign-dealsheet')

  const arrow = page.getByRole('button', { name: '→', exact: true }).first()
  await expect(arrow, '확정된 건이라 단계 이동 버튼이 있어야 한다').toBeVisible()
  await arrow.click()
  await page.waitForTimeout(2000)
  const after = await stageOf(deal.id)
  console.log('[D29P2] 단계(후):', after)
  expect(after, '화면만 넘어가고 DB 가 그대로면 실패다').not.toBe(before)
  await shot(page, 'd29p2-campaign-stage-advanced')

  await ctx.close()
})

// 당사자가 아니면 어떻게 되나 — 화면을 열어둔 채 소유자를 바꿔 「남의 협업」 상태를 만든다.
// (실제로 남의 딜시트는 라우트 가드가 먼저 막아 UI 로는 도달할 길이 없다. 끝나면 반드시 원복한다.)
test('D29P2-2 · 권한 없는 세션이 누르면 화면에 에러가 뜬다', async ({ browser }) => {
  const sb = serviceClient()
  const { data: rows } = await sb
    .from('proposals')
    .select('id, advertiser_id, stage')
    .is('campaign_id', null)
    .eq('advertiser_id', await userIdByEmail(advEmail))
    .eq('advertiser_confirmed', true)
    .eq('influencer_confirmed', true)
    .limit(1)
  const deal = rows?.[0]
  if (!deal) { console.log('[D29P2] 확정된 오픈 협업이 없어 생략'); return }

  const owner = deal.advertiser_id
  const originalStage = deal.stage
  const stranger = await userIdByEmail(botEmail('adv2')).catch(() => null)
  const foreignId = stranger ?? (await userIdByEmail(botEmail('inf-pc')))
  await setStage(deal.id, '수락') // 광고주 차례여야 → 버튼이 뜬다(D29 PROMPT-4)

  const { ctx, page } = await loginAs(browser, advEmail, PASSWORD, '**/advertiser/**')
  try {
    await page.goto(`/advertiser/deals/${deal.id}`)
    await page.waitForTimeout(1500)

    // 화면은 열려 있고 버튼도 보이는 상태에서 소유자만 바꾼다
    await sb.from('proposals').update({ advertiser_id: foreignId }).eq('id', deal.id)
    const before = await stageOf(deal.id)

    await page.getByRole('button', { name: '→', exact: true }).first().click()
    await page.waitForTimeout(1500)
    await shot(page, 'd29p2-permission-error')

    await expect(
      page.getByText('단계 이동 실패').first(),
      '거절당하면 조용히 넘어가지 말고 화면에 떠야 한다',
    ).toBeVisible()
    expect(await stageOf(deal.id), 'DB 도 그대로여야 한다').toBe(before)
  } finally {
    await sb.from('proposals').update({ advertiser_id: owner }).eq('id', deal.id)
    if (originalStage) await setStage(deal.id, originalStage)
    await ctx.close()
  }
})

// ─────────────────────────────────────────────────────────────
// D29 PROMPT-4 — 단계별 담당자
// ─────────────────────────────────────────────────────────────

async function setStage(id: string, stage: string) {
  const sb = serviceClient()
  await sb.from('proposals').update({ stage }).eq('id', id)
}

// 양쪽 확정된 오픈 협업 한 건 (24번 스펙과 같은 건을 쓴다)
async function pickOpenDeal() {
  const sb = serviceClient()
  const { data } = await sb
    .from('proposals')
    .select('id, stage')
    .is('campaign_id', null)
    .eq('advertiser_id', await userIdByEmail(advEmail))
    .eq('advertiser_confirmed', true)
    .eq('influencer_confirmed', true)
    .is('settled_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
  return data?.[0] ?? null
}

test('D29P4-1 · 인플루언서가 「원고」를 넘길 수 있다 (DB 에 남는다)', async ({ browser }) => {
  const deal = await pickOpenDeal()
  if (!deal) { console.log('[D29P4] 확정된 오픈 협업이 없어 생략'); return }
  const original = deal.stage
  await setStage(deal.id, '원고') // 인플루언서 차례

  const { ctx, page } = await loginAs(browser, infEmail, PASSWORD, '**/influencer/**')
  try {
    await page.goto(`/influencer/deals/${deal.id}`)
    await page.waitForTimeout(1500)
    const arrow = page.getByRole('button', { name: '→', exact: true }).first()
    await expect(arrow, '원고는 인플루언서 차례라 버튼이 보여야 한다').toBeVisible()
    await arrow.click()
    await page.waitForTimeout(1500)
    await shot(page, 'd29p4-inf-advance-원고')
    expect(await stageOf(deal.id), '인플루언서가 넘긴 단계도 DB 에 남아야 한다').toBe('수정/컨펌')
  } finally {
    if (original) await setStage(deal.id, original)
    await ctx.close()
  }
})

// 화면에서 버튼을 숨기는 것만으로는 못 막는다 — 낡은 화면으로 눌러도 서버가 거절해야 한다.
// 화면을 열어둔 채 DB 단계만 상대 차례로 바꿔 「낡은 화면」을 만든다.
test('D29P4-2 · 인플루언서가 「수락」을 넘기려 하면 거절한다', async ({ browser }) => {
  const deal = await pickOpenDeal()
  if (!deal) { console.log('[D29P4] 확정된 오픈 협업이 없어 생략'); return }
  const original = deal.stage
  await setStage(deal.id, '원고')

  const { ctx, page } = await loginAs(browser, infEmail, PASSWORD, '**/influencer/**')
  try {
    await page.goto(`/influencer/deals/${deal.id}`)
    await page.waitForTimeout(1500)
    await setStage(deal.id, '수락') // 광고주 차례로 바뀜 — 화면은 아직 모른다

    await page.getByRole('button', { name: '→', exact: true }).first().click()
    await page.waitForTimeout(1500)
    await shot(page, 'd29p4-inf-rejected')
    await expect(page.getByText('이 단계는 광고주가 넘겨요').first()).toBeVisible()
    expect(await stageOf(deal.id), 'DB 는 그대로여야 한다').toBe('수락')
  } finally {
    if (original) await setStage(deal.id, original)
    await ctx.close()
  }
})

test('D29P4-3 · 광고주가 「원고」를 넘기려 하면 거절한다', async ({ browser }) => {
  const deal = await pickOpenDeal()
  if (!deal) { console.log('[D29P4] 확정된 오픈 협업이 없어 생략'); return }
  const original = deal.stage
  await setStage(deal.id, '수락')

  const { ctx, page } = await loginAs(browser, advEmail, PASSWORD, '**/advertiser/**')
  try {
    await page.goto(`/advertiser/deals/${deal.id}`)
    await page.waitForTimeout(1500)
    await setStage(deal.id, '원고') // 인플루언서 차례로 바뀜 — 화면은 아직 모른다

    await page.getByRole('button', { name: '→', exact: true }).first().click()
    await page.waitForTimeout(1500)
    await shot(page, 'd29p4-adv-rejected')
    await expect(page.getByText('이 단계는 인플루언서가 넘겨요').first()).toBeVisible()
    expect(await stageOf(deal.id), 'DB 는 그대로여야 한다').toBe('원고')
  } finally {
    if (original) await setStage(deal.id, original)
    await ctx.close()
  }
})
