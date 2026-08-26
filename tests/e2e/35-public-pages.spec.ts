import { test, expect } from '@playwright/test'
import { serviceClient, shot, userIdByEmail, finding } from './_helpers'

// D30 [2] — 공개 페이지. 「/campaigns/[id] · /opens/[id] · /advertiser/[id] 로그아웃 상태에서」.
//
// 이 세 URL 은 검색엔진과 비회원이 같이 보는 자리다(D22 A-0). 그래서 두 가지를 같이 본다 —
//   열려야 할 것이 열리는가 (공개로 켠 것)
//   닫혀야 할 것이 닫히는가 (공개를 끈 것 · 검색 노출을 끈 것)
// 두 번째가 더 중요하다. 여기가 새면 끄고 있다고 믿는 사람의 정보가 그대로 나간다.
//
// ⚠️ 로그인하지 않은 새 컨텍스트로만 연다. 저장된 세션을 쓰면 CTA 분기가 로그인 쪽으로 갈라져
//    비회원이 보는 화면을 확인할 수 없다.
// ⚠️ 시드한다 — 공개/비공개 캠페인 2건, 공개/검색차단 오픈 2건. afterAll 에서 되돌린다.
//    오픈 등록은 is_public 이면 인플루언서에게 1,000C 가 나간다(0018) — 원장도 같이 되돌린다.

const TAG = '[봇검증]'
const ADV_EMAIL = 'bot+adv-40060863@matchpost.kr'
const INF_EMAIL = 'bot+inf-pc-40060863@matchpost.kr'

const TOP_UP_MEMO = '[봇검증] 시드용 임시 충전 — 정리 때 상계'
const REVERSE_MEMO = '[봇검증] 시드 되돌림 — 원장은 append-only 라 삭제 대신 역행 한 줄'

const T_CAMP_OPEN = `${TAG} 공개 캠페인`
const T_CAMP_HIDDEN = `${TAG} 비공개 캠페인`
const T_OPEN_SEO = `${TAG} 검색에 여는 오픈`
const T_OPEN_HIDDEN = `${TAG} 검색을 끈 오픈`

const MISSING_ID = '00000000-0000-4000-8000-000000000000'

const plus = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

