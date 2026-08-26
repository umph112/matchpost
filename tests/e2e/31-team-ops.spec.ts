import { test, expect } from '@playwright/test'
import { serviceClient, loginAs, shot, userIdByEmail, finding, PASSWORD } from './_helpers'

// D30 [2] — 팀 운영. 「팀원 → 담당 캠페인 → 휴무 신청 → 대표 수락 + 대행자」.
//
// 초대→가입은 여기서 다시 하지 않는다. 00-signup 의 「0-6 초대 링크 가입」이 이미 그 길을
// 지나갔고, 초대를 또 만들면 team_members 에 죽은 invited 줄이 실행마다 쌓인다.
// 그래서 이미 활동중인 봇 팀원에서 시작한다 — 확인하는 건 그 다음 자리다.
//
// ⚠️ 시드한다(사용자 승인: 「테스트 계정으로, [봇검증] 접두어를 붙이고, 확인 뒤 지우는 조건으로」).
//    캠페인 1건 · 휴무 1건. afterAll 에서 원장까지 되돌린다.
//
// 보는 것:
//   1) 팀 화면 KPI(활동중·초대 대기) = team_members 실제 건수
//   2) 팀원 캠페인 목록에 「내가 담당인 것」이 나온다 (manager_id 스코핑)
//   3) 팀원이 기간을 골라 휴무를 신청하면 leaves 에 pending 한 줄이 생긴다
//   4) 대표 화면에 걸린 일(게재 마감)이 잡히고, 대행자를 안 고르면 수락 버튼이 죽어 있다
//   5) 대행자를 고르고 수락하면 status='approved' · substitute_id 가 찍힌다

const TAG = '[봇검증]'
const ADV_EMAIL = 'bot+adv-40060863@matchpost.kr'
const TEAM_EMAIL = 'bot+team-40060863@matchpost.kr'

const TOP_UP_MEMO = '[봇검증] 시드용 임시 충전 — 정리 때 상계'
const REVERSE_MEMO = '[봇검증] 시드 되돌림 — 원장은 append-only 라 삭제 대신 역행 한 줄'

const pad = (n: number) => String(n).padStart(2, '0')
const NOW = new Date()
const Y = NOW.getFullYear()
const M = NOW.getMonth() + 1
const DIM = new Date(Y, M, 0).getDate()
const ymd = (day: number) => `${Y}-${pad(M)}-${pad(day)}`
const plus = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ⚠️ 달력은 **이번 달만** 그린다(leaves/page.tsx 가 new Date() 로 year·month 를 잡는다).
//    휴무 기간도 걸린 일도 이번 달 안에 있어야 화면에서 보인다. 말일 근처에서도 깨지지
//    않도록 오늘에서 이틀 뒤를 잡되 달 끝으로 자른다.
const A = Math.min(NOW.getDate() + 2, DIM - 1)
const B = Math.min(A + 1, DIM)
const FROM = ymd(A)
const TO = ymd(B)

const T_TEAM = `${TAG} 팀원 담당 캠페인`
const REASON = `${TAG} 가족 여행`

