import path from 'node:path'
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { signupCreditAmount } from '../../src/lib/creditConfig'
import { FIXTURES, PASSWORD, RUN, botEmail, loginAs, makeBizNo, remember, serviceClient, shot } from './_helpers'

// ── 시나리오 0 — 가입 (D23 + PROMPT-2) ────────────────────────────────
// 0-1 PC 광고주 3단계 · 0-2 PC 인플루언서 · 0-3 모바일 인플루언서
// 0-4 가입 직후 프로필에 값이 채워졌는지 · 0-5 블로그 URL → 채널 분석 · 0-6 초대 링크
//
// 원칙(1절): 「버튼이 눌렸다」가 아니라 「값이 실제로 바뀌었다」를 본다.
//   여기선 화면 전환·저장된 값·URL 도달이 그 「값」이다.
// 막히면 우회하지 않는다. 그 자리에서 실패로 남긴다 — 사람도 같은 곳에서 막힌다.

// RUN 을 씨앗으로 — 실행 안에서는 항상 같은 번호, 실행끼리는 다른 번호(중복 검사 통과).
const BIZ_NO = makeBizNo(Number(RUN))

const ADV = {
  email: botEmail('adv'),
  company: `봇테스트컴퍼니-${BIZ_NO.slice(-4)}`,
  name: '봇대표',
  managerPhone: '010-1111-2222',
  companyPhone: '02-555-0000',
}
const TEAM_EMAIL = botEmail('team')
const INF_PC = { email: botEmail('inf-pc'), name: '봇인플', activity: '봇여행자', phone: '010-5555-6666' }
const INF_MO = { email: botEmail('inf-mo'), name: '봇모바일', activity: '봇모바일러', phone: '010-7777-8888' }
const MEMBER = { name: '봇팀원', phone: '010-9999-0000' }

const BLOG_URL = 'https://blog.naver.com/bot-e2e'
const MAJOR = '여행'
const SUBS = ['푸드', '스포츠/운동/레저']

let advCtx: BrowserContext

// 화면 문구(label)로 입력칸을 잡는다. data-testid 를 새로 뿌리지 않는다 —
// 문구가 바뀌면 테스트가 깨지는데, 그게 잡아야 하는 변경이다.
const field = (page: Page, label: string) =>
  page.locator(`div:has(> label:has-text("${label}")) > input`)

// 카테고리 칩은 메이저 줄(먼저)·서브 줄(나중)에 같은 이름으로 두 번 나온다.
const majorChip = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).first()
const subChip = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).last()

