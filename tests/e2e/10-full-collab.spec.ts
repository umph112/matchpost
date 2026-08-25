// D23 봇 — 단계 2 부터 9 까지, 협업 하나의 전 과정.
//
// 00-signup 이 만든 계정을 그대로 이어받는다. 따로 돌릴 때는 그 실행의 RUN 을 넘긴다:
//   BOT_RUN=39921194 npx playwright test 10-full-collab
//
// 원칙(D23 1절) — 「눌렀다」가 아니라 「값이 바뀌었다」를 본다.
// 화면 문구는 통과로 나오는데 DB 는 0행인 자리를 이번에 이미 두 번 봤다(0094 · 0095).
// 그래서 모든 확인은 DB 를 한 번 더 읽는다.
//
// expect.soft 를 쓴다 — 확인 항목 하나가 어긋났다고 거기서 멈추면 나머지를 못 본다.
// 흐름이 실제로 막히는 자리(승인이 안 되면 다음 단계가 없다)만 hard expect.
import { test, expect } from '@playwright/test'
import {
  ADMIN, INF_NICK, PASSWORD, botEmail, ensureBotAdmin, finding, ledger, loginAs, serviceClient, shot, userIdByEmail,
} from './_helpers'

const ADV = botEmail('adv')
const INF = botEmail('inf-pc')

// 오픈·협업에 쓸 날짜. 오늘로부터 14일 뒤 — 지난 날짜면 검색에 안 잡힌다.
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const OPEN_DATE = ymd(new Date(Date.now() + 14 * 86400_000))
const OPEN_TITLE = `봇 오픈 ${OPEN_DATE}`

// serial 로 묶지 않는다 — 확인 하나가 어긋났다고 뒤 단계를 통째로 건너뛰면
// 한 번 돌려 한 자리밖에 못 본다. 순서는 workers:1 · fullyParallel:false 로 이미 지켜진다.