let advId = ''
let infId = ''
let infName = ''
let advTitle = ''
let campOpen = ''
let campHidden = ''
let openSeo = ''
let openHidden = ''
let seededAt = ''
const madeCampaigns: string[] = []
const madeSchedules: string[] = []

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  const db = serviceClient()
  advId = await userIdByEmail(ADV_EMAIL)
  infId = await userIdByEmail(INF_EMAIL)

  const { data: infProf } = await db.from('profiles').select('name').eq('id', infId).single()
  infName = (infProf?.name as string | null) || ''

  // 광고주 공개 페이지의 h1 은 회사 상호 우선, 없으면 계정 이름이다.
  const { data: advProf } = await db.from('profiles').select('name').eq('id', advId).single()
  const { data: ap } = await db
    .from('advertiser_profiles').select('company_name').eq('user_id', advId).maybeSingle()
  advTitle = (ap?.company_name as string | null) || (advProf?.name as string | null) || '광고주'

  // 캠페인 5,000 + 오픈 2건 2,000 이 나간다 — 잔액이 모자라면 시드 자체가 막힌다.
  for (const [uid, amount] of [[advId, 8_000], [infId, 4_000]] as const) {
    const { error } = await db.rpc('credit_ledger_grant', {
      p_user_id: uid, p_amount: amount, p_kind: 'admin',
      p_reason_code: 'admin_grant', p_memo: TOP_UP_MEMO,
    })
    if (error) throw new Error(`시드용 충전 실패: ${error.message}`)
  }
  // ⚠️ 기준선은 DB 가 찍은 시각으로 — 이 PC 시계가 Supabase 보다 앞선다.
  const { data: seedRow } = await db
    .from('credit_ledger').select('created_at')
    .eq('user_id', advId).eq('memo', TOP_UP_MEMO)
    .order('created_at', { ascending: false }).limit(1).single()
  if (!seedRow) throw new Error('시드 충전 줄을 못 찾았어요 — 원장 기준선을 세울 수 없습니다')
  seededAt = seedRow.created_at

  const campaign = (title: string, isPublic: boolean) => ({
    advertiser_id: advId,
    manager_id: advId,
    title,
    brand_name: '봇검증브랜드',
    campaign_type: '제품',
    channels: ['인스타그램'],
    content_counts: { 인스타그램: 1 },
    missions: { 인스타그램: {} },
    options: [],
    dates: [],
    date: null,
    budget_total: 1_000_000,
    recruit_start: plus(-1),
    recruit_end: plus(20),
    content_start: plus(21),
    content_end: plus(28),
    payment_term_type: 'after_publish_days',
    payment_term_value: 30,
    payment_methods: ['계좌이체'],
    predefined_categories: ['여행'],
    details: '봇검증용 캠페인입니다. 확인 후 삭제됩니다.',
    is_public: isPublic,
    status: 'open',
    recruit_target: 1,
    stage_pre_confirm: false,
    stage_post_edit: false,
  })

  const { data: camps, error: cErr } = await db
    .from('campaigns')
    .insert([campaign(T_CAMP_OPEN, true), campaign(T_CAMP_HIDDEN, false)])
    .select('id, title')
  if (cErr) throw new Error(`캠페인 시드 실패: ${cErr.message}`)
  campOpen = camps!.find((c) => c.title === T_CAMP_OPEN)!.id
  campHidden = camps!.find((c) => c.title === T_CAMP_HIDDEN)!.id
  madeCampaigns.push(campOpen, campHidden)

  // schedules 는 (influencer_id, date) 유니크 — 두 오픈의 날짜를 반드시 다르게 둔다.
  const openRow = (title: string, date: string, seoPublic: boolean) => ({
    influencer_id: infId,
    title,
    date,
    date_end: null,
    location_city: '서울',
    location_district: '강남구',
    predefined_categories: ['여행'],
    free_tags: [],
    channels: ['인스타그램'],
    is_public: true,
    seo_public: seoPublic,
    status: 'open',
  })
  const { data: opens, error: oErr } = await db
    .from('schedules')
    .insert([openRow(T_OPEN_SEO, plus(55), true), openRow(T_OPEN_HIDDEN, plus(56), false)])
    .select('id, title')
  if (oErr) throw new Error(`오픈 시드 실패: ${oErr.message}`)
  openSeo = opens!.find((o) => o.title === T_OPEN_SEO)!.id
  openHidden = opens!.find((o) => o.title === T_OPEN_HIDDEN)!.id
  madeSchedules.push(openSeo, openHidden)

  console.log(`[시드] 캠페인 2건(공개/비공개) · 오픈 2건(검색공개/검색차단)`)
})

test.afterAll(async () => {
  const db = serviceClient()
  const refs = [...madeCampaigns, ...madeSchedules]
  if (refs.length > 0) {
    const { data: n } = await db.from('notifications').delete().in('ref_id', refs).select('id')
    console.log(`[정리] 알림 ${n?.length ?? 0}줄`)
  }
  if (madeSchedules.length > 0) {
    const { data, error } = await db.from('schedules').delete().in('id', madeSchedules).select('id')
    if (error) console.log(`[정리] ⚠️ 오픈 삭제 실패: ${error.message}`)
    else console.log(`[정리] 오픈 ${data?.length ?? 0}줄`)
  }
  if (madeCampaigns.length > 0) {
    const { data, error } = await db.from('campaigns').delete().in('id', madeCampaigns).select('id')
    if (error) console.log(`[정리] ⚠️ 캠페인 삭제 실패: ${error.message}`)
    else console.log(`[정리] 캠페인 ${data?.length ?? 0}줄`)
  }
  const { data: strays } = await db
    .from('notifications').select('id')
    .or('body.ilike.%봇검증%,title.ilike.%봇검증%')
  if ((strays ?? []).length > 0) await db.from('notifications').delete().in('id', strays!.map((s) => s.id))

  // 원장은 append-only(0034) — 반대 부호 한 줄로 잔액만 제자리로 돌린다.
  const undo = async (userId: string, label: string, refIds: string[], fallbackCode: string) => {
    const deltas: number[] = []
    if (refIds.length > 0) {
      const { data } = await db
        .from('credit_ledger').select('delta')
        .eq('user_id', userId).in('ref_id', refIds).gte('created_at', seededAt)
      deltas.push(...(data ?? []).map((r) => r.delta))
    }
    const { data: tops } = await db
      .from('credit_ledger').select('delta')
      .eq('user_id', userId).eq('memo', TOP_UP_MEMO).gte('created_at', seededAt)
    deltas.push(...(tops ?? []).map((r) => r.delta))

    const net = deltas.reduce((s, d) => s + d, 0)
    if (net === 0) { console.log(`[정리] 원장(${label}) — 건드린 것 없음`); return }
    const back = net > 0
      ? db.rpc('credit_ledger_penalty', { p_user_id: userId, p_amount: net, p_reason_code: 'admin_deduct', p_memo: REVERSE_MEMO })
      : db.rpc('credit_ledger_refund', { p_user_id: userId, p_amount: -net, p_reason_code: fallbackCode, p_memo: REVERSE_MEMO })
    const { error } = await back
    if (error) console.log(`[정리] ⚠️ 원장(${label}) 되돌리기 실패: ${error.message}`)
    else console.log(`[정리] 원장(${label}) — 순증감 ${net > 0 ? '+' : ''}${net}, 반대로 ${net > 0 ? '차감' : '환급'} ${Math.abs(net)}`)
  }
  await undo(advId, '광고주', madeCampaigns, 'create_campaign')
  await undo(infId, '인플루언서', madeSchedules, 'open_schedule')
})

