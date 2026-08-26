import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { serviceClient, loginAs, shot, userIdByEmail, ensureBotAdmin, finding, loadEnvLocal, ADMIN, PASSWORD } from './_helpers'

// D30 [2] — 관리자. 「「오늘」 큐 숫자 = 실제 건수 · 신고 종결 · 크레딧 지급」.
//
// ⚠️ 기존 관리자 계정으로는 로그인조차 하지 않는다(사용자 지시). 봇 전용 관리자를 쓴다.
// ⚠️ 시드한다 — 캠페인 1건 + 그 캠페인에 대한 미입금 신고 1건. afterAll 에서 되돌린다.
//
// 보는 것:
//   1) 「오늘」의 큐 4칸이 DB 실제 건수와 같다 (미입금 신고 · 사업자 확인 · 결제 지연 · 시스템)
//   2) 시드한 신고가 「지금 처리할 것」 목록에 실제로 올라온다
//   3) 사유 없이 종결하면 막힌다 · 사유를 적으면 status='closed' 와 close_reason 이 남는다
//   4) 종결하면 큐 숫자가 하나 줄어든다 (화면 숫자가 실제를 따라가는가)
//   5) 관리자 크레딧 지급이 원장에 남고 잔액 = 원장 합이 유지된다

const TAG = '[봇검증]'
const ADV_EMAIL = 'bot+adv-40060863@matchpost.kr'
const INF_EMAIL = 'bot+inf-pc-40060863@matchpost.kr'

const TOP_UP_MEMO = '[봇검증] 시드용 임시 충전 — 정리 때 상계'
const REVERSE_MEMO = '[봇검증] 시드 되돌림 — 원장은 append-only 라 삭제 대신 역행 한 줄'
const GRANT_MEMO = `${TAG} 관리자 지급 확인`
const GRANT_AMOUNT = 1_000

const REPORT_BODY = `${TAG} 게재를 마쳤는데 예정일이 지나도 대금이 안 들어왔습니다.`
const CLOSE_REASON = `${TAG} 광고주 입금 확인 — 종결합니다.`

const plus = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const T_CAMP = `${TAG} 신고 대상 캠페인`

// 일반 인플루언서 자격으로 잔액 뷰를 조건 없이 불러 보고, 몇 행이 보이는지 센다.
// ⚠️ service 로 읽으면 RLS 를 지나가버려 대조가 성립하지 않는다 — 반드시 anon 키 + 로그인이어야 한다.
async function balanceRowsAsInfluencer(): Promise<number> {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('.env.local 에 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 필요해요.')
  const sb = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: signInErr } = await sb.auth.signInWithPassword({ email: INF_EMAIL, password: PASSWORD })
  if (signInErr) throw new Error(`인플루언서 로그인 실패: ${signInErr.message}`)
  const { data, error } = await sb.from('credit_balances').select('user_id').limit(500)
  if (error) throw new Error(`잔액 뷰 조회 실패: ${error.message}`)
  return (data ?? []).length
}

let advId = ''
let infId = ''
let infName = ''
let reportId = ''
const madeCampaigns: string[] = []
let seededAt = ''

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  const db = serviceClient()
  await ensureBotAdmin()
  advId = await userIdByEmail(ADV_EMAIL)
  infId = await userIdByEmail(INF_EMAIL)

  const { data: prof } = await db.from('profiles').select('name').eq('id', infId).single()
  infName = (prof?.name as string | null) || ''
  if (!infName) throw new Error('봇 인플루언서 이름을 못 읽었어요 — 크레딧 화면에서 검색할 수 없습니다.')

  const { error: topUpErr } = await db.rpc('credit_ledger_grant', {
    p_user_id: advId,
    p_amount: 6_000,
    p_kind: 'admin',
    p_reason_code: 'admin_grant',
    p_memo: TOP_UP_MEMO,
  })
  if (topUpErr) throw new Error(`시드용 충전 실패: ${topUpErr.message}`)
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

  const { data: camp, error } = await db
    .from('campaigns')
    .insert({
      advertiser_id: advId,
      manager_id: advId,
      title: T_CAMP,
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
      is_public: false,
      status: 'open',
      recruit_target: 1,
      stage_pre_confirm: false,
      stage_post_edit: false,
    })
    .select('id')
    .single()
  if (error) throw new Error(`시드 실패: ${error.message}`)
  madeCampaigns.push(camp.id)

  // 신고는 화면이 아니라 실제 함수로 넣는다 — 관리자 화면이 읽는 모양 그대로여야 대조가 성립한다.
  const { data: rid, error: rErr } = await db.rpc('file_report', {
    p_reporter_id: infId,
    p_source_type: 'campaign',
    p_source_id: camp.id,
    p_type: 'unpaid',
    p_body: REPORT_BODY,
  })
  if (rErr) throw new Error(`신고 시드 실패: ${rErr.message}`)
  reportId = rid as string
  console.log(`[시드] 캠페인 1건 · 미입금 신고 1건(${reportId})`)
})