// ── 단계 2. 관리자 승인 ─────────────────────────────────────────────
test('2-1 관리자 승인 — 대기 −1 · 승인 +1 · 서류 원본 삭제 · 축하금 원장', async ({ browser }) => {
  const db = serviceClient()
  await ensureBotAdmin()
  const advId = await userIdByEmail(ADV)

  // 누르기 전 값
  const { data: pBefore } = await db.from('profiles').select('status').eq('id', advId).maybeSingle()
  // 이미 승인된 뒤 다시 돌린 경우 — 누를 버튼이 없다. 흐름은 이어가야 하므로 건너뛴다.
  test.skip(pBefore?.status === 'approved', '이 광고주는 이미 승인돼 있어요(앞 실행에서 처리됨)')
  expect(pBefore?.status, '광고주가 대기 상태여야 승인을 눌러볼 수 있어요').toBe('pending')

  const { count: pendingBefore } = await db
    .from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending').neq('role', 'admin')
  const { count: approvedBefore } = await db
    .from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'approved').neq('role', 'admin')
  const { data: apBefore } = await db
    .from('advertiser_profiles').select('biz_doc_url').eq('user_id', advId).maybeSingle()
  expect(apBefore?.biz_doc_url, '승인 전에는 사업자등록증 원본이 있어야 해요').toBeTruthy()

  const { ctx, page } = await loginAs(browser, ADMIN.email, ADMIN.password, '**/admin/**')
  await page.goto('/admin/users')
  await page.getByRole('button', { name: '대기', exact: true }).click()
  await shot(page, 'S2-1a-승인대기목록')

  const row = page.locator('div.bg-white.rounded-2xl').filter({ hasText: ADV })
  await expect(row, '대기 목록에 이 광고주가 보여야 해요').toBeVisible()

  // 이 자리에 원래 「승인하면 가입 축하금 …C가 지급됩니다」가 있었다. 원장을 보면 축하금은
  // 가입(api/signup) 시점에 이미 들어와 있어서 승인과 무관한데, 관리자는 「승인해야 주는 줄」
  // 알고 누르게 된다 — D30 PROMPT-3 에서 문구를 고쳤다. 되돌아오면 여기서 잡는다.
  const notice = row.locator('p').filter({ hasText: '승인하면' }).first()
  await expect(notice, '승인하면 무엇이 되는지 안내가 있어야 해요').toBeVisible()
  const noticeText = (await notice.textContent()) ?? ''
  expect(
    noticeText,
    '대기 카드가 다시 축하금을 말하고 있어요 — 이미 받은 돈을 앞으로 받을 것처럼 읽힙니다',
  ).not.toContain('축하금')

  const clickedAt = Date.now()
  await row.getByRole('button', { name: '승인', exact: true }).click()
  await expect(row).toBeHidden({ timeout: 15_000 })
  await shot(page, 'S2-1b-승인직후')

  // 값이 바뀌었나 — 화면이 아니라 DB
  const { data: pAfter } = await db.from('profiles').select('status').eq('id', advId).maybeSingle()
  expect(pAfter?.status, '승인을 눌렀는데 status 가 안 바뀌었어요(0행 UPDATE 의심)').toBe('approved')

  const { count: pendingAfter } = await db
    .from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending').neq('role', 'admin')
  const { count: approvedAfter } = await db
    .from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'approved').neq('role', 'admin')
  expect.soft(pendingAfter, '대기 −1').toBe((pendingBefore ?? 0) - 1)
  expect.soft(approvedAfter, '승인 +1').toBe((approvedBefore ?? 0) + 1)

  // 처리방침에 「승인 즉시 원본 삭제」라고 써 뒀다 — 실제로 지워졌는지
  const { data: apAfter } = await db
    .from('advertiser_profiles').select('biz_doc_url').eq('user_id', advId).maybeSingle()
  expect.soft(apAfter?.biz_doc_url, '승인했는데 사업자등록증 원본이 남아 있어요').toBeFalsy()

  // 축하금 원장 — 지급 시점이 화면 안내와 맞는지
  const rows = await ledger(advId)
  const welcome = rows.filter((r) => r.reason_code === 'welcome')
  expect.soft(welcome.length, '가입 축하금 원장 행이 있어야 해요').toBeGreaterThan(0)
  // 축하금은 승인이 아니라 가입(api/signup) 시점에 이미 들어온다. 이게 사실이어야
  // 위의 「축하금을 말하지 않는다」 문구가 맞는 문구다 — 둘을 같이 잡아둔다.
  const grantedAtSignup = welcome.some((r) => new Date(r.created_at).getTime() < clickedAt)
  expect.soft(
    grantedAtSignup,
    `축하금이 승인보다 먼저 들어와 있어야 해요(현재 안내: "${noticeText.trim()}")`,
  ).toBe(true)

  await ctx.close()
})

