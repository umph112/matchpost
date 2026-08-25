import { devices, expect, test, type Browser, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { PASSWORD, ROOT, serviceClient } from './_helpers'

// D31 [1] — 「뒤로가기를 누르면 로그인 페이지로 튄다」.
//
// 처음엔 판정 없이 어디로 가는지만 찍는 재현용이었다. 원인이 확정됐으므로(아래) 회귀 감시로 바꿨다.
//
// 재현으로 밝혀진 원인 — 문서가 짚은 「클라이언트 getUser() → push('/login')」이 아니었다.
//   ① RoleLoginPanel 이 push 라서 /login 이 이력에 남는다
//   ② /login 이 세션을 안 봐서, 돌아오면 로그인 폼을 그대로 그린다
// 둘이 겹쳐야 증상이 된다. ①은 replace 로, ②는 서버 확인 후 redirect 로 고쳤다.
//
// 셋째 테스트는 다른 결함이다 — 미들웨어가 startsWith('/influencer') 로 막아
// 공개 화면인 /influencer/[id] 까지 비로그인 차단됐다. 보호를 레이아웃에 맡기며 걷어냈다.

const MOBILE = devices['iPhone 13']
const SHOTS = path.join(ROOT, 'docs', 'design', 'd31', 'screens')

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true })
}

// 이 스펙만 따로 돌리면 BOT_RUN 이 새 값이라 이번 RUN 계정이 없다.
// 지난 실행이 만들어둔 인플루언서 봇 중 가장 최근 것을 쓴다(비밀번호는 공통).
async function 최근_인플루언서_봇(): Promise<string> {
  const db = serviceClient()
  const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 300 })
  const rows = (data?.users ?? [])
    .filter((u) => (u.email ?? '').startsWith('bot+inf-pc-'))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  if (!rows.length) throw new Error('인플루언서 봇 계정이 없어요 — 00-signup 을 먼저 돌려주세요.')
  return rows[0].email!
}

async function 모바일_로그인(browser: Browser, email: string) {
  const ctx = await browser.newContext({ ...MOBILE })
  const page = await ctx.newPage()
  await page.goto('/login')
  await page.getByPlaceholder('이메일').fill(email)
  await page.getByPlaceholder('비밀번호').fill(PASSWORD)
  await page.getByRole('button', { name: '로그인' }).click()
  await page.waitForURL('**/influencer/**', { timeout: 45_000 })
  return { ctx, page }
}

const 경로 = (p: Page) => new URL(p.url()).pathname

// 뒤로가기 한 번 — 어디로 갔는지, 로그인 폼이 떴는지.
async function 뒤로(page: Page) {
  await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForTimeout(1200)
  const 로그인폼 = await page.getByPlaceholder('비밀번호').isVisible().catch(() => false)
  return { 경로: 경로(page), 로그인폼 }
}

test('[D31-1] 로그인 직후 뒤로가기 — 로그인 폼으로 돌아가지 않는다', async ({ browser }) => {
  const email = await 최근_인플루언서_봇()
  console.log('[D31-1] 계정:', email)
  const { ctx, page } = await 모바일_로그인(browser, email)
  try {
    console.log('[D31-1] 로그인 후 도착:', 경로(page))
    const r = await 뒤로(page)
    console.log(`[D31-1] 뒤로가기 1회 → ${r.경로}  로그인폼 ${r.로그인폼 ? '보임' : '안보임'}`)
    await shot(page, 'd31-back-after-login')
    // replace 로 바뀌었으니 /login 은 도착 화면에 덮여 이력에 없다.
    expect(r.로그인폼, '로그인한 사람에게 로그인 폼이 다시 보이면 그 증상이다').toBe(false)
    expect(r.경로, '뒤로가기 한 번에 /login 이면 이력에 로그인 화면이 남아 있는 것이다').not.toBe('/login')

    // 이력에 이미 /login 이 남아 있는 기존 사용자를 위한 두 번째 잠금 —
    // 로그인된 채로 /login 을 열면 되돌려 보내야 한다.
    await page.goto('/login')
    await page.waitForTimeout(1500)
    console.log('[D31-1] 로그인 상태로 /login 직접 접속 →', 경로(page))
    await shot(page, 'd31-login-while-authed')
    expect(경로(page), '로그인한 사람이 /login 에 머무르면 안 된다').not.toBe('/login')
  } finally {
    await ctx.close()
  }
})