test.afterAll(async () => {
  const db = serviceClient()
  const wipe = async (
    label: string,
    q: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  ) => {
    const { data, error } = await q
    if (error) console.log(`[정리] ⚠️ ${label} 삭제 실패: ${error.message}`)
    else console.log(`[정리] ${label} ${data?.length ?? 0}줄`)
  }

  if (reportId) {
    // file_report 가 신고자·피신고자 양쪽에 알림을 넣는다(0051) — 같이 지운다.
    await wipe('신고 알림', db.from('notifications').delete().eq('ref_id', reportId).select('id'))
    await wipe('신고', db.from('reports').delete().eq('id', reportId).select('id'))
  }
  if (madeCampaigns.length > 0) {
    await wipe('알림', db.from('notifications').delete().in('ref_id', madeCampaigns).select('id'))
    await wipe('캠페인', db.from('campaigns').delete().in('id', madeCampaigns).select('id'))
    const { data: strays } = await db
      .from('notifications')
      .select('id')
      .or(`body.ilike.%봇검증%,title.ilike.%봇검증%`)
    if ((strays ?? []).length > 0) await db.from('notifications').delete().in('id', strays!.map((s) => s.id))
  }

  // 원장은 append-only(0034) — 반대 부호 한 줄로 잔액만 제자리로 돌린다.
  const undo = async (userId: string, label: string, refs: string[], memos: string[]) => {
    const deltas: number[] = []
    if (refs.length > 0) {
      const { data } = await db
        .from('credit_ledger').select('delta')
        .eq('user_id', userId).in('ref_id', refs).gte('created_at', seededAt)
      deltas.push(...(data ?? []).map((r) => r.delta))
    }
    for (const m of memos) {
      const { data } = await db
        .from('credit_ledger').select('delta')
        .eq('user_id', userId).eq('memo', m).gte('created_at', seededAt)
      deltas.push(...(data ?? []).map((r) => r.delta))
    }
    const net = deltas.reduce((s, d) => s + d, 0)
    if (net === 0) { console.log(`[정리] 원장(${label}) — 건드린 것 없음`); return }
    const back = net > 0
      ? db.rpc('credit_ledger_penalty', { p_user_id: userId, p_amount: net, p_reason_code: 'admin_deduct', p_memo: REVERSE_MEMO })
      : db.rpc('credit_ledger_refund', { p_user_id: userId, p_amount: -net, p_reason_code: 'create_campaign', p_memo: REVERSE_MEMO })
    const { error } = await back
    if (error) console.log(`[정리] ⚠️ 원장(${label}) 되돌리기 실패: ${error.message}`)
    else console.log(`[정리] 원장(${label}) — 순증감 ${net > 0 ? '+' : ''}${net}, 반대로 ${net > 0 ? '차감' : '환급'} ${Math.abs(net)}`)
  }
  await undo(advId, '광고주', madeCampaigns, [TOP_UP_MEMO])
  await undo(infId, '인플루언서', [], [GRANT_MEMO])
})

