import { test, expect } from '@playwright/test'
import { serviceClient, loginAs, shot, userIdByEmail, finding, PASSWORD } from './_helpers'

// D30 [2] — 이관. 「퇴사 예정 전환 → 퇴사자가 메모와 함께 이관 → 받는 사람 확인」.
//
// ⚠️ 시드한다(캠페인 1건). afterAll 에서 캠페인·transfers·알림·원장을 되돌리고
//    팀원 상태도 active 로 복구한다 — 안 그러면 31-team-ops 가 다음 실행에서 못 돈다
//    (이관이 끝나면 inactivateIfEmpty 가 팀원을 inactive 로 내린다).
//
// 보는 것:
//   1) 대표가 퇴사일을 적고 전환하면 team_members.status='leaving' · leave_on 이 찍힌다
//   2) 전환 전에는 이관 화면 자체가 안 열린다 (leaving/inactive 일 때만 통과)
//   3) 퇴사자가 받는 사람을 고르고 메모를 남겨 이관하면
//      campaigns.manager_id 가 바뀌고 transfers 에 메모가 남는다
//   4) 남은 담당이 0이 되면 팀원이 자동으로 inactive 로 내려간다
//   5) 받는 사람(대표) 화면의 이관 기록에 그 줄이 보인다

const TAG = '[봇검증]'
const ADV_EMAIL = 'bot+adv-40060863@matchpost.kr'
const TEAM_EMAIL = 'bot+team-40060863@matchpost.kr'

const TOP_UP_MEMO = '[봇검증] 시드용 임시 충전 — 정리 때 상계'
const REVERSE_MEMO = '[봇검증] 시드 되돌림 — 원장은 append-only 라 삭제 대신 역행 한 줄'

const plus = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// 제목에 [ ] 가 들어 있어 정규식에 그대로 못 넣는다.
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const LEAVE_ON = plus(14)
const T_CAMP = `${TAG} 이관 대상 캠페인`
const MEMO = `${TAG} 3주차 원고 컨펌까지 끝났고 정산만 남았어요`

