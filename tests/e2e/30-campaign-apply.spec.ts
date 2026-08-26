import { test, expect } from '@playwright/test'
import {
  serviceClient,
  loginAs,
  shot,
  userIdByEmail,
  ledger,
  PASSWORD,
} from './_helpers'

// D32 1절 검증 — 캠페인 지원.
//
// ⚠️ 이 스펙만 실제 데이터를 심는다(사용자 승인: 「테스트 계정으로, [봇검증] 접두어를 붙이고,
//    확인 뒤 지우는 조건으로」). 심은 것은 afterAll 에서 전부 지운다 —
//    campaigns · proposals · messages · notifications 네 곳이다.
//
// 보는 것:
//   1) 검색 결과에 「지원하기」가 뜬다            (전에는 「대시하기」 하나뿐이었다)
//   2) 지역 캠페인은 광고주가 정한 날짜 중에서만 고른다
//   3) 제품 캠페인은 날짜를 묻지 않는다
//   4) 지원하면 campaign_id 가 붙은 proposals 행이 생긴다 (전체 실측 0행이던 것)
//   5) 광고주 크레딧이 안 깎인다
//   6) 두 번 지원 못 한다 (화면 + DB 유니크 인덱스)
//   7) 모집 종료된 캠페인은 버튼이 죽어 있다

const TAG = '[봇검증]'
const ADV_EMAIL = 'bot+adv-40060863@matchpost.kr'
const INF_EMAIL = 'bot+inf-pc-40060863@matchpost.kr'

const ymd = (plusDays: number) => {
  const d = new Date()
  d.setDate(d.getDate() + plusDays)
  return d.toISOString().slice(0, 10)
}
const dow = (v: string) => {
  const [, m, d] = v.split('-').map(Number)
  return `${m}/${d} (${['일', '월', '화', '수', '목', '금', '토'][new Date(v + 'T00:00:00').getDay()]})`
}

const D1 = ymd(7)
const D2 = ymd(9)
const D3 = ymd(11)
const CONTENT_START = ymd(14)

const T_REGION = `${TAG} 지역 캠페인`
const T_PRODUCT = `${TAG} 제품 캠페인`
const T_CLOSED = `${TAG} 모집끝난 캠페인`

// 원장 정리용 표식 — beforeAll 이 넣는 충전 줄을 afterAll 이 이 메모로 되찾는다.
const TOP_UP_MEMO = '[봇검증] 시드용 임시 충전 — 정리 때 상계'
const REVERSE_MEMO = '[봇검증] 시드 되돌림 — 원장은 append-only 라 삭제 대신 역행 한 줄'

let advId = ''
let infId = ''
const madeCampaigns: string[] = []
// ⚠️ 원장은 append-only 라 지난 실행의 줄이 그대로 쌓여 있다. 메모만 보고 되찾으면
//    지난 실행의 충전 줄까지 같이 잡혀 두 배로 차감된다(실제로 15,000 을 더 깎았다).
//    그래서 이번 실행이 만든 줄만 보도록 시작 시각으로 자른다.
//
// ⚠️ 이 시각은 **DB 가 찍은 것**이어야 한다. new Date() 로 잡았더니 이 PC 시계가
//    Supabase 보다 1 초쯤 빨라서, 방금 넣은 충전 줄이 「시작 전」으로 밀려 빠졌다
//    (그 실행은 2,000 만 되돌리고 15,000 을 그대로 남겼다).
//    그래서 충전 줄 자신의 created_at 을 읽어 기준으로 쓴다.
let seededAt = ''