let advId = ''
let teamId = ''
let ownerName = ''
const madeCampaigns: string[] = []
const madeLeaves: string[] = []
// ⚠️ DB 가 찍은 시각. new Date() 는 이 PC 시계가 Supabase 보다 1초쯤 빨라 시드 줄을 놓친다.
let seededAt = ''

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  const db = serviceClient()
  advId = await userIdByEmail(ADV_EMAIL)
  teamId = await userIdByEmail(TEAM_EMAIL)

  const { data: prof } = await db.from('profiles').select('name').eq('id', advId).single()
  ownerName = (prof?.name as string | null) || '이름 미설정'

  // 팀원이 활동중이 아니면 이 절이 통째로 성립하지 않는다. 우회해서 억지로 만들지 않고 멈춘다.
  const { data: tm } = await db
    .from('team_members')
    .select('id, status')
    .eq('owner_id', advId)
    .eq('member_id', teamId)
    .maybeSingle()
  if (!tm) throw new Error(`팀원(${TEAM_EMAIL})이 봇 대표 회사에 없어요 — 00-signup 0-6 을 먼저 돌리세요.`)
  if (tm.status !== 'active') {
    throw new Error(
      `팀원 상태가 '${tm.status}' 입니다(active 여야 함) — 32-handover 가 inactive 로 두고 끝났을 수 있어요. ` +
        `team_members.status 를 active 로 되돌린 뒤 다시 돌리세요.`,
    )
  }

  // 지난 실행이 남긴 진행 중 휴무가 있으면 신청 폼이 「수락 대기」로 굳어 새로 못 고른다.
  const { data: stale } = await db
    .from('leaves')
    .select('id')
    .eq('member_id', teamId)
    .in('status', ['pending', 'rejected', 'replied'])
  if ((stale ?? []).length > 0) {
    await db.from('leave_notes').delete().in('leave_id', stale!.map((s) => s.id))
    await db.from('leaves').delete().in('id', stale!.map((s) => s.id))
    console.log(`[시드] 지난 실행 잔여 휴무 ${stale!.length}건 정리`)
  }

  // 캠페인 등록 트리거가 5,000 을 뺀다(0018). 잔액이 모자라면 시드부터 막히므로 미리 채운다.
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

  // 담당자를 팀원으로 둔 캠페인. content_end 를 휴무 기간 안에 두어야 「걸린 일」이 잡힌다.
  const { data, error } = await db
    .from('campaigns')
    .insert({
      advertiser_id: advId,
      manager_id: teamId, // ← 이 절의 핵심
      title: T_TEAM,
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
      content_start: ymd(Math.max(1, A - 1)),
      content_end: FROM, // 휴무 첫날 = 게재 마감 → 걸린 일 1건
      payment_term_type: 'after_publish_days',
      payment_term_value: 30,
      payment_methods: ['계좌이체'],
      predefined_categories: ['여행'],
      details: '봇검증용 캠페인입니다. 확인 후 삭제됩니다.',
      is_public: false, // 공개 목록을 어지럽히지 않는다
      status: 'open',
      recruit_target: 1,
      stage_pre_confirm: false,
      stage_post_edit: false,
    })
    .select('id')
    .single()
  if (error) throw new Error(`시드 실패: ${error.message}`)
  madeCampaigns.push(data.id)
  console.log(`[시드] 캠페인 1건(담당=팀원) · 휴무 예정 ${FROM}~${TO} · 게재 마감 ${FROM}`)
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

  // 휴무 — 화면으로 만든 것까지 잡으려고 id 목록이 아니라 이번 기간 조건으로 훑는다.
  const { data: lv } = await db
    .from('leaves')
    .select('id')
    .eq('member_id', teamId)
    .eq('from_date', FROM)
    .eq('to_date', TO)
  const leaveIds = [...new Set([...madeLeaves, ...(lv ?? []).map((r) => r.id)])]
  if (leaveIds.length > 0) {
    await wipe('휴무 메모', db.from('leave_notes').delete().in('leave_id', leaveIds).select('id'))
    await wipe('휴무', db.from('leaves').delete().in('id', leaveIds).select('id'))
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

  // 원장은 append-only(0034) — 지우지 못한다. 반대 부호 한 줄로 잔액만 제자리로 돌린다.
  const { data: byRef } = await db
    .from('credit_ledger').select('delta')
    .eq('user_id', advId).in('ref_id', madeCampaigns.length ? madeCampaigns : ['00000000-0000-0000-0000-000000000000'])
    .gte('created_at', seededAt)
  const { data: topUp } = await db
    .from('credit_ledger').select('delta')
    .eq('user_id', advId).eq('memo', TOP_UP_MEMO).gte('created_at', seededAt)
  const net = [...(byRef ?? []), ...(topUp ?? [])].reduce((s, r) => s + r.delta, 0)
  if (net !== 0) {
    const back = net > 0
      ? db.rpc('credit_ledger_penalty', { p_user_id: advId, p_amount: net, p_reason_code: 'admin_deduct', p_memo: REVERSE_MEMO })
      : db.rpc('credit_ledger_refund', { p_user_id: advId, p_amount: -net, p_reason_code: 'create_campaign', p_memo: REVERSE_MEMO })
    const { error } = await back
    if (error) console.log(`[정리] ⚠️ 원장 되돌리기 실패: ${error.message}`)
    else console.log(`[정리] 원장 — 시드 순증감 ${net > 0 ? '+' : ''}${net}, 반대로 ${net > 0 ? '차감' : '환급'} ${Math.abs(net)}`)
  } else {
    console.log('[정리] 원장 — 건드린 것 없음')
  }
})

