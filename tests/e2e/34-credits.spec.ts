import { test, expect } from '@playwright/test'
import { serviceClient, loginAs, shot, userIdByEmail, finding, PASSWORD } from './_helpers'

// D30 [2] — 크레딧. 「대시 · 캠페인 등록에서 원장에 남는지 · 잔액 = 원장 합」.
//
// ⚠️ 이 시나리오가 돈 문제를 잡는 자리다. 화면 잔액과 원장 합이 어긋나면 그대로 사고다.
//
// 검사를 두 갈래로 세운다 —
//   화면 잔액  ← credit_balances 뷰 (getBalance 가 읽는 곳)
//   원장 합    ← credit_ledger.delta 를 직접 더한 값
// 둘이 같은 곳에서 오면 대조가 아니라 자기확인이 된다. 그래서 뷰를 안 거치고 raw 합을 따로 낸다.
//
// 보는 것:
//   1) 크레딧 화면 잔액 = 뷰 = 원장 raw 합 · 이번 달 적립/사용도 원장과 맞는가
//   2) 비공개로 등록하면 과금이 없고, 공개로 등록해야 create_campaign −5,000 · encourage +500 이
//      그 캠페인 ref 로 남는가 (0105 — 양쪽을 다 본다. 한쪽만 보면 반대로 깨졌을 때 못 잡는다)
//   3) 등록 뒤에도 잔액 = 원장 합이고, 변동폭이 정확히 −4,500 인가
//   4) 대시 발송은 베타 무료 — 원장에 줄이 안 생기는 게 맞고, 단가표도 그렇게 말하는가

const TAG = '[봇검증]'
const ADV_EMAIL = 'bot+adv-40060863@matchpost.kr'

const TOP_UP_MEMO = '[봇검증] 시드용 임시 충전 — 정리 때 상계'
const REVERSE_MEMO = '[봇검증] 시드 되돌림 — 원장은 append-only 라 삭제 대신 역행 한 줄'

const T_CAMP = `${TAG} 크레딧 원장 확인 캠페인`
const T_CAMP_PRIVATE = `${TAG} 크레딧 원장 확인 캠페인 (비공개)`
const BUDGET_MANWON = '300'

// 트리거(0018)가 매기는 값 — 화면이 아니라 마이그레이션에 적힌 수치를 그대로 쓴다.
const FEE_CREATE_CAMPAIGN = 5_000
const GRANT_ENCOURAGE = 500

let advId = ''
let seededAt = ''
const madeCampaigns: string[] = []

test.describe.configure({ mode: 'serial' })

// 원장 raw 합 — 뷰를 거치지 않는다. 이게 대조의 반대편이다.
async function sumLedger(userId: string) {
  const db = serviceClient()
  const { data, error } = await db
    .from('credit_ledger')
    .select('delta')
    .eq('user_id', userId)
    .limit(5_000)
  if (error) throw new Error(`원장 읽기 실패: ${error.message}`)
  return (data ?? []).reduce((s, r) => s + r.delta, 0)
}

async function viewBalance(userId: string) {
  const db = serviceClient()
  const { data, error } = await db
    .from('credit_balances')
    .select('balance')
    .eq('user_id', userId)
    .single()
  if (error) throw new Error(`잔액 뷰 읽기 실패: ${error.message}`)
  return data!.balance as number
}

// 화면에 찍힌 숫자만 뽑는다 ("8,500 남음" → 8500)
const num = (s: string) => parseInt(s.replace(/[^\d-]/g, ''), 10)

test.beforeAll(async () => {
  const db = serviceClient()
  advId = await userIdByEmail(ADV_EMAIL)

  // 캠페인 등록에 5,000C 가 필요하다 — 잔액이 모자라 트리거가 막히면 시나리오 자체가 안 돈다.
  const { error: topUpErr } = await db.rpc('credit_ledger_grant', {
    p_user_id: advId,
    p_amount: 8_000,
    p_kind: 'admin',
    p_reason_code: 'admin_grant',
    p_memo: TOP_UP_MEMO,
  })
  if (topUpErr) throw new Error(`시드용 충전 실패: ${topUpErr.message}`)

  // ⚠️ 기준선은 DB 가 찍은 시각으로 잡는다 — 이 PC 시계가 Supabase 보다 1초쯤 앞선다.
  const { data: seedRow } = await db
    .from('credit_ledger')
    .select('created_at')
    .eq('user_id', advId)
    .eq('memo', TOP_UP_MEMO)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (!seedRow) throw new Error('시드 충전 줄을 못 찾았어요 — 원장 기준선을 세울 수 없습니다')
  seededAt = seedRow.created_at
})