// ── 단계 3. 인플루언서 오픈 등록 ────────────────────────────────────
test('3-1 오픈 등록 — schedules 행 · 원장 · 광고주 검색 노출', async ({ browser }) => {
  const db = serviceClient()
  const infId = await userIdByEmail(INF)
  const ledgerBefore = await ledger(infId)

  // 다시 돌린 경우 — 같은 오픈이 이미 있으면 또 만들지 않는다(같은 날짜가 쌓이면 뒤 단계가 뭘 고를지 모른다)
  const { count: already } = await db
    .from('schedules').select('id', { count: 'exact', head: true }).eq('influencer_id', infId).eq('title', OPEN_TITLE)
  test.skip((already ?? 0) > 0, '이 오픈은 앞 실행에서 이미 등록됐어요')

  const { ctx, page } = await loginAs(browser, INF, PASSWORD, '**/influencer/**')
  await page.goto('/influencer/schedule')

  await page.getByPlaceholder('예: 강남 카페 방문 포스팅').fill(OPEN_TITLE)
  // D29 에서 종료일 칸이 생겨 date 칸이 둘이다 — 앞이 시작일. 비워두면 하루 오픈.
  await page.locator('input[type=date]').first().fill(OPEN_DATE)
  await page.getByPlaceholder('예: 서울 강남구').fill('서울 강남구')
  await page.getByPlaceholder('예: 역삼동').fill('역삼동')
  await page.getByRole('button', { name: '블로그', exact: true }).click()
  await page.getByRole('button', { name: '맛집', exact: true }).click()
  await page.getByPlaceholder('예: 팝업스토어, 신제품, 뷰티').fill('봇테스트')
  await shot(page, 'S3-1a-오픈등록폼')

  await page.getByRole('button', { name: '일정 등록하기' }).click()
  await expect(page.getByText('일정이 등록됐어요!')).toBeVisible({ timeout: 20_000 })
  await shot(page, 'S3-1b-오픈등록완료')

  // 화면은 「등록됐어요」인데 행이 없을 수 있다 — 그게 이번 사고의 모양이었다
  const { data: sched } = await db
    .from('schedules').select('id, date, is_public, status, channels').eq('influencer_id', infId).eq('title', OPEN_TITLE).maybeSingle()
  expect(sched, '「등록됐어요」가 떴는데 schedules 에 행이 없어요').toBeTruthy()
  expect.soft(sched?.date).toBe(OPEN_DATE)
  expect.soft(sched?.is_public, '기본값이 공개여야 광고주 검색에 나와요').toBe(true)
  expect.soft(sched?.status).toBe('open')

  // D23 단계 3 — 「오픈 등록 후 원장에 행 + 원래 금액」
  const after = await ledger(infId)
  const added = after.filter((r) => !ledgerBefore.some((b) => b.id === r.id))
  if (!added.some((r) => r.reason_code === 'open_schedule')) {
    finding(
      '결함',
      '/influencer/schedule 등록',
      '정책(creditConfig open_schedule = 1,000C 차감, status active)인데 오픈을 등록해도 원장에 ' +
        `open_schedule 행이 안 생겨요(늘어난 행 ${added.length}건: ${added.map((r) => r.reason_code).join(', ') || '없음'}). ` +
        '차감은 화면 코드가 아니라 schedules INSERT 트리거가 하므로, 안 생겼다면 트리거를 먼저 봐야 합니다.',
    )
  }

  await ctx.close()

  // 오픈이 광고주 검색에 그 날짜로 나타나는가
  const adv = await loginAs(browser, ADV, PASSWORD, '**/advertiser/**')
  await adv.page.goto('/advertiser/search')
  await adv.page.getByRole('button', { name: '검색하기' }).click()
  // 활동명에 RUN 번호가 붙어 있어 이번 실행 카드만 잡힌다 — 지난 실행 계정이 몇 개든 상관없다.
  await expect(
    adv.page.locator('div.bg-white.p-4').filter({ hasText: INF_NICK }).first(),
    '이번에 등록한 오픈이 광고주 검색에 안 나와요',
  ).toBeVisible({ timeout: 20_000 })
  await shot(adv.page, 'S3-1c-광고주검색노출')
  await adv.ctx.close()
})