let advId = ''
let teamId = ''
let ownerName = ''
const madeCampaigns: string[] = []
let seededAt = ''

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  const db = serviceClient()
  advId = await userIdByEmail(ADV_EMAIL)
  teamId = await userIdByEmail(TEAM_EMAIL)

  const { data: prof } = await db.from('profiles').select('name').eq('id', advId).single()
  ownerName = (prof?.name as string | null) || '이름 미설정'

  const { data: tm } = await db
    .from('team_members')
    .select('id, status')
    .eq('owner_id', advId)
    .eq('member_id', teamId)
    .maybeSingle()
  if (!tm) throw new Error(`팀원(${TEAM_EMAIL})이 봇 대표 회사에 없어요 — 00-signup 0-6 을 먼저 돌리세요.`)
  // 지난 실행이 inactive 로 두고 끝났을 수 있다. 이 절은 active 에서 시작해야 성립한다.
  if (tm.status !== 'active') {
    await db.from('team_members').update({ status: 'active', leave_on: null }).eq('id', tm.id)
    console.log(`[시드] 팀원 상태 '${tm.status}' → 'active' 로 되돌림(이 절의 시작 조건)`)
  }

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

  const { data, error } = await db
    .from('campaigns')
    .insert({
      advertiser_id: advId,
      manager_id: teamId,
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
  madeCampaigns.push(data.id)
  console.log(`[시드] 이관 대상 캠페인 1건(담당=팀원) · 퇴사 예정일 ${LEAVE_ON}`)
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

  if (madeCampaigns.length > 0) {
    await wipe('이관 기록', db.from('transfers').delete().in('ref_id', madeCampaigns).select('id'))
    await wipe('알림', db.from('notifications').delete().in('ref_id', madeCampaigns).select('id'))
    await wipe('캠페인', db.from('campaigns').delete().in('id', madeCampaigns).select('id'))
    const { data: strays } = await db
      .from('notifications')
      .select('id')
      .or(`body.ilike.%봇검증%,title.ilike.%봇검증%`)
    if ((strays ?? []).length > 0) await db.from('notifications').delete().in('id', strays!.map((s) => s.id))
  }

  // ⚠️ 팀원을 원상복구한다. 이관이 끝나면 inactivateIfEmpty 가 inactive 로 내리는데,
  //    그대로 두면 31-team-ops 가 다음 실행에서 「팀원이 active 가 아니다」로 멈춘다.
  const { error: tErr } = await db
    .from('team_members')
    .update({ status: 'active', leave_on: null })
    .eq('owner_id', advId)
    .eq('member_id', teamId)
  console.log(tErr ? `[정리] ⚠️ 팀원 복구 실패: ${tErr.message}` : '[정리] 팀원 status=active · leave_on=null 로 복구')

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

// ── 0) 전환 전에는 이관 화면이 안 열린다 ────────────────────────────
test('D30-32-0 퇴사 예정 전환 전에는 이관 화면이 안 열린다', async ({ browser }) => {
  const { ctx, page } = await loginAs(browser, ADV_EMAIL, PASSWORD, '**/advertiser/**')
  await page.goto(`/advertiser/team/handover/${teamId}`)
  // 게이트가 /advertiser/team 으로 되돌린다(page.tsx — status in ('leaving','inactive') 만 통과)
  await expect(page).toHaveURL(/\/advertiser\/team\/?$/, { timeout: 20_000 })
  console.log('[이관] active 팀원의 이관 화면 접근 → 팀 화면으로 되돌림 확인')
  await ctx.close()
})

// ── 1) 퇴사 예정 전환 ───────────────────────────────────────────────
test('D30-32-1 대표가 퇴사일을 적고 퇴사 예정으로 전환한다', async ({ browser }) => {
  const db = serviceClient()
  const { ctx, page } = await loginAs(browser, ADV_EMAIL, PASSWORD, '**/advertiser/**')
  await page.goto('/advertiser/team')
  await expect(page.getByRole('heading', { name: '팀 멤버' })).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: '퇴사 예정으로 전환' }).click()
  const dateInput = page.locator('input[type="date"]')
  await expect(dateInput).toBeVisible()
  await dateInput.fill(LEAVE_ON)
  await shot(page, 'd30-32-1-leaving-input')
  await page.getByRole('button', { name: '확인', exact: true }).click()

  await expect(page.getByText('퇴사 예정')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('link', { name: '이관 화면' })).toBeVisible()
  await shot(page, 'd30-32-1-leaving')

  const { data: tm } = await db
    .from('team_members')
    .select('status, leave_on')
    .eq('owner_id', advId)
    .eq('member_id', teamId)
    .single()
  expect(tm?.status, '전환 = leaving').toBe('leaving')
  expect(tm?.leave_on, '적은 퇴사일이 그대로 들어갔나').toBe(LEAVE_ON)
  console.log(`[이관] team_members status=leaving · leave_on=${LEAVE_ON}`)

  await ctx.close()
})