const base = (advertiserId: string) => ({
  advertiser_id: advertiserId,
  manager_id: advertiserId,
  brand_name: '봇검증브랜드',
  channels: ['인스타그램'],
  content_counts: { 인스타그램: 1 },
  missions: { 인스타그램: {} },
  options: [],
  budget_total: 1_000_000,
  recruit_start: ymd(-1),
  recruit_end: ymd(20),
  payment_term_type: 'after_publish_days',
  payment_term_value: 30,
  payment_methods: ['계좌이체'],
  predefined_categories: ['여행'],
  details: '봇검증용 캠페인입니다. 확인 후 삭제됩니다.',
  is_public: true,
  status: 'open',
  recruit_target: 3,
  stage_pre_confirm: true,
  stage_post_edit: false,
})

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  const db = serviceClient()
  advId = await userIdByEmail(ADV_EMAIL)
  infId = await userIdByEmail(INF_EMAIL)

  // 캠페인 등록은 한 건에 5,000 크레딧이 든다(0018 trg_credit_campaign_open, 응원 +500 환급).
  // 봇 광고주 잔액으로는 세 건이 안 돼서 시드용으로만 채운다 —
  // 이 줄과 시드가 만든 차감/응원 줄은 afterAll 에서 반대 부호 한 줄로 상계한다(잔액이 제자리로 돌아온다).
  const { error: topUpErr } = await db.rpc('credit_ledger_grant', {
    p_user_id: advId,
    p_amount: 15_000,
    p_kind: 'admin',
    p_reason_code: 'admin_grant',
    p_memo: TOP_UP_MEMO,
  })
  if (topUpErr) throw new Error(`시드용 충전 실패: ${topUpErr.message}`)

  // 방금 넣은 충전 줄의 created_at — 이번 실행의 원장 기준선이다(위 주석 참고).
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

  const { data, error } = await db
    .from('campaigns')
    .insert([
      {
        ...base(advId),
        title: T_REGION,
        campaign_type: '지역',
        dates: [D1, D2, D3].map((d) => ({ date: d, start_time: '10:00', end_time: '18:00' })),
        date: D1,
        start_time: '10:00',
        end_time: '18:00',
        location_city: '서울 강남구',
        location_district: '역삼동',
        location_name: '봇검증 팝업',
        location_address: '서울 강남구 역삼동 1',
        content_start: CONTENT_START,
      },
      {
        ...base(advId),
        title: T_PRODUCT,
        campaign_type: '제품',
        dates: [],
        // 등록 폼이 비지역에 넣는 값 그대로 — 방문이 없으니 진행일도 없다.
        // ⚠️ 0099 를 실행해야 통과한다(그 전에는 campaigns.date 가 NOT NULL 이라 시드부터 막힌다).
        date: null,
        content_start: CONTENT_START,
      },
      {
        ...base(advId),
        title: T_CLOSED,
        campaign_type: '제품',
        dates: [],
        date: null,
        content_start: CONTENT_START,
        recruit_start: ymd(-20),
        recruit_end: ymd(-1), // 어제 마감
      },
    ])
    .select('id, title')
  if (error) throw new Error(`시드 실패: ${error.message}`)
  for (const r of data ?? []) madeCampaigns.push(r.id)
  console.log(`[시드] 캠페인 ${madeCampaigns.length}건`, data?.map((r) => r.title))
})