// ── 1) 공개 캠페인 ─────────────────────────────────────────────────
test('D30-35-1 공개 캠페인은 로그아웃 상태에서 열리고 로그인으로 안내한다', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  const res = await page.goto(`/campaigns/${campOpen}`)
  expect(res?.status(), '공개 캠페인 응답').toBe(200)
  await expect(page.getByRole('heading', { name: T_CAMP_OPEN })).toBeVisible({ timeout: 25_000 })
  await shot(page, 'd30-35-1-campaign-public')

  // 로그인으로 튕기지 않아야 한다 — 비회원이 보는 페이지다.
  expect(page.url(), '비회원인데 로그인으로 튕겼나').toContain(`/campaigns/${campOpen}`)

  const cta = page.getByRole('link', { name: '로그인하고 참여하기' })
  await expect(cta, '비회원용 CTA').toBeVisible()
  await expect(cta).toHaveAttribute('href', '/login')

  await ctx.close()
})

// ── 2) 비공개 캠페인 ───────────────────────────────────────────────
test('D30-35-2 공개를 끈 캠페인은 로그아웃 상태에서 열리지 않는다', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  const res = await page.goto(`/campaigns/${campHidden}`)
  await page.waitForLoadState('domcontentloaded')
  await shot(page, 'd30-35-2-campaign-hidden')

  if (res?.status() === 200) {
    finding('결함', '비공개 캠페인 공개 URL',
      `공개를 끈 캠페인인데 /campaigns/{id} 가 200 으로 열립니다. 링크만 알면 누구나 볼 수 있다는 뜻이라, ` +
      `공개 토글을 끈 광고주의 기대와 어긋납니다.`)
  }
  expect(res?.status(), '비공개 캠페인 응답').toBe(404)
  await expect(page.getByText(T_CAMP_HIDDEN), '비공개 캠페인 제목이 새어나갔나').toHaveCount(0)

  const missing = await page.goto(`/campaigns/${MISSING_ID}`)
  expect(missing?.status(), '없는 캠페인 응답').toBe(404)

  await ctx.close()
})

// ── 3) 오픈 — 검색 노출을 켠 것만 열린다 ───────────────────────────
test('D30-35-3 오픈은 검색 노출을 켠 것만 열리고, 신원 정보는 나오지 않는다', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  const res = await page.goto(`/opens/${openSeo}`)
  expect(res?.status(), '검색 공개 오픈 응답').toBe(200)
  await expect(page.getByRole('heading', { name: T_OPEN_SEO })).toBeVisible({ timeout: 25_000 })
  await shot(page, 'd30-35-3-open-public')

  const cta = page.getByRole('link', { name: '로그인하고 연락하기' })
  await expect(cta, '비회원용 CTA').toBeVisible()
  await expect(cta).toHaveAttribute('href', '/login')

  // 이 페이지는 「인플루언서 이름·채널 URL·연락처는 조인조차 하지 않는다」고 스스로 적어 두었다.
  if (infName) {
    const body = await page.locator('body').innerText()
    if (body.includes(infName)) {
      finding('결함', '오픈 공개 페이지 신원 노출',
        `로그인하지 않은 상태의 /opens/{id} 본문에 인플루언서 이름「${infName}」이 그대로 나옵니다. ` +
        `이 페이지는 검색엔진이 그대로 읽는 자리라, 이름이 붙으면 날짜·지역과 함께 색인됩니다.`)
    }
    expect(body.includes(infName), '오픈 공개 페이지에 인플루언서 이름이 나왔나').toBe(false)
  } else {
    console.log('[미검증] 봇 인플루언서 이름이 비어 있어 신원 노출 여부를 확인하지 못했습니다')
  }

  // 검색 노출을 끈 오픈
  const hidden = await page.goto(`/opens/${openHidden}`)
  await page.waitForLoadState('domcontentloaded')
  await shot(page, 'd30-35-3-open-hidden')
  if (hidden?.status() === 200) {
    finding('결함', '검색 노출을 끈 오픈',
      `인플루언서가 검색 노출(seo_public)을 껐는데 /opens/{id} 가 200 으로 열립니다. ` +
      `끄고 있다고 믿는 사람의 날짜·지역이 링크 하나로 공개됩니다.`)
  }
  expect(hidden?.status(), '검색 차단 오픈 응답').toBe(404)
  await expect(page.getByText(T_OPEN_HIDDEN), '검색 차단 오픈 제목이 새어나갔나').toHaveCount(0)

  await ctx.close()
})

