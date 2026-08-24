import { test, expect, Page } from '@playwright/test'
import { loginAs, botEmail, PASSWORD, serviceClient, userIdByEmail, shot } from './_helpers'

// D29 2번 — 기간 오픈(date_end) 점검표를 그대로 따라간다.
//   [ ] 오픈 등록에 종료일 칸이 있고, 비우면 하루로 저장됨
//   [ ] 종료일이 시작일보다 앞이면 막힘
//   [ ] 기간 오픈이 중간 날짜 검색에도 잡힘
//   [ ] 하루 오픈(date_end null)이 검색에서 안 사라짐
//   [ ] 달력에서 기간 오픈이 시작~끝 전체에 표시됨
//
// 통과 판정은 화면이 아니라 DB 로 한다(D23). RLS 가 막으면 화면은 조용히 성공처럼 보인다.

const START = '2026-09-21'
const MID = '2026-09-22'
const END = '2026-09-23'
const BEFORE_START = '2026-09-19' // 종료일 역순 시험용
const ONE = '2026-09-25' // 종료일 비우고 등록 → date_end null 이어야
const EMPTY_DAY = '2026-09-10' // 아무 오픈도 없는 날(음성 대조)

const infEmail = botEmail('inf-pc')
const advEmail = botEmail('adv')

// 이 스펙이 만드는 오픈만 지운다. 다른 날짜(09-07 하루 오픈 등)는 건드리지 않는다 —
// 「하루 오픈이 검색에서 안 사라짐」을 볼 때 그게 대조군이다.
async function clearMine() {
  const sb = serviceClient()
  const infId = await userIdByEmail(infEmail)
  await sb.from('schedules').delete().eq('influencer_id', infId).in('date', [START, ONE])
  return infId
}

// 달력을 목표 달까지 넘긴다. 「2026년 9월」 라벨이 나올 때까지 › 를 누른다.
async function gotoMonth(page: Page, label: string) {
  for (let i = 0; i < 24; i++) {
    if (await page.getByText(label, { exact: true }).isVisible().catch(() => false)) return
    await page.getByRole('button', { name: '다음 달' }).click()
    await page.waitForTimeout(250)
  }
  throw new Error(`달력에서 ${label} 을 찾지 못했어요`)
}

// 날짜 격자의 d 일 칸 배경색. 오픈이 있는 날은 #FFFBEB(rgb(255, 251, 235)).
async function dayBg(page: Page, d: number) {
  const grid = page.locator('div.grid.grid-cols-7').last()
  return grid.locator('button').nth(d - 1).evaluate((el) => getComputedStyle(el).backgroundColor)
}

const AMBER = 'rgb(255, 251, 235)'

test.describe.configure({ mode: 'serial' })

test('D29-0 · 기간 오픈 만들기 전, 달력에서 21~23 상태를 먼저 본다', async ({ browser }) => {
  await clearMine()
  const { ctx, page } = await loginAs(browser, advEmail, PASSWORD, '**/advertiser/**')
  await page.goto('/advertiser/search')
  await gotoMonth(page, '2026년 9월')
  await page.waitForTimeout(1200) // 달의 오픈을 읽어오는 시간
  const before = { 21: await dayBg(page, 21), 22: await dayBg(page, 22), 23: await dayBg(page, 23) }
  console.log('[D29] 기간 오픈 전 달력 배경:', before)
  await shot(page, 'd29-calendar-before')
  await ctx.close()
})