test.afterAll(async () => {
  const db = serviceClient()
  if (madeCampaigns.length === 0) return

  // 지우고 나서 「몇 줄 지웠다」고 찍기만 하면 안 된다 — 가드나 RLS 가 막아도 supabase-js 는
  // error 로만 알려주고 행은 0개다. 실제로 원장에서 그렇게 당했다. 그래서 전부 error 를 본다.
  const wipe = async (
    label: string,
    q: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  ) => {
    const { data, error } = await q
    if (error) console.log(`[정리] ⚠️ ${label} 삭제 실패: ${error.message}`)
    else console.log(`[정리] ${label} ${data?.length ?? 0}줄`)
  }

  const { data: props } = await db.from('proposals').select('id').in('campaign_id', madeCampaigns)
  const ids = (props ?? []).map((p) => p.id)
  if (ids.length > 0) {
    // 확정까지 가면 딜시트 체크포인트가 딸려 붙는다(2절). proposals 보다 먼저 치운다.
    await wipe('체크포인트', db.from('deal_checkpoints').delete().in('proposal_id', ids).select('id'))
    await wipe('알림', db.from('notifications').delete().in('ref_id', ids).select('id'))
    await wipe('메시지', db.from('messages').delete().in('proposal_id', ids).select('id'))
    await wipe('제안', db.from('proposals').delete().in('id', ids).select('id'))
  }
  await wipe('캠페인', db.from('campaigns').delete().in('id', madeCampaigns).select('id'))

  // ⚠️ ref_id 만으로는 다 안 지워진다. campaigns · proposals 에 걸린 레거시 트리거가
  //    ref_id 없이 알림을 넣어서(campaign_created / dash_received) 여섯 줄이 남았다.
  //    제목·본문의 [봇검증] 을 보고 한 번 더 훑는다.
  const { data: strays } = await db
    .from('notifications')
    .select('id')
    .or(`body.ilike.%${TAG.slice(1, -1)}%,title.ilike.%${TAG.slice(1, -1)}%`)
  if ((strays ?? []).length > 0) await db.from('notifications').delete().in('id', strays!.map((s) => s.id))

  // 크레딧 원장 — 여기만 「지운다」가 안 된다. 0034 가 credit_ledger 에 삭제 금지 가드를
  // 걸어 뒀다(append-only — insert a reversing row instead). 지우려 들면 예외가 나고,
  // supabase-js 의 delete 는 그 예외를 error 로만 돌려주므로 확인하지 않으면 조용히 넘어간다.
  // 실제로 처음엔 「원장 7줄」이라고 찍어 놓고 한 줄도 안 지워졌다.
  // 그래서 가드가 시키는 대로 반대 부호 한 줄을 넣어 잔액만 제자리로 돌린다.
  //   시드가 쓴 돈 = 캠페인 N건 × (등록 −5,000 + 응원 +500) = −4,500N
  //   시드가 넣은 돈 = 임시 충전 +15,000
  //
  // ⚠️ 2절이 붙으면서 광고주만으로는 부족해졌다. 확정이 나면 0018 축하 크레딧이 **양쪽에** 들어간다.
  //    그래서 캠페인 id 뿐 아니라 제안 id 까지 훑고, 인플루언서 잔액도 같이 되돌린다.
  const refs = [...madeCampaigns, ...ids]
  const undo = async (userId: string, label: string) => {
    // ⚠️ 두 쿼리 다 seededAt 으로 자른다. 특히 메모 쪽 — 지난 실행이 남긴 같은 메모의
    //    충전 줄이 원장에 그대로 있어서, 자르지 않으면 실행할 때마다 15,000 씩 더 깎는다.
    const { data: byRef } = await db
      .from('credit_ledger').select('delta')
      .eq('user_id', userId).in('ref_id', refs).gte('created_at', seededAt)
    const { data: topUp } = await db
      .from('credit_ledger').select('delta')
      .eq('user_id', userId).eq('memo', TOP_UP_MEMO).gte('created_at', seededAt)
    const net = [...(byRef ?? []), ...(topUp ?? [])].reduce((s, r) => s + r.delta, 0)
    if (net === 0) { console.log(`[정리] 원장 ${label} — 건드린 것 없음`); return }
    const back =
      net > 0
        ? db.rpc('credit_ledger_penalty', {
            p_user_id: userId, p_amount: net,
            p_reason_code: 'admin_deduct', p_memo: REVERSE_MEMO,
          })
        : db.rpc('credit_ledger_refund', {
            p_user_id: userId, p_amount: -net,
            p_reason_code: 'create_campaign', p_memo: REVERSE_MEMO,
          })
    const { error } = await back
    if (error) console.log(`[정리] ⚠️ 원장 ${label} 되돌리기 실패: ${error.message}`)
    else console.log(`[정리] 원장 ${label} — 시드 순증감 ${net > 0 ? '+' : ''}${net}, 반대로 ${net > 0 ? '차감' : '환급'} ${Math.abs(net)}`)
  }
  await undo(advId, '광고주')
  await undo(infId, '인플루언서')

  const { data: left } = await db.from('campaigns').select('id').in('id', madeCampaigns)
  const { data: leftP } = await db.from('proposals').select('id').in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
  console.log(`[정리] 캠페인 남음 ${left?.length ?? 0} · proposals 남음 ${leftP?.length ?? 0}`)
})

