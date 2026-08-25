import { expect, test } from '@playwright/test'
import { PASSWORD, botEmail, loginAs, serviceClient, shot, userIdByEmail } from './_helpers'

// D23 ②(가) — 같은 날 오픈을 두 번 열 수 없는지.
//
// 화면 조회로 막는 코드는 RLS 한 줄에 조용히 무력해질 수 있다(D23의 그 함정 —
// 정책에 막히면 rows: [] 에 error: null 이라 「없네, 만들자」로 지나간다).
// 그래서 눈으로 확인한다: 이미 오픈이 있는 날짜로 등록을 눌러 안내가 뜨는가.
//
// ⚠️ 날짜를 박아두지 말 것. 3-1 이 만드는 오픈은 「오늘+14일」이라 하루만 지나도 어긋난다
//    (실제로 그랬다 — 9/7 을 봤는데 오픈은 9/8 에 생겼다). 실행할 때 DB 에서 찾는다.
async function 오픈이_있는_날(): Promise<string | null> {
  const db = serviceClient()
  const { data } = await db
    .from('schedules')
    .select('date')
    .eq('influencer_id', await userIdByEmail(botEmail('inf-pc')))
    .order('created_at', { ascending: false })
    .limit(1)
  return data?.[0]?.date ?? null
}

test('[②] 같은 날 두 번째 오픈은 막히고 기존 오픈으로 보낸다', async ({ browser }) => {
  const 이미_있는_날 = await 오픈이_있는_날()
  test.skip(!이미_있는_날, '이 계정에 오픈이 없어요 — 3-1 오픈 등록이 먼저 성공해야 합니다 (미검증)')
  const [, 월, 일] = 이미_있는_날!.split('-').map(Number)

  const { ctx, page } = await loginAs(browser, botEmail('inf-pc'), PASSWORD, '**/influencer/**')
  try {
    await page.goto(`/influencer/schedule?date=${이미_있는_날}`)
    await page.getByPlaceholder('예: 강남 카페 방문 포스팅').fill('중복 확인용 오픈')
    await page.getByPlaceholder('예: 서울 강남구').fill('서울 강남구')
    await page.getByPlaceholder('예: 역삼동').fill('역삼동')
    await page.getByRole('button', { name: '일정 등록하기' }).click()

    await expect(page.getByText('그날은 이미 오픈이 있어요')).toBeVisible({ timeout: 10_000 })
    await shot(page, 'open-duplicate-blocked')

    // 막기만 하면 사람은 갈 곳이 없다. 버튼이 실제로 그날 오픈으로 데려가는지까지 본다.
    await page.getByRole('button', { name: '그날 오픈 보기 →' }).click()
    await page.waitForURL(/\/influencer\/schedule\/[0-9a-f-]{36}/, { timeout: 10_000 })
    // 상세 화면은 날짜를 「9월 8일」처럼 쓴다(2026-09-08 이 아니라).
    await expect(page.getByText(`${월}월 ${일}일`).first()).toBeVisible({ timeout: 10_000 })
    console.log(`[②] 막힘 확인 · 이동한 곳 ${page.url()}`)
  } finally {
    await ctx.close()
  }
})