// ── 1) 큐 4칸 = 실제 건수 ───────────────────────────────────────────
test('D30-33-1 「오늘」의 처리 대기 큐 숫자가 DB 실제 건수와 같다', async ({ browser }) => {
  const db = serviceClient()
  const { ctx, page } = await loginAs(browser, ADMIN.email, ADMIN.password, '**/admin/**')
  await page.goto('/admin/dashboard')
  await expect(page.getByRole('heading', { name: '회원 현황' })).toBeVisible({ timeout: 25_000 })
  await shot(page, 'd30-33-1-today')

  const cards = page.locator('div.grid.grid-cols-4').first().locator('> a, > div')
  await expect(cards).toHaveCount(4)

  const num = async (i: number, label: string) => {
    await expect(cards.nth(i), `${i}번 칸이 「${label}」`).toContainText(label)
    const raw = await cards.nth(i).locator('span.tabular-nums').first().innerText()
    return Number(raw.replace(/[^0-9-]/g, ''))
  }

  // 미입금 신고 — todayQueue 와 같은 조건으로 직접 센다
  const { count: unpaid } = await db
    .from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('type', 'unpaid')
  expect(await num(0, '미입금 신고'), '미입금 신고').toBe(unpaid ?? 0)

  // 사업자 확인 — 승인·반려하면 biz_doc_url 을 지우므로 not null = 대기
  const { count: biz } = await db
    .from('advertiser_profiles').select('user_id', { count: 'exact', head: true }).not('biz_doc_url', 'is', null)
  expect(await num(1, '사업자 확인'), '사업자 확인').toBe(biz ?? 0)

  // 결제 지연 — 판정 규칙(settlementDateOf)을 여기서 다시 구현하면 규칙째로 같이 틀린다.
  // 대신 같은 화면 안에서 두 곳이 어긋나는지를 본다: 카드 숫자 vs 「지금 처리할 것」의 「지연」 줄.
  const overdue = await num(2, '결제 지연')
  const delayRows = await page.getByText('지연', { exact: true }).count()
  if (overdue <= 5) {
    expect(delayRows, '카드의 결제 지연 건수 = 목록에 실제로 그려진 지연 줄').toBe(overdue)
  } else {
    // 목록은 5줄까지만 그린다 — 그 위는 이 화면만으로 대조할 수 없다.
    expect(delayRows, '목록은 5줄까지').toBe(5)
    console.log(`[큐] ⚠️ 결제 지연 ${overdue}건 중 5건만 목록에 보여 나머지는 이 화면에서 미검증`)
  }

  // 시스템 현황 — 건수가 아니라 상태다. 「정상」이면 미등록 배치가 0이어야 하고,
  // 그때 우측 시스템 카드도 「자동 처리 정상」이어야 한다. 두 곳이 엇갈리면 그게 결함이다.
  const sysCard = cards.nth(3)
  await expect(sysCard).toContainText('시스템 현황')
  const sysOk = await sysCard.getByText('정상', { exact: true }).count()
  const rightOk = await page.getByRole('heading', { name: '자동 처리 정상' }).count()
  const rightBad = await page.getByRole('heading', { name: '자동 처리 점검 필요' }).count()
  if (sysOk === 1) {
    expect(rightOk, '큐는 정상인데 우측 시스템 카드는 점검 필요').toBe(1)
    expect(await sysCard.getByText('이상 없음').count()).toBe(1)
    console.log('[큐] 시스템 현황 = 정상 · 우측 카드도 정상')
  } else {
    expect(rightBad, '큐는 크론 미등록인데 우측 카드는 정상').toBe(1)
    const miss = await page.getByText('미등록', { exact: true }).count()
    console.log(`[큐] ⚠️ 크론 미등록 ${miss}건 — 코드에는 있는데 아무도 부르지 않는 자동 처리가 있습니다`)
  }

  console.log(`[큐] 미입금 ${unpaid} · 사업자 ${biz} · 결제지연 ${overdue} — 화면과 일치`)
  await ctx.close()
})

// ── 2) 시드한 신고가 「지금 처리할 것」에 올라온다 ───────────────────
test('D30-33-2 접수된 신고가 「지금 처리할 것」 목록에 나온다', async ({ browser }) => {
  const { ctx, page } = await loginAs(browser, ADMIN.email, ADMIN.password, '**/admin/**')
  await page.goto('/admin/dashboard')
  await expect(page.getByRole('heading', { name: '지금 처리할 것' })).toBeVisible({ timeout: 25_000 })

  const row = page.locator(`a[href="/admin/reports/${reportId}"]`)
  await expect(row, '접수한 신고가 목록에 없습니다').toBeVisible()
  await expect(row).toContainText('대금 미지급')
  await expect(row).toContainText('미입금')
  await shot(page, 'd30-33-2-queue-row')
  console.log('[신고] 「지금 처리할 것」에 미입금 줄 노출 확인')

  await ctx.close()
})