// ── 1) 팀 화면 KPI = 실제 건수 ──────────────────────────────────────
test('D30-31-1 팀 화면의 활동중·초대 대기 숫자가 DB 와 같다', async ({ browser }) => {
  const db = serviceClient()
  const { ctx, page } = await loginAs(browser, ADV_EMAIL, PASSWORD, '**/advertiser/**')
  await page.goto('/advertiser/team')
  await expect(page.getByRole('heading', { name: '팀 멤버' })).toBeVisible({ timeout: 20_000 })
  await shot(page, 'd30-31-1-team')

  // 화면은 RLS 로 스코핑되지만 대조는 owner_id 를 명시해서 읽는다 — 같은 조건으로 두 번 읽으면
  // 화면이 틀려도 숫자가 맞아버린다.
  const { data: rows } = await db.from('team_members').select('status').eq('owner_id', advId)
  const dbActive = (rows ?? []).filter((r) => r.status === 'active').length
  const dbInvited = (rows ?? []).filter((r) => r.status === 'invited').length

  // 이 화면은 멤버를 클라이언트에서 나중에 불러온다(team/page.tsx:284 · useEffect).
  // 첫 렌더는 members=[] 라 「활동중 0명」이 먼저 그려진다. 「보이는가」만 기다렸다
  // innerText 를 한 번 읽으면 로딩 중 0을 집는다 — 숫자까지 재시도 대상에 넣는다.
  const kpi = async (label: string, expected: number) => {
    const card = page.locator('div').filter({ hasText: new RegExp(`^${label}\\d+명$`) }).last()
    await expect(card, `「${label}」 숫자 카드`).toHaveText(`${label}${expected}명`, { timeout: 15_000 })
  }
  await kpi('활동중', dbActive)
  await kpi('초대 대기', dbInvited)
  console.log(`[팀 KPI] 활동중 ${dbActive}명 · 초대 대기 ${dbInvited}명 — 화면과 일치`)

  await ctx.close()
})

// ── 2) 팀원이 자기 담당 캠페인을 본다 ───────────────────────────────
test('D30-31-2 팀원 캠페인 목록에 담당 캠페인이 나온다', async ({ browser }) => {
  const { ctx, page } = await loginAs(browser, TEAM_EMAIL, PASSWORD, '**/advertiser/**')
  await page.goto('/advertiser/campaigns')
  await page.waitForLoadState('networkidle')
  await shot(page, 'd30-31-2-member-campaigns')

  // 이 화면은 PC 표(MyCampaignsList.tsx:170)와 모바일 카드(274)를 둘 다 DOM 에 그려두고
  // .adv-pc 로 한쪽만 숨긴다 — 이름만으로 집으면 숨은 것까지 잡혀 strict 위반이 난다.
  const teamCard = page.getByText(T_TEAM).filter({ visible: true })

  if (await teamCard.count() === 0) {
    finding('결함', '팀원 캠페인 목록',
      `대표가 팀원을 담당자(manager_id)로 지정한 캠페인인데, 팀원으로 로그인해 /advertiser/campaigns 를 열면 ` +
      `한 건도 보이지 않습니다. 화면 코드는 manager_id=나 로 제대로 좁히고 있는데(campaigns/page.tsx:35) ` +
      `그 앞의 campaigns RLS 가 advertiser_id=auth.uid() 만 통과시켜 팀원에게는 회사 캠페인이 아예 안 읽힙니다 ` +
      `(로그인한 anon 클라이언트로 직접 조회해 0건 확인). 팀 기능 전체가 manager_id 위에 서 있는데 ` +
      `팀원은 자기 담당을 볼 수 없어, 초대·배정·대행·이관이 대표 화면에서만 성립합니다. ` +
      `→ 0103_campaigns_team_read.sql 로 팀원 SELECT 정책을 추가해 해소했다.`)
  }
  await expect(teamCard, '팀원이 자기 담당 캠페인을 보는가').toBeVisible({ timeout: 25_000 })
  console.log('[팀원] 담당 캠페인 노출 확인 — manager_id 스코핑 동작')
  await ctx.close()
})

// ── 3) 팀원이 휴무를 신청한다 ───────────────────────────────────────
test('D30-31-3 팀원이 기간을 골라 휴무를 신청한다', async ({ browser }) => {
  const db = serviceClient()
  const { ctx, page } = await loginAs(browser, TEAM_EMAIL, PASSWORD, '**/advertiser/**')
  await page.goto('/advertiser/team/leaves')
  await expect(page.getByRole('heading', { name: '내 휴무' })).toBeVisible({ timeout: 25_000 })

  // 달력은 두 개의 7열 그리드다 — 요일 머리줄과 날짜 칸. 뒤엣것이 날짜다.
  const cal = page.locator('div[style*="repeat(7,1fr)"]').last()
  const day = (d: number) => cal.getByText(String(d), { exact: true })

  // 기간 고르기 — 컴포넌트는 a=b=21 로 시작한다. 같은 날을 두 번 눌러 시작일로 접은 뒤
  // 끝날을 눌러야 원하는 구간이 잡힌다(LeavesView.onCell).
  await day(A).click()
  await day(A).click()
  await day(B).click()

  const label = A === B ? `${M}월 ${A}일 (하루)` : `${M}월 ${A}일 – ${B}일 (${B - A + 1}일)`
  await expect(page.getByText(label)).toBeVisible()

  await page.getByText('연차', { exact: true }).click()
  await page.getByPlaceholder('예: 가족 여행').fill(REASON)
  await shot(page, 'd30-31-3-leave-form')

  // 「휴무 신청」이 화면에 두 번 나온다 — 섹션 제목 <h2> 와 신청 버튼.
  // 버튼은 <button> 이라 역할로 집는다(제목 <h2> 와 자동으로 갈린다).
  const submitLeave = page.getByRole('button', { name: '휴무 신청' })
  await submitLeave.click()
  await expect(page.getByText('신청했어요 · 수락 대기')).toBeVisible({ timeout: 20_000 })
  await shot(page, 'd30-31-3-leave-pending')

  // 화면 말고 값 — 눌렀다가 아니라 남았다를 본다.
  const { data: rows } = await db
    .from('leaves')
    .select('id, advertiser_id, member_id, from_date, to_date, kind, reason, status, substitute_id')
    .eq('member_id', teamId)
    .eq('from_date', FROM)
    .eq('to_date', TO)
  expect(rows?.length, 'leaves 한 줄').toBe(1)
  const L = rows![0]
  madeLeaves.push(L.id)
  expect(L.advertiser_id, '회사(대표) 앞으로 들어갔나').toBe(advId)
  expect(L.kind).toBe('연차')
  expect(L.reason).toBe(REASON)
  expect(L.status).toBe('pending')
  expect(L.substitute_id, '대행자는 대표가 정한다').toBeNull()
  console.log(`[휴무] pending 한 줄 — ${FROM}~${TO} 연차`)

  await ctx.close()
})