// ── 단계 4. 대시(대화) 보내기 ───────────────────────────────────────
test('4-1 대시 보내기 — 날짜 필수 · proposals 행 · 원장 · 날짜 카드', async ({ browser }) => {
  const db = serviceClient()
  const advId = await userIdByEmail(ADV)
  const infId = await userIdByEmail(INF)

  // 이 봇은 같은 계정으로 여러 번 돈다. 막지 않으면 돌 때마다 대시가 새로 나가서
  // 같은 상대와의 협업이 proposals 행 여러 개로 갈라진다 — 뒤 단계가 어느 협업을 보는지 알 수 없게 된다.
  const { data: already } = await db
    .from('proposals').select('id')
    .eq('advertiser_id', advId).eq('influencer_id', infId).limit(1).maybeSingle()
  test.skip(!!already, '이 상대에게는 앞 실행에서 이미 대시를 보냈어요')

  const ledgerBefore = await ledger(advId)

  const { ctx, page } = await loginAs(browser, ADV, PASSWORD, '**/advertiser/**')
  await page.goto('/advertiser/search')
  await page.getByRole('button', { name: '검색하기' }).click()

  // ⚠️ 아무 카드나 .first() 로 집으면 안 된다. 지난 실행 계정의 카드가 먼저 올 수 있고,
  //    그러면 그 사람에게 대시가 나가서 아래 DB 검증(이번 인플루언서)이 어긋난다(D30 [2]).
  const myCard = page.locator('div.bg-white.p-4').filter({ hasText: INF_NICK }).first()
  await expect(myCard, '이번 인플루언서의 오픈 카드가 검색에 있어야 해요').toBeVisible({ timeout: 20_000 })
  const dashBtn = myCard.getByRole('button', { name: '이 날짜로 대시 →' })
  await expect(dashBtn, '검색 결과 카드에 대시 버튼이 있어야 해요').toBeVisible({ timeout: 20_000 })
  await dashBtn.click()

  const modal = page.locator('div.fixed.inset-0').filter({ hasText: '대시를 보낼까요?' })
  await expect(modal).toBeVisible({ timeout: 15_000 })
  await shot(page, 'S4-1a-대시모달')

  // 확인: 「다른 날짜 제안」을 고르고 날짜를 비우면 보내기가 막혀야 한다
  const send = modal.getByRole('button', { name: '대시 보내기' })
  await modal.getByRole('button', { name: '다른 날짜 제안' }).click()
  await expect(
    modal.getByText('날짜를 골라야 보낼 수 있어요 — 이 값이 딜시트의 진행일이 됩니다.'),
    '날짜를 비웠는데 왜 필요한지 알려주는 문장이 없어요',
  ).toBeVisible()
  await expect(send, '날짜가 비었는데 보내기가 눌려요').toBeDisabled()
  await shot(page, 'S4-1b-날짜비움-비활성')

  // 오픈해둔 날짜로 되돌려 보낸다
  // 칩 문구는 dateWithDow — 「9/7 (월)」 형태다
  await modal.getByRole('button', { name: new RegExp(`^${Number(OPEN_DATE.slice(5, 7))}/${Number(OPEN_DATE.slice(8, 10))} `) }).click()
  await expect(send).toBeEnabled()
  await send.click()

  await page.waitForURL('**/advertiser/messages/**', { timeout: 30_000 })
  await shot(page, 'S4-1c-대화열림')

  // 값이 바뀌었나 — proposals 행과 진행일
  const { data: prop } = await db
    .from('proposals')
    .select('id, status, schedule_id, advertiser_confirmed, influencer_confirmed, created_at')
    .eq('advertiser_id', advId)
    .eq('influencer_id', infId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  expect(prop, '대화는 열렸는데 proposals 행이 없어요').toBeTruthy()
  expect.soft(prop?.status, '보낸 직후에는 검토 중이어야 해요').toBe('pending')

  // 진행일이 딜시트로 넘어가는 값이라 어디에 적혔는지 확인해 둔다
  const { data: dealDate } = await db
    .from('proposals').select('*').eq('id', prop!.id).maybeSingle()
  const dateCols = Object.entries(dealDate ?? {}).filter(([, v]) => v === OPEN_DATE).map(([k]) => k)
  console.log(`[진행일] proposals 에서 ${OPEN_DATE} 이 들어간 컬럼: ${dateCols.join(', ') || '없음'}`)
  if (dateCols.length === 0) {
    finding('결함', '대시 보내기', `모달에서 고른 진행일(${OPEN_DATE})이 proposals 어느 컬럼에도 안 남아요 — 딜시트 진행일의 출처가 사라집니다.`)
  }

  // 내가 보낸 카드에는 수락 버튼이 없어야 한다
  await expect(
    page.getByRole('button', { name: '이 날짜로 수락' }),
    '내가 보낸 날짜 카드인데 나에게 수락 버튼이 보여요',
  ).toHaveCount(0)

  // 크레딧 원장 — 대시는 베타 무료라 원래 금액만 남는다
  const added = (await ledger(advId)).filter((r) => !ledgerBefore.some((b) => b.id === r.id))
  console.log(`[크레딧] 대시 발송으로 늘어난 원장 행: ${added.map((r) => `${r.reason_code} ${r.delta}`).join(', ') || '없음'}`)
  if (!added.some((r) => r.reason_code === 'send_proposal')) {
    // 등급이 「결함」이 아니라 「화면이 거짓을 말함」인 이유: 기능이 안 되는 데서 끝나지 않고,
    // /credits 가 사람에게 틀린 숫자를 보여준다. 사람은 그걸 믿고 「베타 동안 얼마나 아꼈나」를 센다.
    finding(
      '화면이 거짓을 말함',
      '대시 보내기 원장',
      '대시를 보냈는데 원장에 send_proposal 행이 없어요(send_dash RPC 가 안 남김). 그 결과 /credits 가 ' +
        '틀린 숫자를 보여줍니다 — 단가표는 「대시 보내기 500C · 베타 무료」라고 알리는데, 아래의 ' +
        '「베타 기간이라 NC가 청구되지 않았어요」는 reason_code=send_proposal 행을 세어 만들기 때문에 ' +
        '대시를 아무리 보내도 0 이고, saved 가 0 이면 그 줄은 아예 사라집니다(credits/page.tsx:86·145). ' +
        '베타 무료라도 「원래 금액을 남긴다」가 약관 ③ 이라, 행이 없는 것 자체가 약관과도 어긋납니다.',
    )
  }

  await ctx.close()
})

// ── 단계 5. 인플루언서 수락 → 협업 성립 ─────────────────────────────
// 여기가 이번 점검의 고비다. 사용자 지시: 「딜시트 단계 진행을 반드시 DB로 확인해 주세요 —
// 화면만 보면 또 통과로 나옵니다.」 그래서 누를 때마다 proposals 를 다시 읽는다.
test('5-1 협업 성립 — 날짜 수락 · 양쪽 확정 · 연락처 공개 · 성사 크레딧', async ({ browser }) => {
  const db = serviceClient()
  const advId = await userIdByEmail(ADV)
  const infId = await userIdByEmail(INF)

  const { data: prop } = await db
    .from('proposals')
    .select('id, proposed_date, start_at, advertiser_confirmed, influencer_confirmed')
    .eq('advertiser_id', advId)
    .eq('influencer_id', infId)
    // 가장 오래된 행 = 이 점검이 4-1 부터 따라온 그 협업이다.
    // 최신 행을 잡으면, 어쩌다 대시가 하나 더 생겼을 때 끝난 협업 대신 새 대시를 보게 된다.
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  expect(prop, '4-1 에서 만든 대시가 있어야 해요').toBeTruthy()
  test.skip(!!prop?.advertiser_confirmed && !!prop?.influencer_confirmed, '이 협업은 앞 실행에서 이미 성립됐어요')

  const advLedgerBefore = await ledger(advId)
  const infLedgerBefore = await ledger(infId)

  // ── 인플루언서: 받은 날짜 카드 수락 → 협업 확정
  const inf = await loginAs(browser, INF, PASSWORD, '**/influencer/**')
  await inf.page.goto('/influencer/messages')
  await inf.page.locator('a[href^="/influencer/messages/"]').first().click()
  await expect(inf.page.getByText('진행일 제안')).toBeVisible({ timeout: 20_000 })
  await shot(inf.page, 'S5-1a-받은-날짜카드')

  // 성립 전에는 상대 연락처가 어디에도 없어야 한다(연락처 비공개 정책)
  await expect(
    inf.page.getByText('연락처가 공개됐어요'),
    '아직 확정 전인데 연락처가 공개됐어요',
  ).toHaveCount(0)

  // 앞 실행이 여기까지 갔다 멈췄을 수 있다(진행일은 이미 확정, 확정 버튼만 남은 상태).
  // 지난 단계를 다시 누르려 하면 「버튼이 없다」로 엉뚱한 실패가 나므로 DB 상태를 보고 건너뛴다.
  if (!prop?.start_at) {
    await inf.page.getByRole('button', { name: '이 날짜로 수락' }).click()
    await expect(inf.page.getByText('확정됨').first()).toBeVisible({ timeout: 20_000 })
    await shot(inf.page, 'S5-1b-날짜-확정됨')
  }

  // 화면은 「확정됨」 — DB 는? (0088: 진행일 수락은 start_at 에 적고 proposed_date 를 비운다)
  const { data: afterDate } = await db
    .from('proposals').select('start_at, proposed_date').eq('id', prop!.id).maybeSingle()
  console.log(`[진행일] 수락 후 start_at=${afterDate?.start_at} proposed_date=${afterDate?.proposed_date}`)
  if (!afterDate?.start_at) {
    finding('결함', '진행일 수락', '화면은 「확정됨」인데 proposals.start_at 이 비어 있어요 — 딜시트가 읽을 진행일이 없습니다.')
  }

  if (!prop?.influencer_confirmed) {
    await inf.page.getByRole('button', { name: '협업 확정', exact: true }).click()
    await expect(inf.page.getByText('상대 확정 대기중').first()).toBeVisible({ timeout: 20_000 })
    await shot(inf.page, 'S5-1c-인플루언서-확정')
  }

  const { data: mid } = await db
    .from('proposals').select('advertiser_confirmed, influencer_confirmed').eq('id', prop!.id).maybeSingle()
  expect(mid?.influencer_confirmed, '「상대 확정 대기중」으로 바뀌었는데 influencer_confirmed 가 안 켜졌어요').toBe(true)
  expect.soft(mid?.advertiser_confirmed, '광고주는 아직 안 눌렀는데 켜져 있어요').toBeFalsy()
  await inf.ctx.close()

  // ── 광고주: 협업 확정 → 양쪽 확정
  const adv = await loginAs(browser, ADV, PASSWORD, '**/advertiser/**')
  await adv.page.goto('/advertiser/messages')
  await adv.page.locator('a[href^="/advertiser/messages/"]').first().click()
  // ⚠️ 광고주 대화 화면은 확정 바를 두 번 그린다 — 모바일용(인라인, PC 에선 hidden)과 PC 우측 열(aside).
  // 그냥 .first() 로 잡으면 hidden 인 모바일 쪽이 걸려서 「있는데 안 보인다」로 20초를 버린다.
  // 사람이 실제로 보고 누르는 건 보이는 쪽이므로 visible 로 걸러 쓴다.
  const advVisible = (text: string) => adv.page.getByText(text).filter({ visible: true }).first()
  await expect(advVisible('내 확정 필요')).toBeVisible({ timeout: 20_000 })
  await expect(
    adv.page.getByText('연락처가 공개됐어요'),
    '광고주 쪽도 아직 한쪽만 확정인데 연락처가 열렸어요',
  ).toHaveCount(0)

  await adv.page
    .getByRole('button', { name: /^협업 확정/ })
    .filter({ visible: true })
    .first()
    .click()
  await shot(adv.page, 'S5-1d-양쪽-확정')

  // 「눌렀다」가 아니라 「값이 바뀌었다」로 본다. proposals UPDATE 정책이 influencer_id 기준이라
  // 광고주 쪽 쓰기가 0행으로 조용히 끝날 수 있는 자리다(사용자 지적). 화면 대신 DB 를 기다린다.
  await expect
    .poll(
      async () => {
        const { data } = await db
          .from('proposals').select('advertiser_confirmed').eq('id', prop!.id).maybeSingle()
        return data?.advertiser_confirmed ?? null
      },
      { timeout: 20_000, message: '광고주가 확정을 눌렀는데 DB 는 그대로예요(0행 UPDATE 의심)' },
    )
    .toBe(true)

  const { data: done } = await db
    .from('proposals').select('advertiser_confirmed, influencer_confirmed').eq('id', prop!.id).maybeSingle()
  expect(done?.influencer_confirmed, '인플루언서 확정이 풀렸어요').toBe(true)

  // 양쪽이 확정된 그때 연락처가 열린다
  await expect(
    advVisible('연락처가 공개됐어요'),
    '양쪽 확정인데 연락처가 안 열려요',
  ).toBeVisible({ timeout: 20_000 })
  await shot(adv.page, 'S5-1e-연락처-공개')

  // 「양쪽 true 가 되는 순간 DB 트리거가 축하 크레딧」(api/deal/confirm 주석) — 실제로 오는지 본다
  const advAdded = (await ledger(advId)).filter((r) => !advLedgerBefore.some((b) => b.id === r.id))
  const infAdded = (await ledger(infId)).filter((r) => !infLedgerBefore.some((b) => b.id === r.id))
  console.log(
    `[크레딧] 성사 — 광고주 ${advAdded.map((r) => `${r.reason_code} ${r.delta}`).join(', ') || '없음'}` +
    ` / 인플루언서 ${infAdded.map((r) => `${r.reason_code} ${r.delta}`).join(', ') || '없음'}`,
  )
  for (const [who, rows] of [['광고주', advAdded], ['인플루언서', infAdded]] as const) {
    if (!rows.some((r) => r.reason_code === 'celebrate')) {
      finding('결함', '협업 성사 크레딧', `양쪽 확정이 됐는데 ${who} 원장에 celebrate(협업 성사 축하 2,000C) 행이 없어요.`)
    }
  }

  await adv.ctx.close()
})