test('D32-1 인플루언서가 캠페인에 지원한다', async ({ browser }) => {
  const db = serviceClient()
  const before = await ledger(advId)
  const startedAt = new Date().toISOString()

  const { ctx, page } = await loginAs(browser, INF_EMAIL, PASSWORD, '**/influencer/dashboard')
  await page.goto('/influencer/search')
  await page.getByPlaceholder('예: 팝업스토어, 신제품').fill('봇검증')
  await page.getByRole('button', { name: '캠페인 검색' }).click()
  await expect(page.getByText(T_REGION)).toBeVisible({ timeout: 20_000 })
  await shot(page, 'd32-1-search')

  const card = (title: string) => page.locator('div[class*="border-amber-400"]').filter({ hasText: title })
  const modal = page.locator('div.max-w-\\[380px\\]')

  // ── 7) 모집 종료 ────────────────────────────────────────────────
  const closedBtn = card(T_CLOSED).getByRole('button')
  await expect(closedBtn).toHaveText('모집 종료')
  await expect(closedBtn).toBeDisabled()

  // ── 1·2) 지역 캠페인 — 광고주가 정한 날짜만 ──────────────────────
  await card(T_REGION).getByRole('button', { name: '지원하기' }).click()
  await expect(modal.getByText('이 캠페인에 지원할까요?')).toBeVisible()
  await expect(modal.getByText('크레딧은 들지 않아요', { exact: false })).toBeVisible()
  for (const d of [D1, D2, D3]) await expect(modal.getByRole('button', { name: dow(d) })).toBeVisible()
  await shot(page, 'd32-1-modal-region')

  await modal.getByRole('button', { name: dow(D2) }).click() // 첫 칸이 아닌 두 번째를 고른다
  await modal.getByPlaceholder('어떤 콘텐츠로 참여할지 짧게 적어주세요').fill('봇검증 지원 메시지')
  await modal.getByRole('button', { name: '지원하기' }).click()
  await expect(card(T_REGION).getByRole('button', { name: '지원함' })).toBeVisible({ timeout: 20_000 })

  // ── 3) 제품 캠페인 — 날짜를 묻지 않는다 ─────────────────────────
  await card(T_PRODUCT).getByRole('button', { name: '지원하기' }).click()
  await expect(modal.getByText('방문이 없는 캠페인이에요', { exact: false })).toBeVisible()
  await expect(modal.getByRole('button', { name: dow(D1) })).toHaveCount(0)
  await shot(page, 'd32-1-modal-product')
  await modal.getByRole('button', { name: '지원하기' }).click()
  await expect(card(T_PRODUCT).getByRole('button', { name: '지원함' })).toBeVisible({ timeout: 20_000 })
  await shot(page, 'd32-1-applied')

  // ── 4) DB — 화면 말고 값을 본다 ─────────────────────────────────
  const { data: rows } = await db
    .from('proposals')
    .select('id, campaign_id, advertiser_id, influencer_id, status, initiated_by, advertiser_confirmed, influencer_confirmed, proposed_date, message')
    .in('campaign_id', madeCampaigns)
  expect(rows?.length, 'campaign_id 가 붙은 proposals 2행').toBe(2)

  const region = rows!.find((r) => r.campaign_id === madeCampaigns[0])!
  expect(region.advertiser_id).toBe(advId)
  expect(region.influencer_id).toBe(infId)
  expect(region.initiated_by).toBe('influencer')
  expect(region.influencer_confirmed, '지원 = 인플루언서는 이미 하겠다고 한 것').toBe(true)
  expect(region.advertiser_confirmed, '광고주 칸은 2절에서 채운다').toBeFalsy()
  expect(region.status).toBe('pending')
  expect(region.proposed_date, '고른 두 번째 날짜가 그대로 들어갔나').toBe(D2)
  expect(region.message).toBe('봇검증 지원 메시지')

  const product = rows!.find((r) => r.campaign_id === madeCampaigns[1])!
  expect(product.proposed_date, '방문 없는 캠페인은 콘텐츠 등록 시작일').toBe(CONTENT_START)

  const { data: msgs } = await db.from('messages').select('sender_id, receiver_id, content').eq('proposal_id', region.id)
  expect(msgs?.length, '기본 한 줄 + 하고 싶은 말 한 줄').toBe(2)
  expect(msgs![0].sender_id).toBe(infId)
  expect(msgs![0].receiver_id).toBe(advId)

  const { data: noti } = await db
    .from('notifications')
    .select('user_id, type, title, link')
    .in('ref_id', rows!.map((r) => r.id))
  expect(noti?.length).toBe(2)
  expect(noti!.every((n) => n.user_id === advId), '알림은 광고주에게').toBe(true)
  expect(noti!.every((n) => n.type === 'campaign_applied')).toBe(true)
  expect(noti![0].link).toContain('/advertiser/campaigns/')

  // 지원자 본인에게 「새 대시가 도착했습니다」가 가면 방향이 반대다.
  // proposals INSERT 마다 도는 레거시 트리거가 그랬고, 0099 에서 지웠다.
  const { data: wrongWay } = await db
    .from('notifications')
    .select('id, type, title')
    .eq('user_id', infId)
    .eq('type', 'dash_received')
    .gte('created_at', startedAt)
  expect(wrongWay?.length, '내가 지원했는데 나에게 대시 알림이 오면 안 된다(0099)').toBe(0)

  // ── 5) 크레딧 ───────────────────────────────────────────────────
  const after = await ledger(advId)
  expect(after.length, '지원은 광고주 크레딧을 건드리지 않는다').toBe(before.length)

  // ── 6) 두 번 지원 못 한다 ───────────────────────────────────────
  // 화면: 새로고침 후에도 「지원함」
  await page.reload()
  await page.getByPlaceholder('예: 팝업스토어, 신제품').fill('봇검증')
  await page.getByRole('button', { name: '캠페인 검색' }).click()
  await expect(card(T_REGION).getByRole('button', { name: '지원함' })).toBeVisible({ timeout: 20_000 })
  // DB: 함수를 직접 두 번째로 불러도 막힌다(창 두 개는 화면으로 못 막는다)
  const { error: dupErr } = await db.rpc('apply_to_campaign', {
    p_influencer_id: infId,
    p_campaign_id: madeCampaigns[0],
    p_message: null,
    p_date: D2,
  })
  expect(dupErr?.message ?? '').toContain('이미 지원한 캠페인이에요')

  // 날짜 불일치도 함수가 막는다(모달을 우회해도)
  const { error: badDate } = await db.rpc('apply_to_campaign', {
    p_influencer_id: advId, // 아무 계정이나 — 날짜 검사에 먼저 걸린다
    p_campaign_id: madeCampaigns[0],
    p_message: null,
    p_date: ymd(3),
  })
  expect(badDate?.message ?? '', '본인 캠페인 검사가 먼저 걸린다').toContain('본인 캠페인')

  await ctx.close()
})