// ── 2) 퇴사자가 메모와 함께 이관한다 ────────────────────────────────
test('D30-32-2 퇴사자가 받는 사람을 고르고 메모를 남겨 이관한다', async ({ browser }) => {
  const db = serviceClient()
  const { ctx, page } = await loginAs(browser, TEAM_EMAIL, PASSWORD, '**/advertiser/**')
  await page.goto(`/advertiser/team/handover/${teamId}`)
  await expect(page.getByRole('heading', { name: '내 담당 인수인계' })).toBeVisible({ timeout: 25_000 })
  await expect(page.getByText(T_CAMP)).toBeVisible()
  await shot(page, 'd30-32-2-handover')

  // 퇴사자 본인이라 버튼 라벨은 「이관하기」다(받는 사람은 접힌 칸에서 고른다).
  await page.getByRole('button', { name: '이관하기' }).first().click()
  await expect(page.getByText('받는 사람')).toBeVisible()

  // 후보가 대표 하나뿐이라 기본값이 이미 대표다 — 그래도 명시적으로 고른다.
  await page.locator('select').last().selectOption(advId)
  await page.getByPlaceholder('인수인계 메모 (선택) — 받는 분에게 그대로 전달돼요').fill(MEMO)
  await shot(page, 'd30-32-2-memo')
  await page.getByRole('button', { name: '이관 확인' }).click()

  // 마지막 담당을 넘기면 inactivateIfEmpty 가 퇴사자를 inactive 로 내린다. 그 순간
  // 이 화면의 「보는 사람」 게이트가 퇴사자 본인을 막아 마이페이지로 튕겨낸다.
  // 어느 쪽으로 끝나든 이관 자체는 아래 값 확인에서 본다 — 화면은 화면대로 사실을 남긴다.
  const done = page.getByText('남은 담당 캠페인이 없어요.')
  const bounced = page.getByRole('heading', { name: '마이페이지' })
  await expect(done.or(bounced).first()).toBeVisible({ timeout: 25_000 })
  await shot(page, 'd30-32-2-done')

  if (await bounced.count() > 0) {
    finding('결함', '이관 화면 — 마지막 담당을 넘긴 직후',
      `퇴사자가 마지막 담당 캠페인을 넘기는 순간 자기 이관 화면에서 마이페이지로 튕겨납니다. ` +
      `「다 넘겼어요」 같은 확인도, 방금 넘긴 이관 기록도 보지 못한 채 화면이 바뀌어서, 정말 넘어갔는지를 본인이 확인할 방법이 없습니다. ` +
      `원인은 같은 파일 안의 두 조건이 어긋난 것입니다 — handover/[leaverId]/page.tsx 는 36행에서 ` +
      `「퇴사자는 leaving 이거나 inactive」로 받아놓고, 50행의 보는 사람 확인은 ['active','leaving'] 만 통과시킵니다. ` +
      `마지막 이관이 끝나면 inactivateIfEmpty(transfers.ts:54)가 퇴사자를 inactive 로 내리므로, ` +
      `이 화면의 주인공인 퇴사자만 자기 화면에서 쫓겨납니다. 대표·받는 사람은 그대로 볼 수 있습니다.`)
    console.log('[이관] ⚠️ 퇴사자가 마지막 이관 직후 화면에서 튕김 — 완료 문구 미검증')
  }

  // ── 값 확인 ──
  const { data: camp } = await db.from('campaigns').select('manager_id').eq('id', madeCampaigns[0]).single()
  expect(camp?.manager_id, '담당이 대표로 넘어갔나').toBe(advId)

  const { data: tr } = await db
    .from('transfers')
    .select('from_id, to_id, kind, ref_id, memo, by_id')
    .eq('ref_id', madeCampaigns[0])
  expect(tr?.length, 'transfers 한 줄').toBe(1)
  expect(tr![0].from_id).toBe(teamId)
  expect(tr![0].to_id).toBe(advId)
  expect(tr![0].kind).toBe('campaign')
  expect(tr![0].by_id, '누가 눌렀는지 = 퇴사자 본인').toBe(teamId)
  // 메모가 안 남으면 「받는 분에게 그대로 전달돼요」가 거짓말이 된다.
  if (tr![0].memo !== MEMO) {
    finding(
      '화면이 거짓을 말함',
      '이관 화면 인수인계 메모',
      `메모 칸에 「받는 분에게 그대로 전달돼요」라고 적혀 있는데 transfers.memo 에 남은 값이 다릅니다 ` +
        `(적은 값 「${MEMO}」 / 남은 값 「${tr![0].memo ?? '(비어 있음)'}」). 받는 사람은 못 읽습니다.`,
    )
  }
  expect(tr![0].memo, '남긴 메모가 그대로 저장됐나').toBe(MEMO)

  // 남은 담당이 0이면 자동으로 inactive 로 내려간다(inactivateIfEmpty).
  const { count: leftCamps } = await db
    .from('campaigns').select('id', { count: 'exact', head: true })
    .eq('advertiser_id', advId).eq('manager_id', teamId)
  const { count: leftConvs } = await db
    .from('conversations').select('id', { count: 'exact', head: true })
    .eq('advertiser_id', advId).eq('kind', 'personal').eq('manager_id', teamId)
  const { data: tm } = await db
    .from('team_members').select('status').eq('owner_id', advId).eq('member_id', teamId).single()

  if ((leftCamps ?? 0) === 0 && (leftConvs ?? 0) === 0) {
    expect(tm?.status, '남은 담당이 0 → 자동 비활성').toBe('inactive')
    console.log('[이관] 남은 담당 0건 → team_members status=inactive 자동 전환 확인')
  } else {
    // 우회하지 않는다 — 왜 판정을 못 했는지 그대로 남긴다.
    console.log(
      `[이관] ⚠️ 자동 비활성 미검증 — 팀원에게 캠페인 ${leftCamps ?? 0}건 · 개인 대화 ${leftConvs ?? 0}건이 남아 있습니다 ` +
        `(현재 status=${tm?.status}). 앞 스펙의 시드가 안 지워졌을 수 있어요.`,
    )
  }

  await ctx.close()
})