test('[D31-1] 하단 탭을 오간 뒤 뒤로가기 — 누른 만큼 되돌아간다', async ({ browser }) => {
  const email = await 최근_인플루언서_봇()
  const { ctx, page } = await 모바일_로그인(browser, email)
  try {
    // 하단 탭 라벨은 InfluencerShell.MOBILE_TABS 를 그대로 따른다(D31 8절에서 다섯 개로 확정).
    // exact 로 잡으면 안 된다 — 「대시」 탭에는 안 읽은 수 배지가 붙어 이름이 「대시 3」이 된다.
    const 탭 = (label: string) =>
      page.locator('nav').last().getByRole('link').filter({ hasText: label }).first()
    const 눌린탭 = ['오픈', '대시', '캠페인 찾기', '매출']
    for (const label of 눌린탭) {
      await 탭(label).click()
      await page.waitForTimeout(1500)
      console.log(`[D31-1] 탭 「${label}」 →`, 경로(page))
    }
    await shot(page, 'd31-tabs-visited')

    // 누른 횟수만큼 되돌아가면 홈이어야 한다. 중간에 /login 이 끼면 그게 증상이다.
    for (let i = 1; i <= 눌린탭.length; i++) {
      const r = await 뒤로(page)
      console.log(`[D31-1] 뒤로가기 ${i}회 → ${r.경로}  로그인폼 ${r.로그인폼 ? '보임' : '안보임'}`)
      expect(r.로그인폼, `뒤로가기 ${i}회에서 로그인 폼이 떴다`).toBe(false)
    }
    expect(경로(page), '네 칸 눌렀으니 네 번 뒤로 가면 홈이다').toBe('/influencer/dashboard')
  } finally {
    await ctx.close()
  }
})

// 미들웨어가 공개 화면을 삼키는지 — /influencer/[id] 는 로그인 없이 보여야 한다.
test('[D31-1] 로그인 없이 공개 인플루언서 페이지가 열린다', async ({ browser }) => {
  const db = serviceClient()
  const { data } = await db.from('profiles').select('id, name').eq('role', 'influencer').limit(1)
  const id = data?.[0]?.id
  const name = data?.[0]?.name
  test.skip(!id, '인플루언서 프로필이 없어요 (미검증)')

  const ctx = await browser.newContext({ ...MOBILE })
  const page = await ctx.newPage()
  try {
    const res = await page.goto(`/influencer/${id}`)
    await page.waitForTimeout(1500)
    console.log(`[D31-1] 비로그인으로 /influencer/{id} → ${경로(page)} (HTTP ${res?.status()})`)
    await shot(page, 'd31-public-influencer-anon')

    // ① 미들웨어가 삼키지 않는다 — 고쳤다.
    expect(page.url(), '공개 프로필인데 로그인으로 보내면 결함이다').not.toContain('/login')

    // ② 화면이 실제로 그려진다.
    //    전에는 이 페이지만 params 를 동기로 받아(`params: { id: string }`) .id 가 undefined 였고,
    //    조회가 빈손이라 notFound() 로 떨어졌다. Promise 로 받고 await 하게 고쳤다.
    //    이 두 줄이 다시 동기로 돌아가면 여기서 404 로 잡힌다.
    expect(res?.status(), '공개 프로필이 404 다 — params 를 await 하지 않아서다').toBe(200)
    if (name) await expect(page.getByRole('heading', { name })).toBeVisible()
  } finally {
    await ctx.close()
  }
})