test('D32-1 광고주 알림함에 지원이 보인다', async ({ browser }) => {
  const { ctx, page } = await loginAs(browser, ADV_EMAIL, PASSWORD, '**/advertiser/dashboard')
  await page.goto('/advertiser/notifications')
  await expect(page.getByText('캠페인에 지원이 들어왔어요').first()).toBeVisible({ timeout: 20_000 })
  await shot(page, 'd32-1-adv-noti')

  // 알림을 눌러 캠페인 상세로 — 2절이 붙을 자리를 눈으로 본다
  await page.getByText('캠페인에 지원이 들어왔어요').first().click()
  await page.waitForURL('**/advertiser/campaigns/**', { timeout: 20_000 })
  await shot(page, 'd32-1-adv-campaign-detail')
  await ctx.close()
})

// ── D32 2절 — 광고주가 고른다 ────────────────────────────────────────
//
// 보는 것:
//   1) 딜시트 표 위에 지원자 카드가 따로 있다 (전에는 확정 전후가 같은 줄이었다)
//   2) 확정하면 그 줄이 지원자 목록에서 빠지고 딜시트 표로 내려간다
//   3) DB — advertiser_confirmed / status 가 실제로 바뀐다
//   4) 확정 알림이 인플루언서에게 「한 줄만」 간다 (레거시 트리거가 살아 있으면 두 줄이 된다)
//   5) 반려 — 사유 없이도 되고, 적으면 줄에 남는다
//   6) 모집 인원이 차도 자동으로 안 닫힌다. 배너만 뜨고 광고주가 눌러야 닫힌다
//   7) 닫으면 0100 가드가 새 지원을 막는다
test('D32-2 광고주가 지원자를 확정한다', async ({ browser }) => {
  const db = serviceClient()
  const startedAt = new Date().toISOString()
  const { data: infProfile } = await db.from('profiles').select('name').eq('id', infId).maybeSingle()
  const infName = infProfile?.name ?? ''

  const { ctx, page } = await loginAs(browser, ADV_EMAIL, PASSWORD, '**/advertiser/dashboard')
  await page.goto(`/advertiser/campaigns/${madeCampaigns[0]}`)

  // ── 1) 지원자 카드 ──────────────────────────────────────────────
  const applicantCard = page.locator('div[class*="rounded-[14px]"]').filter({ hasText: '지원자' }).first()
  await expect(applicantCard.getByText('지원자 1명')).toBeVisible({ timeout: 20_000 })
  await expect(applicantCard.getByText('0 / 3명')).toBeVisible()
  if (infName) await expect(applicantCard.getByText(infName, { exact: false })).toBeVisible()
  await expect(applicantCard.getByText('봇검증 지원 메시지', { exact: false })).toBeVisible()
  await shot(page, 'd32-2-applicants')

  // 지원자는 아직 딜시트 표에 없다 — 이게 2절의 핵심이다.
  await expect(page.getByText('아직 참여한 인플루언서가 없어요')).toBeVisible()

  // ── 2) 확정 ─────────────────────────────────────────────────────
  await applicantCard.getByRole('button', { name: '확정' }).click()
  // 마지막 지원자를 처리하면 카드 자체가 사라진다(모집 인원도 아직 안 찼다).
  await expect(page.getByText('지원자 1명')).toHaveCount(0, { timeout: 20_000 })
  await expect(page.getByText('아직 참여한 인플루언서가 없어요')).toHaveCount(0)
  if (infName) await expect(page.getByText(infName, { exact: false }).first()).toBeVisible()
  await shot(page, 'd32-2-confirmed')

  // ── 3) DB ───────────────────────────────────────────────────────
  const { data: row } = await db
    .from('proposals')
    .select('id, advertiser_confirmed, influencer_confirmed, status, reject_reason')
    .eq('campaign_id', madeCampaigns[0])
    .single()
  expect(row!.advertiser_confirmed, '광고주 칸이 켜졌나').toBe(true)
  expect(row!.influencer_confirmed, '인플루언서 칸은 지원할 때부터 켜져 있었다').toBe(true)
  expect(row!.status).toBe('accepted')
  expect(row!.reject_reason).toBeNull()

  // ── 4) 확정 알림 — 한 줄인가 ────────────────────────────────────
  // 양쪽 확정 시 도는 레거시 트리거가 0099 이후 살아 있으면 여기가 2가 된다.
  const { data: made } = await db
    .from('notifications')
    .select('id, type, title, link, ref_id')
    .eq('user_id', infId)
    .eq('type', 'deal_made')
    .gte('created_at', startedAt)
  expect(made?.length, '확정 알림이 두 줄이면 레거시 트리거가 아직 산다').toBe(1)
  expect(made![0].title).toBe('캠페인 참여가 확정됐어요')
  expect(made![0].ref_id, '레거시 줄은 ref_id 가 비어 있었다').toBe(row!.id)
  expect(made![0].link).toContain(`/influencer/deals/${row!.id}`)

  await ctx.close()
})

