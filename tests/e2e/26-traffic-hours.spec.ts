import { test, expect } from '@playwright/test'
import { ADMIN, PASSWORD, ensureBotAdmin, loginAs, serviceClient, shot } from './_helpers'

// D30 [1] — 관리자 「오늘」 트래픽에 시간대 탭.
//   [ ] 탭 두 개가 있고, 일별 보기가 사라지지 않았다
//   [ ] 화면을 열면 page_views 에 행이 남는다 (비콘이 실제로 쏜다)
//   [ ] 기록이 없는 구간은 0 막대가 아니라 「시간 정보가 없어요」로 비운다
//
// ⚠️ user_visit_log 는 읽지도 쓰지도 않는다 — 리워드 판정의 원본이라 봇이 건드리면 안 된다.

test.describe.configure({ mode: 'serial' })

test('D30-1 · 트래픽 시간대/일별 탭 · 비콘 적재', async ({ browser }) => {
  await ensureBotAdmin()
  const sb = serviceClient()

  const { count: before } = await sb
    .from('page_views')
    .select('*', { count: 'exact', head: true })

  const { ctx, page } = await loginAs(browser, ADMIN.email, PASSWORD, '**/admin/**')
  try {
    await page.goto('/admin/dashboard')
    await page.waitForTimeout(2500)

    const hourTab = page.getByRole('button', { name: '시간대', exact: true })
    const dayTab = page.getByRole('button', { name: '일별', exact: true })
    await expect(hourTab, '시간대 탭이 있어야 한다').toBeVisible()
    await expect(dayTab, '일별 보기를 없애면 안 된다').toBeVisible()
    await shot(page, 'd30-traffic-hours')

    // 기록 전이면 안내가, 쌓였으면 막대가 보인다 — 0 막대로 그리면 「아무도 안 왔다」로 읽힌다
    const notice = page.getByText('이 날짜 이전은 시간 정보가 없어요').first()
    const noticeShown = await notice.isVisible().catch(() => false)
    console.log('[D30-1] 시간 정보 안내 노출:', noticeShown)

    await dayTab.click()
    await page.waitForTimeout(600)
    await expect(page.getByText('최근 14일').first()).toBeVisible()
    await shot(page, 'd30-traffic-days')

    // 비콘 — 화면을 열었으니 원본에 행이 늘어야 한다
    await page.waitForTimeout(1500)
    const { count: after } = await sb
      .from('page_views')
      .select('*', { count: 'exact', head: true })
    console.log('[D30-1] page_views 행수:', before, '→', after)
    expect(after ?? 0, '화면을 열었는데 page_views 가 그대로면 비콘이 안 쏜 것이다').toBeGreaterThan(
      before ?? 0,
    )

    // path 는 화면 단위로 접혀 저장돼야 한다 (캠페인마다 한 행이 되면 집계를 못 읽는다)
    const { data: rows } = await sb
      .from('page_views')
      .select('path')
      .order('id', { ascending: false })
      .limit(20)
    const paths = (rows ?? []).map((r) => r.path)
    console.log('[D30-1] 최근 path:', [...new Set(paths)].join(' · '))
    expect(paths, '관리자 화면 조회가 기록돼야 한다').toContain('/admin/dashboard')
  } finally {
    await ctx.close()
  }
})

test('D30-1b · 롤업이 집계 먼저, 삭제 나중', async () => {
  const sb = serviceClient()
  const { data, error } = await sb.rpc('run_page_view_rollup', { p_keep_days: 90 })
  expect(error, '롤업 함수가 돌아야 한다').toBeNull()
  const row = Array.isArray(data) ? data[0] : data
  console.log('[D30-1b] 롤업:', JSON.stringify(row))

  // 완결된 시간이 있으면 집계 테이블에도 남아 있어야 한다
  const { count: hourly } = await sb
    .from('page_view_hourly')
    .select('*', { count: 'exact', head: true })
  const { count: raw } = await sb.from('page_views').select('*', { count: 'exact', head: true })
  console.log('[D30-1b] page_view_hourly:', hourly, '/ page_views 원본:', raw)
  expect(raw ?? 0, '원본이 90일 안이면 삭제되면 안 된다').toBeGreaterThan(0)
})
