import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { PASSWORD, ROOT, botEmail, latestScheduleId, loginAs } from './_helpers'

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
  // 오픈 상세는 id 가 필요하다. 박아두면 그 오픈이 사라진 뒤 404 를 찍는데,
  // 404 에는 사이드바가 없어 「셸이 깨졌다」로 잘못 읽힌다 — 실행할 때 찾는다(D30 [2]).
  { file: 'inf-schedule-detail', url: '/influencer/schedule/[id]' },
  { file: 'inf-messages', url: '/influencer/messages' },
]

test('[③] 인플루언서 화면 PC 셸 캡처', async ({ browser }) => {
  fs.mkdirSync(OUT, { recursive: true })
  const { ctx, page } = await loginAs(browser, botEmail('inf-pc'), PASSWORD, '**/influencer/**')
  // 캡처를 끝까지 남긴 뒤에 한 번에 따진다 — 첫 화면에서 멈추면 나머지를 못 본다.
  const bad: string[] = []
  try {
    await page.setViewportSize(VIEWPORT)
    const openId = await latestScheduleId(botEmail('inf-pc'))
    for (const s of SCREENS) {
      const url = s.url.replace('[id]', openId ?? '')
      if (s.url.includes('[id]') && !openId) {
        // 없는 화면을 404 로 찍어 목록에 끼워두면 「11개 다 봤다」가 거짓이 된다.
        console.log(`[③] ${s.file}  건너뜀 — 이 계정에 오픈이 없어요 (미검증)`)
        continue
      }
      await page.goto(url, { waitUntil: 'networkidle' })
      // D33 — 셸은 이제 CSS(lg=1024px)로 갈린다. 모바일 껍데기도 DOM 에 남아 있으므로
      // main.inf-pc 의 「존재」로는 아무것도 판정되지 않는다(폭과 무관하게 항상 붙는다).
      // PC 사이드바가 실제로 보이는지로 기다리고, 판정도 그걸로 한다.
      await page.locator('aside:visible').first().waitFor({ timeout: 20_000 }).catch(() => {})
      await page.waitForTimeout(600)
      await page.screenshot({ path: path.join(OUT, `${s.file}.png`), fullPage: true })
      // 판단 근거: PC 사이드바가 보이나, 본문이 512px 에 갇혀 있나.
      const info = await page.evaluate(() => {
        const w = (el: Element | null) => (el ? Math.round(el.getBoundingClientRect().width) : -1)
        const aside = [...document.querySelectorAll('aside')].find((a) => a.getBoundingClientRect().width > 0)
        const main = document.querySelector('main.inf-pc')
        return {
          사이드바: w(aside ?? null),
          본문폭: w(main),
          첫칸폭: w(main?.firstElementChild ?? null),
        }
      })
      const 갇힘 = info.본문폭 > 0 && info.본문폭 <= 512
      const 셸없음 = info.사이드바 <= 0
      if (갇힘 || 셸없음) bad.push(`${s.file}(사이드바 ${info.사이드바}px · 본문 ${info.본문폭}px)`)
      console.log(
        `[③] ${s.file}  사이드바 ${info.사이드바 > 0 ? `${info.사이드바}px` : '안 보임'} · 본문폭 ${info.본문폭}px · 첫칸폭 ${info.첫칸폭}px${
          갇힘 || 셸없음 ? '  ⚠️' : ''
        }`,
      )
    }
  } finally {
    await ctx.close()
  }
  // 1440px 에서 사이드바가 안 보이거나 본문이 512px 이면 PC 셸이 안 걸린 것이다.
  expect(bad, `PC 폭인데 모바일 셸: ${bad.join(', ')}`).toEqual([])
})