test.afterAll(async () => {
  const db = serviceClient()
  if (madeCampaigns.length > 0) {
    const { data: n } = await db.from('notifications').delete().in('ref_id', madeCampaigns).select('id')
    console.log(`[정리] 알림 ${n?.length ?? 0}줄`)
    const { data: c, error } = await db.from('campaigns').delete().in('id', madeCampaigns).select('id')
    if (error) console.log(`[정리] ⚠️ 캠페인 삭제 실패: ${error.message}`)
    else console.log(`[정리] 캠페인 ${c?.length ?? 0}줄`)
    const { data: strays } = await db
      .from('notifications')
      .select('id')
      .or('body.ilike.%봇검증%,title.ilike.%봇검증%')
    if ((strays ?? []).length > 0) await db.from('notifications').delete().in('id', strays!.map((s) => s.id))
  }

  // 원장은 append-only(0034) — 지우지 못한다. 반대 부호 한 줄로 잔액만 제자리로 돌린다.
  const deltas: number[] = []
  if (madeCampaigns.length > 0) {
    const { data } = await db
      .from('credit_ledger').select('delta')
      .eq('user_id', advId).in('ref_id', madeCampaigns).gte('created_at', seededAt)
    deltas.push(...(data ?? []).map((r) => r.delta))
  }
  const { data: tops } = await db
    .from('credit_ledger').select('delta')
    .eq('user_id', advId).eq('memo', TOP_UP_MEMO).gte('created_at', seededAt)
  deltas.push(...(tops ?? []).map((r) => r.delta))

  const net = deltas.reduce((s, d) => s + d, 0)
  if (net === 0) { console.log('[정리] 원장 — 건드린 것 없음'); return }
  const back = net > 0
    ? db.rpc('credit_ledger_penalty', { p_user_id: advId, p_amount: net, p_reason_code: 'admin_deduct', p_memo: REVERSE_MEMO })
    : db.rpc('credit_ledger_refund', { p_user_id: advId, p_amount: -net, p_reason_code: 'create_campaign', p_memo: REVERSE_MEMO })
  const { error } = await back
  if (error) console.log(`[정리] ⚠️ 원장 되돌리기 실패: ${error.message}`)
  else console.log(`[정리] 원장 — 순증감 ${net > 0 ? '+' : ''}${net}, 반대로 ${net > 0 ? '차감' : '환급'} ${Math.abs(net)}`)
})