test('D32-2 광고주가 지원자를 반려한다', async ({ browser }) => {
  const db = serviceClient()
  const startedAt = new Date().toISOString()

  const { ctx, page } = await loginAs(browser, ADV_EMAIL, PASSWORD, '**/advertiser/dashboard')
  await page.goto(`/advertiser/campaigns/${madeCampaigns[1]}`) // 제품 캠페인

  const applicantCard = page.locator('div[class*="rounded-[14px]"]').filter({ hasText: '지원자' }).first()
  await expect(applicantCard.getByText('지원자 1명')).toBeVisible({ timeout: 20_000 })

  await applicantCard.getByRole('button', { name: '반려' }).click()
  const reasonBox = applicantCard.getByPlaceholder('반려 사유 (선택) — 안 적어도 됩니다')
  await expect(reasonBox).toBeVisible()
  await shot(page, 'd32-2-reject-open')
  await reasonBox.fill('봇검증 반려 사유')
  await applicantCard.getByRole('button', { name: '반려하기' }).click()
  await expect(page.getByText('지원자 1명')).toHaveCount(0, { timeout: 20_000 })
  // 반려한 줄은 딜시트 표에도 안 내려간다.
  await expect(page.getByText('아직 참여한 인플루언서가 없어요')).toBeVisible()
  await shot(page, 'd32-2-rejected')

  const { data: row } = await db
    .from('proposals')
    .select('id, status, reject_reason, advertiser_confirmed, influencer_confirmed')
    .eq('campaign_id', madeCampaigns[1])
    .single()
  expect(row!.status).toBe('rejected')
  expect(row!.reject_reason).toBe('봇검증 반려 사유')
  expect(row!.advertiser_confirmed).toBeFalsy()
  // 「하겠다」고 했던 사실은 사실대로 남긴다 — 상태만 반려다.
  expect(row!.influencer_confirmed).toBe(true)

  const { data: noti } = await db
    .from('notifications')
    .select('type, title, body, link')
    .eq('user_id', infId)
    .eq('type', 'campaign_rejected')
    .gte('created_at', startedAt)
  expect(noti?.length).toBe(1)
  expect(noti![0].title).toBe('아쉽게도 이번 캠페인은 함께하지 못하게 됐어요')
  expect(noti![0].body, '적은 사유가 알림에 실린다').toContain('봇검증 반려 사유')
  expect(noti![0].link).toBe('/influencer/proposals')

  await ctx.close()
})