// ── 4) 광고주 공개 페이지 ──────────────────────────────────────────
test('D30-35-4 광고주 공개 페이지는 로그아웃 상태에서 열리고 연락처는 옵트인 없이 안 보인다', async ({ browser }) => {
  const db = serviceClient()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  const res = await page.goto(`/advertiser/${advId}`)
  expect(res?.status(), '광고주 공개 페이지 응답').toBe(200)
  await expect(page.getByRole('heading', { name: advTitle }).first()).toBeVisible({ timeout: 25_000 })
  await shot(page, 'd30-35-4-advertiser')

  // 연락처는 「대행 문의 받기(marketing_contact_public)」를 켠 계정만 노출한다.
  const { data: ap } = await db
    .from('advertiser_profiles')
    .select('marketing_contact_public, marketing_email, marketing_phone')
    .eq('user_id', advId).maybeSingle()
  const optedIn = !!ap?.marketing_contact_public
  const { data: priv } = await db.from('user_private').select('email').eq('user_id', advId).maybeSingle()
  const { data: prof } = await db.from('profiles').select('manager_phone').eq('id', advId).single()

  const body = await page.locator('body').innerText()
  const secrets = [priv?.email, prof?.manager_phone].filter(Boolean) as string[]
  if (!optedIn) {
    for (const s of secrets) {
      if (body.includes(s)) {
        finding('결함', '광고주 공개 페이지 연락처 노출',
          `대행 문의 받기를 켜지 않았는데 로그아웃 상태의 /advertiser/{id} 에 등록 연락처「${s}」가 보입니다. ` +
          `가입할 때 적은 값이 공개 페이지로 새는 자리입니다.`)
      }
      expect(body.includes(s), `연락처(${s}) 노출 여부`).toBe(false)
    }
    console.log(`[공개] 대행 문의 받기 꺼짐 — 연락처 ${secrets.length}건이 안 보이는 것을 확인했습니다`)
  } else {
    console.log('[미검증] 이 계정은 대행 문의 받기를 켜 둔 상태라 「안 보여야 한다」를 확인하지 못했습니다')
  }

  // 없는 사람
  const missing = await page.goto(`/advertiser/${MISSING_ID}`)
  expect(missing?.status(), '없는 광고주 응답').toBe(404)

  // 이 URL 에는 공개 여부 조건이 없다(profiles 만 보고 notFound). 인플루언서 id 를 넣으면 어떻게 되는가 —
  // 실패로 세우지는 않는다. 판단이 필요한 자리라 발견으로만 남긴다.
  const asInf = await page.goto(`/advertiser/${infId}`)
  if (asInf?.status() === 200) {
    finding('직관', '광고주 공개 페이지 — 역할 확인 없음',
      `/advertiser/{id} 가 profiles 만 보고 열려서, 인플루언서 계정 id 를 넣어도 「광고주 페이지」가 그려집니다. ` +
      `인플루언서 이름이 광고주 상호 자리에 오고 정산 성실도 같은 광고주 지표가 빈 채로 붙습니다. ` +
      `role 을 확인해 광고주가 아니면 notFound 로 두는 편이 읽는 사람에게 정직합니다.`)
    await shot(page, 'd30-35-4-advertiser-as-influencer')
  }

  await ctx.close()
})