const ON = /bg-\[#F59E0B\]/ // 선택된 칩

// serial 이 아니라 default — workers:1 + fullyParallel:false 라 순서는 그대로지만,
// 한 단계가 막혔다고 뒤의 독립 단계(0-6 초대)까지 「미실행」으로 덮이지 않게 한다.
test.describe('시나리오 0 — 가입', () => {
  test.afterAll(async () => {
    await advCtx?.close()
  })

  // ── 0-1 ────────────────────────────────────────────────────────────
  test('0-1 PC 광고주 가입 3단계 완주 (검증 · 중복 차단 · 파일 첨부)', async ({ browser }) => {
    advCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await advCtx.newPage()

    await page.goto('/signup')
    await expect(page.getByRole('button', { name: '광고주' })).toBeVisible()
    await shot(page, 'S0-1a-역할선택')

    await page.getByRole('button', { name: '광고주' }).click()
    await expect(page.getByText('어디에서 오셨나요?')).toBeVisible()

    // ① 필수 항목을 비운 채 눌렀을 때 안내가 뜨는가 (눌렀는데 아무 일도 안 일어나면 결함)
    await page.getByRole('button', { name: '다음' }).click()
    await expect(page.getByText('필수 항목을 모두 입력해주세요.')).toBeVisible()
    await shot(page, 'S0-1b-빈폼-필수안내')

    // ② 입력한 글자가 읽히는가 (D28 1번 회귀 — inputCls 에 글자색이 박혀 있어야 한다)
    await field(page, '상호').fill(ADV.company)
    const inputColor = await field(page, '상호').evaluate((el) => getComputedStyle(el).color)
    expect(inputColor, '입력 글자색이 #17171B 여야 함 (D28 1번)').toBe('rgb(23, 23, 27)')

    // ③ 체크섬이 틀린 사업자번호는 그 자리에서 잡히는가
    await field(page, '사업자등록번호').fill('123-45-67890')
    await expect(page.getByText('사업자등록번호를 다시 확인해주세요')).toBeVisible()
    await shot(page, 'S0-1c-사업자번호-오류')

    await field(page, '사업자등록번호').fill(BIZ_NO)
    await expect(page.getByText('조직 계정은 이 번호로 하나만 만들어집니다.')).toBeVisible()

    await field(page, '대표의 이름').fill(ADV.name)
    await field(page, '대표의 휴대폰').fill(ADV.managerPhone)
    await field(page, '회사 대표번호').fill(ADV.companyPhone)
    // 1단계에 「전화번호」칸은 이제 없다 — 「대표의 휴대폰」과 뭐가 다른지 알 수 없는
    // 중복 칸이라 지웠고, 그 자리에 로그인 아이디가 무엇인지 밝히는 칸이 들어갔다.
    // 연락처(user_private.phone)는 대표의 휴대폰 값을 그대로 쓴다 → 0-2 에서 확인한다.
    await field(page, '로그인 이메일').fill(ADV.email)
    await expect(
      page.getByText('이 주소로 로그인해요', { exact: false }),
      '로그인에 쓸 주소라는 안내가 칸 아래 있어야 함',
    ).toBeVisible()
    await expect(field(page, '전화번호'), '중복 「전화번호」칸이 남아 있으면 안 됨').toHaveCount(0)
    await page.locator('input[type=password]').nth(0).fill(PASSWORD)
    await page.locator('input[type=password]').nth(1).fill(PASSWORD)
    await page.locator('input[type=file]').setInputFiles(path.join(FIXTURES, 'biz-doc.png'))
    await shot(page, 'S0-1d-1단계-작성완료')

    await page.getByRole('button', { name: '다음' }).click()
    await expect(page.getByText('함께 쓸 분이 있으신가요?')).toBeVisible()

    // ④ 팀 초대 — 넣은 이메일이 목록에 실제로 생기는가 (0-6 에서 이 초대를 쓴다)
    await page.getByPlaceholder('이메일 입력').fill(TEAM_EMAIL)
    await page.getByRole('button', { name: '＋ 초대' }).click()
    await expect(page.getByText(TEAM_EMAIL)).toBeVisible()
    await shot(page, 'S0-1e-2단계-팀초대')

    await page.getByRole('button', { name: '가입 완료' }).click()
    await expect(page.getByText('준비됐어요!')).toBeVisible({ timeout: 45_000 })
    remember({ role: 'advertiser(대표)', email: ADV.email, password: PASSWORD, note: `사업자번호 ${BIZ_NO}` })

    // ⑤ 완료 화면의 가입 축하금이 creditConfig 값과 같은가 (하드코딩 아님)
    await expect(page.getByText(signupCreditAmount('advertiser').toLocaleString(), { exact: true })).toBeVisible()
    await shot(page, 'S0-1f-3단계-완료')

    // ⑥ /pending 에 실제로 도달하는가 (파일명 오타로 404 나던 자리)
    await page.getByRole('button', { name: '캠페인 등록하러 가기' }).click()
    await page.waitForURL('**/pending', { timeout: 30_000 })
    await expect(page.getByText('가입 승인 대기 중이에요')).toBeVisible()
    await shot(page, 'S0-1g-pending-도달')

    // ⑥-1 「전화번호」칸을 지운 대가로 연락처가 사라지면 안 된다 —
    //      대표의 휴대폰이 user_private.phone 에 들어갔는지 DB 로 확인한다.
    {
      const db = serviceClient()
      const { data: u } = await db.from('user_private').select('phone, real_name, email').ilike('email', ADV.email).maybeSingle()
      expect(u, 'user_private 행이 있어야 함').toBeTruthy()
      expect(u!.phone, '대표의 휴대폰이 연락처로 저장돼야 함').toBe(ADV.managerPhone)
    }

    // ⑦ 사업자번호 중복 차단 — 같은 번호로 두 번째 가입은 막히고 소유자 이메일이 마스킹되어 보이는가
    const dupCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const dup = await dupCtx.newPage()
    await dup.goto('/signup')
    await dup.getByRole('button', { name: '광고주' }).click()
    await field(dup, '상호').fill('중복테스트')
    await field(dup, '사업자등록번호').fill(BIZ_NO)
    await field(dup, '대표의 이름').fill('중복대표')
    await field(dup, '대표의 휴대폰').fill('010-0000-1111')
    await field(dup, '로그인 이메일').fill(botEmail('adv-dup'))
    await dup.locator('input[type=password]').nth(0).fill(PASSWORD)
    await dup.locator('input[type=password]').nth(1).fill(PASSWORD)
    await dup.locator('input[type=file]').setInputFiles(path.join(FIXTURES, 'biz-doc.png'))
    await dup.getByRole('button', { name: '다음' }).click()
    await dup.getByRole('button', { name: '가입 완료' }).click()

    await expect(dup.getByText('이 사업자번호는 이미 등록되어 있어요')).toBeVisible({ timeout: 45_000 })
    await expect(dup.getByText(/\*\*\*@/)).toBeVisible() // 마스킹된 소유자 이메일
    await shot(dup, 'S0-1h-사업자번호-중복차단')
    await dupCtx.close()
  })

  // ── 0-2 ────────────────────────────────────────────────────────────
  test('0-2 PC 인플루언서 가입 완주 (QR 게이트 없음 — D28 2번)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()

    await page.goto('/signup')
    await page.getByRole('button', { name: '인플루언서' }).click()

    // D28 2번 반전 — PC 에서도 폼이 열려야 한다. QR 모달이 뜨면 PC 사용자는 가입할 방법이 없다.
    await expect(page.getByPlaceholder('예: 여행하는 지니')).toBeVisible()
    await expect(page.getByText('앱에서 더 편해요')).toBeVisible()
    await shot(page, 'S0-2a-PC-폼-열림')

    // 빈 폼 → 안내
    await page.getByRole('button', { name: '회원가입' }).click()
    await expect(page.getByText('필수 항목을 모두 입력해주세요.')).toBeVisible()

    await page.getByPlaceholder('이름 입력').fill(INF_PC.name)
    await page.getByPlaceholder('예: 여행하는 지니').fill(INF_PC.activity)
    await page.getByPlaceholder('example@email.com').fill(INF_PC.email)
    await page.getByPlaceholder('010-0000-0000').fill(INF_PC.phone)
    await page.getByPlaceholder('8자 이상 입력').fill(PASSWORD)
    await page.getByPlaceholder('비밀번호 재입력').fill(PASSWORD)

    // 메이저를 안 고르면 진행이 막히는가
    await page.getByRole('button', { name: '회원가입' }).click()
    await expect(page.getByText('메이저 분야를 1개 선택해주세요.')).toBeVisible()
    await shot(page, 'S0-2b-메이저-미선택-안내')

    await majorChip(page, MAJOR).click()
    await expect(majorChip(page, MAJOR)).toHaveClass(ON)
    for (const s of SUBS) await subChip(page, s).click()
    await expect(page.getByText('2/2')).toBeVisible() // 서브 카운터가 실제로 올라갔는가
    await shot(page, 'S0-2c-분야-선택')

    await page.getByRole('button', { name: '회원가입' }).click()
    await page.waitForURL('**/influencer/dashboard', { timeout: 45_000 })
    remember({ role: 'influencer(PC)', email: INF_PC.email, password: PASSWORD })
    await shot(page, 'S0-2d-대시보드-도달')
    await ctx.close()
  })

  // ── 0-3 ────────────────────────────────────────────────────────────
  test('0-3 모바일 인플루언서 가입 완주', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    })
    const page = await ctx.newPage()

    await page.goto('/signup')
    await page.getByRole('button', { name: '인플루언서' }).click()
    await expect(page.getByPlaceholder('예: 여행하는 지니')).toBeVisible()
    await shot(page, 'S0-3a-모바일-폼')

    await page.getByPlaceholder('이름 입력').fill(INF_MO.name)
    await page.getByPlaceholder('예: 여행하는 지니').fill(INF_MO.activity)
    await page.getByPlaceholder('example@email.com').fill(INF_MO.email)
    await page.getByPlaceholder('010-0000-0000').fill(INF_MO.phone)
    await page.getByPlaceholder('8자 이상 입력').fill(PASSWORD)

    // 비밀번호가 다르면 그 자리에서 보이는가
    await page.getByPlaceholder('비밀번호 재입력').fill('WrongPass!99')
    await expect(page.getByText('비밀번호가 일치하지 않아요.')).toBeVisible()
    await shot(page, 'S0-3b-비밀번호-불일치')
    await page.getByPlaceholder('비밀번호 재입력').fill(PASSWORD)

    await majorChip(page, '푸드').click()
    await page.getByRole('button', { name: '회원가입' }).click()
    await page.waitForURL('**/influencer/dashboard', { timeout: 45_000 })
    remember({ role: 'influencer(모바일)', email: INF_MO.email, password: PASSWORD })
    await shot(page, 'S0-3c-모바일-대시보드')
    await ctx.close()
  })

  // ── 0-4 ────────────────────────────────────────────────────────────
  test('0-4 가입 직후 프로필 — 가입에서 넣은 값이 채워져 있는가', async ({ browser }) => {
    const { ctx, page } = await loginAs(browser, INF_PC.email, PASSWORD, '**/influencer/dashboard')
    await page.goto('/influencer/profile')
    await expect(page.getByText('내 정보 수정')).toBeVisible()

    // 같은 값을 두 번 입력하게 하지 않는가 — 가입에서 넣은 값이 그대로 있어야 한다
    await expect(page.getByPlaceholder('이름 입력')).toHaveValue(INF_PC.name)
    await expect(page.getByPlaceholder('예: 여행하는 지니')).toHaveValue(INF_PC.activity)
    await expect(field(page, '전화번호')).toHaveValue(INF_PC.phone)

    // 분야도 가입에서 고른 것 그대로 (index 0 = 메이저)
    await expect(majorChip(page, MAJOR)).toHaveClass(ON)
    for (const s of SUBS) await expect(subChip(page, s)).toHaveClass(ON)
    await expect(page.getByText('2/2')).toBeVisible()
    await shot(page, 'S0-4-프로필-값채워짐')
    await ctx.close()
  })

  // ── 0-5 ────────────────────────────────────────────────────────────
  test('0-5 블로그 URL 저장 → 「채널 분석 보기」로 이어지는가', async ({ browser }) => {
    const { ctx, page } = await loginAs(browser, INF_PC.email, PASSWORD, '**/influencer/dashboard')
    await page.goto('/influencer/profile')
    await expect(page.getByPlaceholder('블로그 URL')).toBeVisible()

    // 화면은 값을 불러오기 전부터 만질 수 있다. 그때 저장하면 안 만진 칸이 빈 값으로 덮인다.
    // (별도 결함으로 보고 — 여기선 「저장이 되는가」만 보려고 로딩이 끝날 때까지 기다린다)
    await expect(page.getByPlaceholder('예: 여행하는 지니')).not.toHaveValue('')

    // 저장 전에는 안내 카드가 없어야 한다
    await expect(page.getByText('채널을 등록했어요')).toHaveCount(0)

    await page.getByPlaceholder('블로그 URL').fill(BLOG_URL)
    await shot(page, 'S0-5a-블로그URL-입력')

    await page.getByRole('button', { name: '저장하기' }).click()
    await expect(page.getByText('저장됐어요!')).toBeVisible({ timeout: 30_000 })

    // 「눌렀다」가 아니라 「바뀌었다」 — 저장 후 안내 카드와 길이 실제로 생겼는가 (D28 4번)
    const card = page.locator('div').filter({ hasText: '채널을 등록했어요' }).last()
    await expect(card).toBeVisible()
    const cta = card.getByRole('link', { name: /내 채널 분석 보기/ })
    await expect(cta).toBeVisible()
    await shot(page, 'S0-5b-채널등록-안내카드')

    await cta.click()
    await page.waitForURL('**/influencer/channel-analytics', { timeout: 30_000 })
    await shot(page, 'S0-5c-채널분석-도달')

    // 값이 실제로 저장됐는가 — 새로고침 후에도 남아 있어야 한다
    await page.goto('/influencer/profile')
    await expect(page.getByPlaceholder('블로그 URL')).toHaveValue(BLOG_URL)
    await ctx.close()
  })

  // ── 0-6 ────────────────────────────────────────────────────────────
  test('0-6 초대 링크 가입 (/signup?invite=TOKEN)', async ({ browser }) => {
    // 0-1 에서 보낸 초대의 토큰. 화면으로는 못 읽는 값이라(RLS: 대표만) service-role 로 꺼낸다.
    const db = serviceClient()
    const { data: row } = await db
      .from('team_members')
      .select('invite_token, status, email')
      .ilike('email', TEAM_EMAIL)
      .maybeSingle()
    expect(row, `0-1 에서 초대한 ${TEAM_EMAIL} 의 team_members 행이 있어야 함`).toBeTruthy()
    expect(row!.invite_token, '초대 토큰이 발급돼 있어야 함').toBeTruthy()

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await page.goto(`/signup?invite=${encodeURIComponent(row!.invite_token as string)}`)

    await expect(page.getByText(`${ADV.company} 팀에 초대됐어요`)).toBeVisible({ timeout: 30_000 })
    // 사업자 정보를 다시 넣지 않는다 · 이메일은 초대에 박제된 값
    await expect(page.locator('input[readonly]')).toHaveValue(TEAM_EMAIL)
    await expect(page.getByPlaceholder('000-00-00000')).toHaveCount(0)
    await shot(page, 'S0-6a-초대-확인')

    await page.getByPlaceholder('이름').fill(MEMBER.name)
    await page.getByPlaceholder('010-0000-0000').fill(MEMBER.phone)
    await page.getByPlaceholder('8자 이상').fill(PASSWORD)
    await page.getByPlaceholder('비밀번호 재입력').fill(PASSWORD)
    await page.getByRole('button', { name: '가입하고 합류하기' }).click()

    await page.waitForURL('**/advertiser/dashboard', { timeout: 45_000 })
    remember({ role: 'advertiser(팀원·초대)', email: TEAM_EMAIL, password: PASSWORD })
    await shot(page, 'S0-6b-합류-대시보드')

    // 토큰은 1회용 — 같은 링크로 다시 들어가면 「이미 사용된 초대」여야 한다
    const again = await (await browser.newContext()).newPage()
    await again.goto(`/signup?invite=${encodeURIComponent(row!.invite_token as string)}`)
    await expect(again.getByText('이미 사용된 초대예요')).toBeVisible({ timeout: 30_000 })
    await shot(again, 'S0-6c-토큰-1회용')
    await ctx.close()
  })
})