test('D29-1 · 등록 폼: 종료일 칸 / 역순 막힘 / 기간 저장 / 비우면 하루', async ({ browser }) => {
  const infId = await clearMine()
  const sb = serviceClient()
  const { ctx, page } = await loginAs(browser, infEmail, PASSWORD, '**/influencer/**')

  // ── 종료일 칸이 있는가
  await page.goto(`/influencer/schedule?date=${START}`)
  await expect(page.getByText('종료일 (선택)')).toBeVisible()
  await shot(page, 'd29-form-end-date')

  const fillBasics = async (title: string) => {
    await page.getByPlaceholder('예: 강남 카페 방문 포스팅').fill(title)
    await page.getByPlaceholder('예: 서울 강남구').fill('서울 강남구')
    await page.getByPlaceholder('예: 역삼동').fill('역삼동')
  }
  const dateInputs = page.locator('input[type="date"]')

  // ── 종료일이 시작일보다 앞이면 막힌다
  await fillBasics('봇 기간 오픈')
  await dateInputs.nth(1).fill(BEFORE_START)
  await page.getByRole('button', { name: '일정 등록하기' }).click()
  await expect(page.getByText('종료일이 시작일보다 앞이에요. 날짜를 다시 확인해주세요.')).toBeVisible()
  await shot(page, 'd29-end-before-start-blocked')
  {
    const { data } = await sb.from('schedules').select('id').eq('influencer_id', infId).eq('date', START)
    expect(data ?? [], '막혔는데 DB 에 들어가 있으면 안 된다').toHaveLength(0)
  }

  // ── 기간 오픈이 저장된다
  await dateInputs.nth(1).fill(END)
  await page.getByRole('button', { name: '일정 등록하기' }).click()
  await page.waitForURL('**/influencer/**', { timeout: 30_000 })
  await page.waitForTimeout(800)
  {
    const { data } = await sb
      .from('schedules')
      .select('id, date, date_end')
      .eq('influencer_id', infId)
      .eq('date', START)
    console.log('[D29] 기간 오픈 DB:', data)
    expect(data ?? []).toHaveLength(1)
    expect(data![0].date_end, 'date_end 가 저장되어야 기간 오픈이다').toBe(END)
  }

  // ── 종료일을 비우면 하루(date_end null)
  await page.goto(`/influencer/schedule?date=${ONE}`)
  await fillBasics('봇 하루 오픈')
  await page.getByRole('button', { name: '일정 등록하기' }).click()
  await page.waitForURL('**/influencer/**', { timeout: 30_000 })
  await page.waitForTimeout(800)
  {
    const { data } = await sb
      .from('schedules')
      .select('id, date, date_end')
      .eq('influencer_id', infId)
      .eq('date', ONE)
    console.log('[D29] 하루 오픈 DB:', data)
    expect(data ?? []).toHaveLength(1)
    expect(data![0].date_end, '비우면 null 이어야 한다').toBeNull()
  }

  await ctx.close()
})

test('D29-2 · 광고주 검색: 중간 날짜에 잡히고, 하루 오픈은 안 사라진다', async ({ browser }) => {
  const { ctx, page } = await loginAs(browser, advEmail, PASSWORD, '**/advertiser/**')
  await page.goto('/advertiser/search')
  await gotoMonth(page, '2026년 9월')
  await page.waitForTimeout(1200)

  // ── 달력: 기간 오픈이 시작~끝 전체에 표시된다
  const after = { 21: await dayBg(page, 21), 22: await dayBg(page, 22), 23: await dayBg(page, 23) }
  console.log('[D29] 기간 오픈 후 달력 배경:', after)
  await shot(page, 'd29-calendar-after')
  expect(after[21]).toBe(AMBER)
  expect(after[22], '중간 날짜에 점이 없으면 광고주가 놓친다').toBe(AMBER)
  expect(after[23]).toBe(AMBER)

  const search = async (day: number) => {
    const grid = page.locator('div.grid.grid-cols-7').last()
    await grid.locator('button').nth(day - 1).click()
    await page.getByRole('button', { name: '검색하기' }).click()
    await page.waitForTimeout(1500)
  }

  // ── 중간 날짜(9/22) 검색에 기간 오픈이 잡힌다
  await search(22)
  await shot(page, 'd29-search-mid-day')
  await expect(page.getByText('9/21 (월) – 9/23 (수)').first()).toBeVisible()

  // ── 하루 오픈(date_end null)은 그날 검색에 그대로 있다
  await search(25)
  await shot(page, 'd29-search-one-day')
  await expect(page.getByText('9/25 (금)').first()).toBeVisible()

  // ── 오픈이 없는 날에는 기간 오픈이 딸려오지 않는다(or 절이 새는지 보는 자리)
  await search(10)
  await shot(page, 'd29-search-empty-day')
  await expect(page.getByText('9/21 (월) – 9/23 (수)')).toHaveCount(0)

  // ── 달력이 중간 날짜에 점을 찍었으니 그날 페이지도 비어 있으면 안 된다
  await page.goto(`/day/${MID}`)
  await page.waitForTimeout(1200)
  await shot(page, 'd29-day-mid')
  await expect(page.getByText('기간 오픈').first()).toBeVisible()

  await ctx.close()
})

// EMPTY_DAY 는 위에서 day 10 으로 쓴다(상수를 읽는 사람이 짝을 찾을 수 있게 남겨둠)
void EMPTY_DAY