// ── 3) 받는 사람(대표) 쪽 확인 ──────────────────────────────────────
test('D30-32-3 받는 사람이 이관 기록과 넘어온 캠페인을 확인한다', async ({ browser }) => {
  const { ctx, page } = await loginAs(browser, ADV_EMAIL, PASSWORD, '**/advertiser/**')

  // 이관 기록 — 퇴사자 페이지는 inactive 여도 열린다(page.tsx 게이트가 두 상태를 다 통과시킨다).
  await page.goto(`/advertiser/team/handover/${teamId}`)
  await expect(page.getByRole('heading', { name: /님 페이지$/ })).toBeVisible({ timeout: 25_000 })
  // 「이관 기록」은 <button aria-expanded> 라 역할로 집는다(HandoverView.tsx:192).
  await page.getByRole('button', { name: '이관 기록' }).click()
  await expect(page.getByText(`캠페인 → ${ownerName} · 메모 남김`)).toBeVisible({ timeout: 15_000 })
  await shot(page, 'd30-32-3-log')

  // 넘어온 캠페인이 대표 목록에 있고 「이관」 꼬리표가 붙는다(5-8).
  await page.goto('/advertiser/campaigns')
  // 목록이 PC·모바일 두 벌로 그려져 같은 제목이 두 번 잡힌다 — 보이는 쪽 하나만 본다.
  await expect(page.getByText(T_CAMP).first()).toBeVisible({ timeout: 25_000 })
  // 5-8 꼬리표 — 「누구에게서 언제 넘어왔는지」가 카드에 남는지.
  const tagged = page.getByRole('link', { name: new RegExp(`${escapeRe(T_CAMP)}[\\s\\S]*이관`) })
  if (await tagged.count() === 0) {
    finding('결함', '캠페인 목록 — 이관 꼬리표',
      `이관으로 넘어온 캠페인인데 목록 카드에 「누구에게서 넘어왔다」는 꼬리표가 없습니다(D14 5-8). ` +
      `받는 사람은 내가 등록한 캠페인과 넘겨받은 캠페인을 목록에서 구분하지 못합니다.`)
    console.log('[이관] ⚠️ 이관 꼬리표 미검증 — 카드에서 찾지 못했습니다')
  } else {
    console.log(`[이관] 꼬리표 확인 — ${(await tagged.first().getAttribute('aria-label')) ?? '카드에 「이관」 표기 있음'}`)
  }
  await shot(page, 'd30-32-3-received')
  console.log('[이관] 대표 목록에 넘어온 캠페인 노출 확인')

  await ctx.close()
})