// ── 1) 크레딧 화면 잔액 = 뷰 = 원장 합 ─────────────────────────────
test('D30-34-1 크레딧 화면의 잔액이 원장 합과 같다', async ({ browser }) => {
  const { ctx, page } = await loginAs(browser, ADV_EMAIL, PASSWORD, '**/advertiser/**')
  await page.goto('/credits')
  await expect(page.getByRole('heading', { name: '크레딧' })).toBeVisible({ timeout: 25_000 })
  await shot(page, 'd30-34-1-credits')

  const card = page.locator('div.bg-\\[\\#17171B\\]').first()
  const shown = num(await card.getByText(/^[\d,]+ 남음$/).innerText())
  const view = await viewBalance(advId)
  const raw = await sumLedger(advId)

  console.log(`[크레딧] 화면 ${shown} · 뷰 ${view} · 원장 raw 합 ${raw}`)

  if (shown !== raw) {
    finding('결함', '크레딧 화면 잔액 vs 원장 합',
      `화면에 ${shown.toLocaleString()}C 라고 적혀 있는데 credit_ledger 를 직접 더하면 ${raw.toLocaleString()}C 입니다. ` +
      `화면 아래에 「잔액은 거래 기록의 합계입니다」라고 써 있으니 이 둘은 반드시 같아야 합니다. 돈 문제입니다.`)
  }
  expect(shown, '화면 잔액 = 뷰 잔액').toBe(view)
  expect(shown, '화면 잔액 = 원장 raw 합').toBe(raw)

  // 화면이 스스로 내건 약속 — 이 문장이 위 대조의 근거다.
  await expect(page.getByText('잔액은 거래 기록의 합계입니다.', { exact: false })).toBeVisible()

  // 이번 달 적립/사용 — 화면이 최근 200줄로 계산한다. 같은 창으로 맞춰 본다.
  const db = serviceClient()
  const { data: rows } = await db
    .from('credit_ledger').select('delta, created_at')
    .eq('user_id', advId).order('created_at', { ascending: false }).limit(200)
  const now = new Date()
  const month = (rows ?? []).filter((r) => {
    const d = new Date(r.created_at)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const inSum = month.filter((r) => r.delta > 0).reduce((s, r) => s + r.delta, 0)
  const outSum = month.filter((r) => r.delta < 0).reduce((s, r) => s + Math.abs(r.delta), 0)

  expect(num(await card.getByText(/^[\d,]+ 적립$/).innerText()), '이번 달 적립').toBe(inSum)
  expect(num(await card.getByText(/^[\d,]+ 사용$/).innerText()), '이번 달 사용').toBe(outSum)

  await ctx.close()
})

// ── 2) 캠페인 등록이 원장에 남는가 ─────────────────────────────────
test('D30-34-2 비공개 등록은 과금되지 않고 공개 등록에만 청구와 응원이 남는다', async ({ browser }) => {
  const db = serviceClient()
  const before = await sumLedger(advId)

  const { ctx, page } = await loginAs(browser, ADV_EMAIL, PASSWORD, '**/advertiser/**')

  // 화면에서 캠페인을 하나 등록하고 그 id 를 돌려준다.
  // ⚠️ 공개 여부는 등록하는 그 순간에 정해야 한다 — 0105 는 INSERT 트리거라, 비공개로 만들었다가
  //    나중에 토글로 공개하면 영영 과금되지 않는다(0105 문서 13행). 토글로 만들면 시험이 헛돈다.
  const register = async (title: string, isPublic: boolean) => {
    await page.goto('/advertiser/campaigns/new')
    await expect(page.getByText('원하는 채널 *', { exact: false })).toBeVisible({ timeout: 25_000 })

    await page.getByRole('button', { name: '인스타그램', exact: true }).click()
    await page.locator('button', { hasText: '제품을 받아 체험 후 포스팅' }).first().click()
    await page.getByPlaceholder('예: 강남 신상 카페 오픈 방문 리뷰 모집').fill(title)
    await page.getByPlaceholder('예: 500').fill(BUDGET_MANWON)

    // 토글은 공개가 기본값이다 — 비공개로 만들 때만 끈다.
    await expect(page.getByText('인플루언서에게 공개')).toBeVisible()
    if (!isPublic) await page.locator('button.w-12.h-6').first().click()
    await shot(page, `d30-34-2-form-${isPublic ? 'public' : 'private'}`)

    await page.locator('button:visible', { hasText: '캠페인 등록하기' }).first().click()
    await expect(page.getByText('캠페인이 등록됐어요!')).toBeVisible({ timeout: 30_000 })
    await shot(page, `d30-34-2-done-${isPublic ? 'public' : 'private'}`)

    const { data: camp } = await db
      .from('campaigns').select('id, is_public')
      .eq('advertiser_id', advId).eq('title', title)
      .order('created_at', { ascending: false }).limit(1).single()
    if (!camp) throw new Error(`등록했다는데 campaigns 에 「${title}」 줄이 없습니다 — 여기서 멈춥니다`)
    // 공개 설정이 의도와 다르면 그 뒤 판정이 전부 무의미하다. 우회하지 않고 멈춘다.
    if (camp.is_public !== isPublic) {
      throw new Error(`공개 설정이 의도와 다릅니다(원한 값 ${isPublic}, 저장된 값 ${camp.is_public}) — 여기서 멈춥니다`)
    }
    madeCampaigns.push(camp.id)
    return camp.id as string
  }

  const ledgerOf = async (refId: string) => {
    const { data } = await db
      .from('credit_ledger').select('delta, reason_code, memo, ref_type')
      .eq('user_id', advId).eq('ref_id', refId)
    return data ?? []
  }
  const say = (led: { reason_code: string; delta: number }[]) =>
    led.length === 0 ? '없음' : led.map((r) => `${r.reason_code} ${r.delta > 0 ? '+' : ''}${r.delta}`).join(' · ')

  // ── 비공개: 등록비도 응원도 붙으면 안 된다 ──
  // 0105 이전에는 여기서도 5,000C 가 빠졌다. 단가표는 「모집 캠페인을 공개로 등록」이라 적어 두었는데
  // 트리거에 is_public 조건이 없어(0018:272) 만들다 만 비공개 초안에도 청구가 갔다.
  // first_action(+3,000, 0064) 같은 다른 줄은 붙을 수 있으므로 이 둘만 콕 집어 본다.
  const privateId = await register(T_CAMP_PRIVATE, false)
  const privLed = await ledgerOf(privateId)
  const privCharge = privLed.find((r) => r.reason_code === 'create_campaign')
  if (privCharge) {
    finding('화면이 거짓을 말함', '크레딧 단가표 — 캠페인 개설',
      `크레딧 화면 단가표에 「캠페인 개설 · 모집 캠페인을 공개로 등록 · 5,000 사용」이라고 적혀 있는데, ` +
      `공개를 끄고(비공개) 등록해도 ${Math.abs(privCharge.delta).toLocaleString()}C 가 빠져나갑니다. ` +
      `광고주는 「공개로 등록」이라고 읽고 비공개 초안은 공짜라고 생각합니다.`)
  }
  expect(privCharge, '비공개 등록에 등록비 청구가 붙었나').toBeUndefined()
  expect(privLed.find((r) => r.reason_code === 'encourage'), '비공개 등록에 응원 크레딧이 붙었나').toBeUndefined()

  // ── 공개: 청구와 응원이 그 캠페인 ref 로 남아야 한다 ──
  // 봇 캠페인이 잠시 검색에 노출된다. [봇검증] 접두어가 붙고 afterAll 이 지우므로 감수한다 —
  // 여기를 안 보면 0105 가 반대로 깨져(전부 무과금) 캠페인이 공짜로 열려도 아무도 모른다.
  const publicId = await register(T_CAMP, true)
  const pubLed = await ledgerOf(publicId)
  const charge = pubLed.find((r) => r.reason_code === 'create_campaign')
  const grant = pubLed.find((r) => r.reason_code === 'encourage')

  if (!charge) {
    finding('결함', '캠페인 등록비 — 공개로 등록했는데 청구가 없다',
      `공개로 캠페인을 등록했는데 원장에 create_campaign 줄이 없습니다. 단가표는 5,000C 라고 적어 두었는데 ` +
      `실제로는 한 푼도 안 나갑니다 — 캠페인이 공짜로 열리고 있습니다.`)
  }
  expect(charge, '공개 등록 청구 줄이 원장에 있나').toBeTruthy()
  expect(charge!.delta, '캠페인 등록 청구액').toBe(-FEE_CREATE_CAMPAIGN)
  expect(charge!.ref_type, '청구 줄이 캠페인을 가리키나').toBe('campaign')
  expect(grant, '응원 크레딧 줄이 원장에 있나').toBeTruthy()
  expect(grant!.delta, '응원 크레딧').toBe(GRANT_ENCOURAGE)

  // 잔액 변동 = 두 캠페인이 만든 원장 줄의 합. 정확한 수치를 여기 박아두지 않는다 —
  // 계정당 한 번인 first_action(0064) 같은 줄이 캠페인에 붙을 수 있어, 그날그날 값이 다르다.
  const refNet = [...privLed, ...pubLed].reduce((s, r) => s + r.delta, 0)
  const after = await sumLedger(advId)
  expect(after - before, '캠페인 등록으로 움직인 잔액 = 두 캠페인이 남긴 원장 줄의 합').toBe(refNet)
  console.log(`[크레딧] 비공개 등록 원장 ${say(privLed)} / 공개 등록 원장 ${say(pubLed)}`)

  await ctx.close()
})

// ── 3) 등록 뒤에도 화면 잔액 = 원장 합 ─────────────────────────────
test('D30-34-3 캠페인 등록 뒤에도 화면 잔액이 원장 합을 따라간다', async ({ browser }) => {
  const { ctx, page } = await loginAs(browser, ADV_EMAIL, PASSWORD, '**/advertiser/**')
  await page.goto('/credits')
  await expect(page.getByRole('heading', { name: '크레딧' })).toBeVisible({ timeout: 25_000 })
  await shot(page, 'd30-34-3-after')

  const card = page.locator('div.bg-\\[\\#17171B\\]').first()
  const shown = num(await card.getByText(/^[\d,]+ 남음$/).innerText())
  const raw = await sumLedger(advId)

  if (shown !== raw) {
    finding('결함', '크레딧 화면 잔액 vs 원장 합 (등록 직후)',
      `캠페인 등록 직후 화면 잔액 ${shown.toLocaleString()}C 와 원장 합 ${raw.toLocaleString()}C 가 다릅니다. ` +
      `등록 트리거가 원장에 쓴 값과 화면이 읽는 값이 어긋난 것이라 돈 문제로 이어집니다.`)
  }
  expect(shown, '등록 직후 화면 잔액 = 원장 합').toBe(raw)

  // 방금 등록한 캠페인이 사용 내역에 이름으로 보이는가 — 숫자만 맞고 설명이 없으면 광고주는 못 읽는다.
  const history = page.getByText('캠페인 개설', { exact: false })
  if (await history.count() === 0) {
    finding('화면이 거짓을 말함', '크레딧 사용 내역',
      `방금 5,000C 가 빠졌는데 「사용 내역」에 「캠페인 개설」 줄이 안 보입니다. 잔액만 줄고 이유가 없으면 문의로 옵니다.`)
  }
  await expect(history.first(), '사용 내역에 캠페인 개설 줄').toBeVisible()

  await ctx.close()
})

// ── 4) 대시 발송은 베타 무료 ───────────────────────────────────────
test('D30-34-4 대시 발송은 베타 무료라 원장에 줄이 생기지 않는다', async ({ browser }) => {
  const db = serviceClient()

  // 0057 이 트리거 안에서 껐다 — 청구를 0원으로 적는 게 아니라 아예 안 적는다.
  const { count } = await db
    .from('credit_ledger')
    .select('id', { count: 'exact', head: true })
    .eq('reason_code', 'send_proposal')
  console.log(`[크레딧] 원장의 send_proposal 줄 ${count ?? 0}건 (베타 무료면 0이 맞다)`)
  expect(count ?? 0, '대시 발송 청구 줄').toBe(0)

  const { ctx, page } = await loginAs(browser, ADV_EMAIL, PASSWORD, '**/advertiser/**')
  await page.goto('/credits')
  await expect(page.getByRole('heading', { name: '무엇에 쓰이나요' })).toBeVisible({ timeout: 25_000 })

  // 제목·설명과 금액이 형제라, 둘 다 품은 가장 안쪽 칸이 그 줄이다.
  const row = page.locator('div')
    .filter({ hasText: '인플루언서에게 대시 보내기' })
    .filter({ hasText: '원래 500C' })
    .last()
  await expect(row, '단가표에 대시 보내기 줄').toBeVisible()
  await expect(row.getByText('지금은 무료')).toBeVisible()
  await expect(row.getByText('원래 500C')).toBeVisible()
  await shot(page, 'd30-34-4-pricetable')

  // 「베타 기간이라 N C 가 청구되지 않았어요」는 지웠다.
  // 원장에서 beta_free reason_code 줄을 세어 만들었는데, 베타 무료 항목은 원장에 줄을 안 남긴다(0057).
  // 조건이 서로를 지워 어떤 경우에도 뜰 수 없는 문구였다 — 없는 것이 정상이다.
  await expect(
    page.getByText(/베타 기간이라 .*청구되지 않았어요/),
    '뜰 수 없는 베타 절약 문구는 지웠다',
  ).toHaveCount(0)

  await ctx.close()
})
