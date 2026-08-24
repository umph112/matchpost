import { expect, test } from '@playwright/test'
import { PASSWORD, botEmail, loginAs } from './_helpers'

// D23 ②(가) — 같은 날 오픈을 두 번 열 수 없는지.
//
// 화면 조회로 막는 코드는 RLS 한 줄에 조용히 무력해질 수 있다(D23의 그 함정 —
// 정책에 막히면 rows: [] 에 error: null 이라 「없네, 만들자」로 지나간다).
// 그래서 눈으로 확인한다: 이미 오픈이 있는 날짜로 등록을 눌러 안내가 뜨는가.
const 이미_있는_날 = '2026-09-07'

test('[②] 같은 날 두 번째 오픈은 막히고 기존 오픈으로 보낸다', async ({ browser }) => {
  const { ctx, page } = await loginAs(browser, botEmail('inf-pc'), PASSWORD, '**/influencer/**')
  try {
    await page.goto(`/influencer/schedule?date=${이미_있는_날}`)
    await page.getByPlaceholder('예: 강남 카페 방문 포스팅').fill('중복 확인용 오픈')
    await page.getByPlaceholder('예: 서울 강남구').fill('서울 강남구')
    await page.getByPlaceholder('예: 역삼동').fill('역삼동')
    await page.getByRole('button', { name: '일정 등록하기' }).click()

    await expect(page.getByText('그날은 이미 오픈이 있어요')).toBeVisible({ timeout: 10_000 })
    await page.screenshot({ path: 'tests/screenshots/open-duplicate-blocked.png', fullPage: true })

    // 막기만 하면 사람은 갈 곳이 없다. 버튼이 실제로 그날 오픈으로 데려가는지까지 본다.
    await page.getByRole('button', { name: '그날 오픈 보기 →' }).click()
    await page.waitForURL(/\/influencer\/schedule\/[0-9a-f-]{36}/, { timeout: 10_000 })
    // 상세 화면은 날짜를 「9월 7일」로 쓴다(2026-09-07 이 아니라).
    await expect(page.getByText('9월 7일').first()).toBeVisible({ timeout: 10_000 })
    console.log(`[②] 막힘 확인 · 이동한 곳 ${page.url()}`)
  } finally {
    await ctx.close()
  }
})