// ── 4) 대표가 걸린 일을 보고 대행자를 지정해 수락한다 ────────────────
test('D30-31-4 대표가 걸린 일을 확인하고 대행자를 지정해 수락한다', async ({ browser }) => {
  const db = serviceClient()
  const { ctx, page } = await loginAs(browser, ADV_EMAIL, PASSWORD, '**/advertiser/**')
  await page.goto('/advertiser/team/leaves')
  await expect(page.getByRole('heading', { name: '휴무 관리' })).toBeVisible({ timeout: 25_000 })
  await expect(page.getByRole('heading', { name: '수락 대기 1건' })).toBeVisible()

  // 걸린 일 — 담당 캠페인의 게재 마감이 휴무 기간에 겹친다. 여기서 0건이 나오면
  // 대행자 없이 수락이 되어버려 그 기간 동안 그 캠페인을 아무도 안 본다.
  await expect(page.getByText('이 기간에 걸린 일 1건')).toBeVisible()
  await expect(page.getByText(`${T_TEAM} 게재 마감`, { exact: false })).toBeVisible()
  await shot(page, 'd30-31-4-owner-pending')

  // ⚠️ 이게 이 절의 결정적 확인 — 걸린 일이 있는데 대행자를 안 고르면 수락이 막혀야 한다.
  const approve = page.getByText('대행자를 골라주세요', { exact: true })
  await expect(approve, '걸린 일이 있으면 대행자 없이는 수락 버튼이 죽어 있어야 한다').toBeVisible()

  // 대행자 후보 — 이 회사는 대표 + 팀원 둘뿐이라 후보는 대표 하나다.
  await page.getByText(`${ownerName} (대표)`, { exact: true }).click()
  await page.getByText('수락하고 대행 시작', { exact: true }).click()

  await expect(page.getByText('수락됨')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(`대행 ${ownerName} — 기간이 끝나면 자동으로 빠져요`)).toBeVisible()
  await shot(page, 'd30-31-4-approved')

  const { data: rows } = await db
    .from('leaves')
    .select('id, status, substitute_id')
    .eq('member_id', teamId)
    .eq('from_date', FROM)
    .eq('to_date', TO)
  expect(rows?.length).toBe(1)
  expect(rows![0].status, '수락 = approved').toBe('approved')
  expect(rows![0].substitute_id, '대행자가 대표로 찍혔나').toBe(advId)

  // 대행은 이관이 아니다 — 담당(manager_id)은 그대로 팀원이어야 한다.
  const { data: camp } = await db.from('campaigns').select('manager_id').eq('id', madeCampaigns[0]).single()
  if (camp?.manager_id !== teamId) {
    finding(
      '결함',
      '팀 휴무 대행',
      `대행자를 지정했더니 캠페인 담당(manager_id)까지 바뀌었습니다. 0084 주석은 「휴무는 이관이 아니라 대타 — ` +
        `담당은 그대로 두고 그 기간 동안 substitute_id 가 대신 본다」라고 적어 두었는데 실제로는 담당이 넘어갑니다. ` +
        `휴무가 끝나도 담당이 안 돌아옵니다.`,
    )
  }
  expect(camp?.manager_id, '대행은 이관이 아니다 — 담당은 팀원 그대로').toBe(teamId)
  console.log(`[휴무] approved · 대행 ${ownerName} · 담당은 팀원 그대로`)

  await ctx.close()
})