// ── 반려당한 쪽에서 본 화면 ──────────────────────────────────────────
//
// 알림은 지나가면 사라진다. 사유는 다음 지원에 참고할 값이라 줄에 남아야 하고,
// 반려는 그 캠페인이 끝났다는 뜻이 아니라 다시 지원할 수 있어야 한다.
//
// ⚠️ 재지원은 0101 을 실행해야 통과한다. 그 전에는 apply_to_campaign 의 중복 가드가
//    반려된 줄까지 「이미 지원한 캠페인이에요」로 막는다.
test('D32-2 반려된 지원 — 사유가 남고 다시 지원할 수 있다', async ({ browser }) => {
  const db = serviceClient()
  const startedAt = new Date().toISOString()
  const { data: before } = await db
    .from('proposals')
    .select('id, created_at')
    .eq('campaign_id', madeCampaigns[1])
    .single()

  const { ctx, page } = await loginAs(browser, INF_EMAIL, PASSWORD, '**/influencer/dashboard')

  // ── 사유가 목록 줄에 붙어 있나 ──────────────────────────────────
  await page.goto('/influencer/proposals')
  await page.getByRole('button', { name: '거절됨' }).click()
  const row = page.locator('div.rounded-2xl').filter({ hasText: '봇검증브랜드' }).first()
  await expect(row.getByText('반려', { exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(row.getByText('봇검증 반려 사유')).toBeVisible()
  await shot(page, 'd32-2-inf-reject-reason')

  // ── 버튼이 「다시 지원」인가 ────────────────────────────────────
  await page.goto('/influencer/search')
  await page.getByPlaceholder('예: 팝업스토어, 신제품').fill('봇검증')
  await page.getByRole('button', { name: '캠페인 검색' }).click()
  const card = (title: string) => page.locator('div[class*="border-amber-400"]').filter({ hasText: title })
  const modal = page.locator('div.max-w-\\[380px\\]')
  await expect(card(T_PRODUCT).getByRole('button')).toHaveText('다시 지원', { timeout: 20_000 })
  await expect(card(T_PRODUCT).getByRole('button')).toBeEnabled()
  // 확정된 쪽은 그대로 「지원함」이다 — 반려된 줄만 열린다.
  await expect(card(T_REGION).getByRole('button')).toHaveText('지원함')
  await shot(page, 'd32-2-reapply-button')

  // ── 다시 지원 ───────────────────────────────────────────────────
  await card(T_PRODUCT).getByRole('button', { name: '다시 지원' }).click()
  await modal.getByPlaceholder('어떤 콘텐츠로 참여할지 짧게 적어주세요').fill('봇검증 재지원 메시지')
  await modal.getByRole('button', { name: '지원하기' }).click()
  await expect(card(T_PRODUCT).getByRole('button', { name: '지원함' })).toBeVisible({ timeout: 20_000 })

  // ── DB — 줄이 늘지 않고 그 줄이 다시 쓰였나 ─────────────────────
  const { data: rows } = await db
    .from('proposals')
    .select('id, status, reject_reason, advertiser_confirmed, influencer_confirmed, message, created_at')
    .eq('campaign_id', madeCampaigns[1])
  expect(rows?.length, '한 캠페인에 한 사람은 한 줄 — 재지원이 줄을 늘리면 지원자 목록에 두 번 뜬다').toBe(1)
  const after = rows![0]
  expect(after.id, '같은 줄을 고쳐 쓴다').toBe(before!.id)
  expect(after.status).toBe('pending')
  expect(after.reject_reason, 'pending 으로 돌아온 줄에 옛 사유가 남으면 안 된다').toBeNull()
  expect(after.advertiser_confirmed, '광고주는 다시 판단해야 한다').toBeFalsy()
  expect(after.influencer_confirmed).toBe(true)
  expect(after.message).toBe('봇검증 재지원 메시지')
  expect(
    new Date(after.created_at).getTime() > new Date(before!.created_at).getTime(),
    '지원 날짜도 새 날짜다 — 안 그러면 광고주 카드에 옛 날짜가 「지원」으로 찍힌다',
  ).toBe(true)

  // 광고주는 새 지원 알림을 다시 받는다(같은 캠페인이라도 새로 들어온 지원이다).
  const { data: noti } = await db
    .from('notifications')
    .select('id')
    .eq('user_id', advId)
    .eq('type', 'campaign_applied')
    .gte('created_at', startedAt)
  expect(noti?.length, '재지원도 광고주에게 알린다').toBe(1)

  await ctx.close()
})

test('D32-2 모집은 광고주가 닫는다', async ({ browser }) => {
  const db = serviceClient()

  // 앞 테스트에서 한 명 확정됐다. 모집 인원을 1로 낮춰 「도달」 상태를 만든다.
  const { error: tgtErr } = await db
    .from('campaigns').update({ recruit_target: 1 }).eq('id', madeCampaigns[0])
  expect(tgtErr, '모집 인원 조정').toBeNull()

  const { ctx, page } = await loginAs(browser, ADV_EMAIL, PASSWORD, '**/advertiser/dashboard')
  await page.goto(`/advertiser/campaigns/${madeCampaigns[0]}`)

  // ── 6) 인원이 차도 자동으로 안 닫힌다 — 알리기만 한다 ───────────
  await expect(page.getByText('1명 확정 · 모집 인원 도달')).toBeVisible({ timeout: 20_000 })
  const { data: stillOpen } = await db
    .from('campaigns').select('recruit_closed_at').eq('id', madeCampaigns[0]).single()
  expect(stillOpen!.recruit_closed_at, '배너만 뜰 뿐 아직 안 닫혔다').toBeNull()
  await shot(page, 'd32-2-target-reached')

  await page.getByRole('button', { name: '모집 마감' }).click()
  await expect(page.getByText('1명 확정 · 모집 인원 도달')).toHaveCount(0, { timeout: 20_000 })
  await shot(page, 'd32-2-closed')

  const { data: closed } = await db
    .from('campaigns').select('recruit_closed_at').eq('id', madeCampaigns[0]).single()
  expect(closed!.recruit_closed_at, '광고주가 누른 뒤에야 시각이 찍힌다').not.toBeNull()

  // ── 7) 닫힌 캠페인엔 함수가 새 지원을 안 받는다 (0100 가드) ──────
  // 이미 지원한 계정이지만, 0100 가드가 중복 검사보다 앞에 있어 마감 문구가 먼저 나온다.
  const { error: closedErr } = await db.rpc('apply_to_campaign', {
    p_influencer_id: infId,
    p_campaign_id: madeCampaigns[0],
    p_message: null,
    p_date: D2,
  })
  expect(closedErr?.message ?? '').toContain('모집이 마감된 캠페인이에요')

  await ctx.close()
})

test('D32-2 마감한 캠페인은 검색에서 「모집 종료」', async ({ browser }) => {
  const db = serviceClient()

  // T_CLOSED 는 지금까지 신청기간(recruit_end)이 지나서 닫혀 있었다.
  // 신청기간을 미래로 되돌리고 recruit_closed_at 만 채워서, 「광고주가 닫았다」 하나만 남긴다.
  const { error } = await db
    .from('campaigns')
    .update({ recruit_end: ymd(20), recruit_closed_at: new Date().toISOString() })
    .eq('id', madeCampaigns[2])
  expect(error, 'T_CLOSED 를 recruit_closed_at 로만 닫기').toBeNull()

  const { ctx, page } = await loginAs(browser, INF_EMAIL, PASSWORD, '**/influencer/dashboard')
  await page.goto('/influencer/search')
  await page.getByPlaceholder('예: 팝업스토어, 신제품').fill('봇검증')
  await page.getByRole('button', { name: '캠페인 검색' }).click()

  const card = (title: string) => page.locator('div[class*="border-amber-400"]').filter({ hasText: title })
  await expect(card(T_CLOSED).getByRole('button')).toHaveText('모집 종료', { timeout: 20_000 })
  await expect(card(T_CLOSED).getByRole('button')).toBeDisabled()
  await shot(page, 'd32-2-search-closed')

  await ctx.close()
})
