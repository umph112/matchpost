import fs from 'node:fs'
import path from 'node:path'
import { test, type Page } from '@playwright/test'
import { PASSWORD, ROOT, botEmail, loginAs } from './_helpers'

// D23 ③ — 인플루언서 화면 전부가 PC 셸 안에서 제대로 나오는지 눈으로 볼 캡처.
//
// 이 스펙이 남아 있는 이유: 셸을 레이아웃으로 올린 뒤에도 화면이 늘어난다.
// 새 화면을 SCREENS 에 한 줄 더하면 같은 자리에 같은 이름으로 다시 찍힌다.
//
// ⚠️ 캡처는 tests/screenshots(무시됨)가 아니라 docs/design/d23/screens 로 간다.
//    레포에서 열어봐야 하므로 커밋되는 자리여야 한다.
const OUT = path.join(ROOT, 'docs', 'design', 'd23', 'screens')

// 셸 PC 골격이 min-w-[1360px] 이라 그보다 좁으면 가로 스크롤이 생겨 판단이 흐려진다.
const VIEWPORT = { width: 1440, height: 960 }

const SCREENS: { file: string; url: string; wait?: (p: Page) => Promise<unknown> }[] = [
  { file: 'inf-dashboard', url: '/influencer/dashboard' },
  { file: 'inf-earnings', url: '/influencer/earnings' },
  { file: 'inf-proposals', url: '/influencer/proposals' },
  { file: 'inf-profile', url: '/influencer/profile' },
  { file: 'inf-notifications', url: '/influencer/notifications' },
  { file: 'inf-search', url: '/influencer/search' },
  { file: 'inf-channel-analytics', url: '/influencer/channel-analytics' },
  { file: 'inf-schedule-new', url: '/influencer/schedule' },
  { file: 'inf-schedule-list', url: '/influencer/schedule/list' },
  { file: 'inf-schedule-detail', url: '/influencer/schedule/83f331e7-9dea-45b7-b4e4-04bec48c11cc' },
  { file: 'inf-messages', url: '/influencer/messages' },
]

test('[③] 인플루언서 화면 PC 셸 캡처', async ({ browser }) => {
  fs.mkdirSync(OUT, { recursive: true })
  const { ctx, page } = await loginAs(browser, botEmail('inf-pc'), PASSWORD, '**/influencer/**')
  try {
    await page.setViewportSize(VIEWPORT)
    for (const s of SCREENS) {
      await page.goto(s.url, { waitUntil: 'networkidle' })
      // 셸은 클라이언트에서 userAgent 로 PC/모바일을 정한다 — 사이드바가 붙을 때까지 기다린다.
      await page.waitForSelector('main.inf-pc', { timeout: 20_000 }).catch(() => {})
      await page.waitForTimeout(600)
      await page.screenshot({ path: path.join(OUT, `${s.file}.png`), fullPage: true })
      // 판단 근거를 로그로도 남긴다: 사이드바가 있나, 내용이 480px 에 갇혀 있나.
      const info = await page.evaluate(() => {
        const aside = document.querySelector('aside')
        const main = document.querySelector('main.inf-pc')
        const first = main?.firstElementChild as HTMLElement | null
        return {
          사이드바: !!aside,
          본문폭: main ? Math.round(main.getBoundingClientRect().width) : -1,
          첫칸폭: first ? Math.round(first.getBoundingClientRect().width) : -1,
        }
      })
      console.log(`[③] ${s.file}  사이드바 ${info.사이드바 ? '있음' : '없음'} · 본문폭 ${info.본문폭}px · 첫칸폭 ${info.첫칸폭}px`)
    }
  } finally {
    await ctx.close()
  }
})