// ── 3) 신고 종결 ────────────────────────────────────────────────────
test('D30-33-3 사유 없이는 종결이 막히고, 사유를 적으면 종결된다', async ({ browser }) => {
  const db = serviceClient()
  const { ctx, page } = await loginAs(browser, ADMIN.email, ADMIN.password, '**/admin/**')

  // 대시보드에서 본 그 신고를 눌러 들어가는 길. 목록 화면부터 확인한다 —
  // 대시보드는 service 로 읽고(dashboard/page.tsx:47) 목록·상세는 로그인 사용자로 읽어서,
  // 같은 데이터가 화면마다 다르게 보일 수 있다.
  await page.goto('/admin/reports')
  await page.waitForLoadState('networkidle')
  await shot(page, 'd30-33-3-report-list')
  const inList = await page.locator(`a[href="/admin/reports/${reportId}"]`).count()

  await page.goto(`/admin/reports/${reportId}`)
  const is404 = await page.getByRole('heading', { name: '404' }).count() > 0
  await shot(page, 'd30-33-3-report-open')

  if (is404 || inList === 0) {
    finding('결함', '관리자 신고 목록·상세 — 관리자가 읽지 못함',
      `관리자로 로그인해도 신고 목록이 비어 있고(${inList}건), 대시보드 「지금 처리할 것」에서 본 그 신고를 ` +
      `직접 열면 404 가 뜹니다. reports 의 SELECT 정책이 「reporter 이거나 counterpart」뿐이라 관리자에게 읽을 권한이 없습니다 ` +
      `(0026_reports.sql:33). 같은 파일의 UPDATE 정책(43행)에는 관리자 조건이 들어 있어, 닫을 권한은 있는데 볼 권한이 없는 상태입니다. ` +
      `대시보드만 service 키로 읽어(admin/dashboard/page.tsx:47) 건수와 목록이 보이니, 관리자는 「신고가 N건 있다」는 것만 보고 ` +
      `한 건도 처리할 수 없습니다. 신고 종결 · 제재 판정 전체가 여기서 막힙니다.`)
    console.log(`[신고] ⚠️ 관리자가 신고를 읽지 못함 — 목록 ${inList}건 · 상세 ${is404 ? '404' : '열림'}`)
  }

  await expect(page.getByRole('heading', { name: '신고 상세' })).toBeVisible({ timeout: 25_000 })
  await expect(page.getByText(REPORT_BODY)).toBeVisible()
  await shot(page, 'd30-33-3-report')

  // 사유 없이 종결 — 막혀야 한다. 사유 없는 종결은 나중에 왜 닫혔는지 아무도 모른다.
  await page.getByRole('button', { name: '종결' }).click()
  await expect(page.getByText('종결 사유를 입력해주세요.')).toBeVisible({ timeout: 10_000 })
  const { data: still } = await db.from('reports').select('status').eq('id', reportId).single()
  expect(still?.status, '막혔는데 상태가 바뀌면 안 된다').toBe('open')

  // 사유를 적고 종결
  await page.getByPlaceholder('종결 사유 (종결 시 필수)').fill(CLOSE_REASON)
  await page.getByRole('button', { name: '종결' }).click()
  await expect(page.getByText('종결 사유', { exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(CLOSE_REASON)).toBeVisible()
  await shot(page, 'd30-33-3-closed')

  const { data: closed } = await db
    .from('reports').select('status, close_reason, closed_by, closed_at').eq('id', reportId).single()
  expect(closed?.status, '종결 = closed').toBe('closed')
  expect(closed?.close_reason, '적은 사유가 그대로 남았나').toBe(CLOSE_REASON)
  expect(closed?.closed_at, '종결 시각').not.toBeNull()
  const adminId = await userIdByEmail(ADMIN.email)
  expect(closed?.closed_by, '누가 닫았는지').toBe(adminId)
  console.log('[신고] closed · 사유·시각·처리자 기록 확인')

  // 종결했으면 큐 숫자도 따라 줄어야 한다 — 안 줄면 화면이 거짓을 말하는 것이다.
  await page.goto('/admin/dashboard')
  await expect(page.getByRole('heading', { name: '회원 현황' })).toBeVisible({ timeout: 25_000 })
  const { count: unpaidNow } = await db
    .from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('type', 'unpaid')
  const card = page.locator('div.grid.grid-cols-4').first().locator('> a, > div').nth(0)
  const shown = Number((await card.locator('span.tabular-nums').first().innerText()).replace(/[^0-9-]/g, ''))
  if (shown !== (unpaidNow ?? 0)) {
    finding(
      '화면이 거짓을 말함',
      '관리자 「오늘」 미입금 신고 큐',
      `신고를 종결했는데 「오늘」의 미입금 신고 숫자가 그대로입니다(화면 ${shown} / 실제 ${unpaidNow}). ` +
        `관리자가 처리한 건이 계속 밀려 있는 것처럼 보입니다.`,
    )
  }
  expect(shown, '종결 후 큐 숫자').toBe(unpaidNow ?? 0)
  await expect(page.locator(`a[href="/admin/reports/${reportId}"]`), '종결한 건이 목록에 남아 있으면 안 된다').toHaveCount(0)
  console.log(`[신고] 종결 후 미입금 큐 ${unpaidNow}건으로 반영`)

  await ctx.close()
})

// ── 4) 크레딧 지급 ──────────────────────────────────────────────────
test('D30-33-4 관리자가 크레딧을 지급하면 원장에 남고 잔액이 원장 합과 같다', async ({ browser }) => {
  const db = serviceClient()

  const sumLedger = async () => {
    const { data } = await db.from('credit_ledger').select('delta').eq('user_id', infId)
    return (data ?? []).reduce((s, r) => s + r.delta, 0)
  }
  const viewBalance = async () => {
    const { data } = await db.from('credit_balances').select('balance').eq('user_id', infId).single()
    return data?.balance ?? 0
  }

  const before = await sumLedger()
  expect(await viewBalance(), '지급 전 — 잔액 = 원장 합').toBe(before)

  const { ctx, page } = await loginAs(browser, ADMIN.email, ADMIN.password, '**/admin/**')
  await page.goto('/admin/credits')
  await expect(page.getByRole('heading', { name: '크레딧 관리' })).toBeVisible({ timeout: 25_000 })

  await page.getByPlaceholder('이름·이메일 검색').fill(infName)
  const userCard = page.getByRole('button').filter({ hasText: infName }).first()
  await expect(userCard, `크레딧 화면에서 ${infName} 을 못 찾았어요`).toBeVisible({ timeout: 15_000 })
  await userCard.click()

  await expect(page.getByText('보유 크레딧')).toBeVisible()
  await shot(page, 'd30-33-4-user')

  await page.getByPlaceholder('양수=지급, 음수=차감').fill(String(GRANT_AMOUNT))
  await page.getByPlaceholder('사유 (선택)').fill(GRANT_MEMO)
  await page.getByRole('button', { name: '실행' }).click()

  // 지급됐다는 신호를 기다린다 — 확인 문구든, 화면 잔액이 늘어난 것이든.
  const okMsg = page.getByText(`${GRANT_AMOUNT.toLocaleString()} C 지급 완료`)
  const shownBalBox = page.locator('p.text-xl.font-extrabold').first()
  await expect
    .poll(async () => {
      if (await okMsg.count() > 0) return 'msg'
      const n = Number((await shownBalBox.innerText()).replace(/[^0-9-]/g, ''))
      return n === before + GRANT_AMOUNT ? 'balance' : 'pending'
    }, { timeout: 20_000, message: '지급이 화면에 반영되지 않았어요' })
    .not.toBe('pending')
  await shot(page, 'd30-33-4-granted')

  if (await okMsg.count() === 0) {
    finding('결함', '관리자 크레딧 지급 — 확인 문구가 안 뜬다',
      `지급은 되는데 「${GRANT_AMOUNT.toLocaleString()} C 지급 완료」가 화면에 뜨지 않습니다. ` +
      `handleSubmit 이 성공 문구를 setMsg 로 넣어놓고(admin/credits/page.tsx:125) 바로 아래에서 openUser 를 부르는데, ` +
      `openUser 첫 줄이 setMsg('') 라(85행) 방금 넣은 문구를 스스로 지웁니다. ` +
      `관리자는 눌렀는데 아무 반응이 없다고 느껴 두 번 지급할 수 있습니다 — 돈이 오가는 화면이라 위험합니다.`)
    console.log('[크레딧] ⚠️ 「지급 완료」 문구 미표시 — 잔액 변화로 대신 확인했습니다')
  }

  // 지급 직후 「최근 거래 이력」 — 방금 준 줄이 보여야 정상이다.
  const txEmpty = await page.getByText('이력이 없어요').count() > 0
  if (txEmpty) {
    finding('결함', '관리자 크레딧 화면 — 최근 거래 이력이 늘 비어 있다',
      `방금 ${GRANT_AMOUNT.toLocaleString()}C 를 지급했는데 「최근 거래 이력」이 「이력이 없어요」입니다. ` +
      `이 목록은 브라우저에서 로그인 사용자 자격으로 credit_ledger 를 읽는데(admin/credits/page.tsx:89), ` +
      `그 테이블의 SELECT 정책은 「auth.uid() = user_id」뿐이라(0018_credit_ledger.sql:41) 관리자가 남의 원장을 못 읽습니다. ` +
      `관리자는 남의 잔액은 보면서 그 잔액이 어디서 왔는지는 한 줄도 볼 수 없어, 지급을 두 번 했는지조차 화면에서 확인이 안 됩니다.`)
    console.log('[크레딧] ⚠️ 최근 거래 이력 비어 있음 — 관리자가 남의 원장을 못 읽습니다')
  }

  // 위 두 가지를 파고들다 확인한 것 — credit_ledger 는 「본인 것만」으로 잘 막혀 있는데(0018:41)
  // 그 위에 얹은 뷰에는 security_invoker 가 없어 소유자 권한으로 돌았다(0018:105).
  // 로그인만 하면 누구든 전 회원 잔액을 읽던 상태였고, 0104 에서 invoker 로 바꿔 막았다.
  // 결함이라고 적어두는 대신 매번 실제로 조회해 본다 — 0104 가 되돌려지면 여기서 다시 잡힌다.
  const seenRows = await balanceRowsAsInfluencer()
  if (seenRows !== 1) {
    finding('결함', 'credit_balances 뷰 — 아무나 남의 잔액을 읽는다',
      `일반 인플루언서 계정으로 조건 없이 credit_balances 를 부르니 ${seenRows}행이 나왔습니다 — 본인 것 1행만 ` +
      `나와야 합니다. 뷰에 security_invoker 가 없으면 소유자 권한으로 돌아 원장의 RLS(0018:41)를 지나갑니다(0018:105). ` +
      `크레딧 잔액은 그 회사가 얼마나 쓰는지를 드러내는 값이라, 광고주끼리 서로의 씀씀이를 볼 수 있게 됩니다. ` +
      `0104_credit_balances_invoker.sql 이 적용돼 있는지 확인하세요.`)
  }
  expect(seenRows, '인플루언서 자격으로 보이는 잔액 행 수 — 본인 것 하나').toBe(1)
  console.log(`[크레딧] 인플루언서 자격 잔액 뷰 조회 ${seenRows}행 — 본인 것만`)

  // ── 원장 대조 — 여기가 이 절의 핵심이다. 화면 잔액과 원장 합이 어긋나면 돈 문제다.
  const { data: rows } = await db
    .from('credit_ledger')
    .select('delta, kind, reason_code, memo')
    .eq('user_id', infId)
    .eq('memo', GRANT_MEMO)
    // 원장은 지울 수 없어 앞선 회차의 같은 메모가 그대로 남는다 — 이번 회차 것만 센다.
    .gte('created_at', seededAt)
  expect(rows?.length, '지급 한 줄').toBe(1)
  expect(rows![0].delta, '적은 금액 그대로').toBe(GRANT_AMOUNT)
  expect(rows![0].reason_code).toBe('admin_grant')

  const after = await sumLedger()
  expect(after, '원장 합이 지급액만큼 늘었나').toBe(before + GRANT_AMOUNT)

  const bal = await viewBalance()
  if (bal !== after) {
    finding(
      '결함',
      '크레딧 잔액 vs 원장',
      `관리자 지급 뒤 잔액(${bal})과 원장 합(${after})이 어긋납니다. 크레딧 화면은 「잔액은 거래 기록의 ` +
        `합계입니다」라고 적어 두었는데 실제로는 다릅니다 — 돈이 맞지 않는 상태입니다.`,
    )
  }
  expect(bal, '잔액 = 원장 합').toBe(after)

  // 화면이 보여주는 숫자도 같은 값인가.
  // 이 화면은 지급 뒤 잔액을 다시 불러온다(admin/credits/page.tsx · openUser). 위의 poll 은
  // 확인 문구만 보고도 풀리므로 그 시점 잔액은 아직 옛 값일 수 있다 — 값이 될 때까지 기다린다.
  await expect
    .poll(
      async () => Number((await page.locator('p.text-xl.font-extrabold').first().innerText()).replace(/[^0-9-]/g, '')),
      { timeout: 15_000, message: '화면 보유 크레딧 = 원장 합' },
    )
    .toBe(after)
  console.log(`[크레딧] +${GRANT_AMOUNT} 지급 · 원장 합 ${before} → ${after} · 잔액·화면 모두 일치`)

  await ctx.close()
})
