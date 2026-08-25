import fs from 'node:fs'
import { test, expect, type Page, type Locator } from '@playwright/test'
import {
  ADMIN,
  FINDINGS_FILE,
  PASSWORD,
  botEmail,
  findings,
  latestScheduleId,
  loginAs,
  shot,
} from './_helpers'

// D23 [로딩] — 화면이 「언제」 쓸 수 있게 되는지 잰다.
//
// 왜 네 수치인가.
//   서버응답(TTFB)  서버가 첫 바이트를 언제 주나. 여기가 느리면 브라우저를 아무리 고쳐도 안 빨라진다.
//   첫그림(FCP)     사람이 흰 화면을 언제까지 보고 있나.
//   데이터          그 화면이 존재하는 이유(숫자·목록)가 언제 나오나.
//   누를수있음      주요 버튼을 언제 누를 수 있나.
//
// ⚠️ 셋 다 performance.timeOrigin 기준(ms)으로 맞춘다. Date.now() 로 재면 goto 호출
//    오버헤드가 섞여서 FCP 와 비교할 수 없는 숫자가 된다.
// ⚠️ 데이터와 누를수있음은 반드시 **동시에** 기다린다. 순서대로 기다리면
//    「데이터보다 버튼이 먼저 살아나는」 자리를 영영 못 본다 — 그게 기준 ③ 이다.

const LIMIT_BLANK = 2_000 // 2초 넘게 빈 화면
const LIMIT_DATA = 3_000 // 3초 넘게 로딩
const EARLY_ACTION = 300 // 데이터보다 이만큼 먼저 눌리면 「누를 수 있는데 데이터가 없음」

const ADV = botEmail('adv')
const INF = botEmail('inf-pc')

type Who = 'adv' | 'inf' | 'admin'

type Screen = {
  name: string
  who: Who
  url: string
  /** 화면 주소가 실행할 때 정해지는 경우(오픈 id 등). 없으면 url 을 그대로 연다. */
  resolveUrl?: () => Promise<string | null>
  /** 이 화면이 존재하는 이유 — 숫자·목록·빈 상태 안내 */
  data: (p: Page) => Locator
  /** 사람이 이 화면에서 제일 먼저 누를 것 */
  action: (p: Page) => Locator
}

const SCREENS: Screen[] = [
  {
    name: '광고주 대시보드',
    who: 'adv',
    url: '/advertiser/dashboard',
    data: (p) => p.getByText('진행중 캠페인').first(),
    action: (p) => p.getByRole('link', { name: '인플루언서 찾기' }).first(),
  },
  {
    name: '인플루언서 찾기',
    who: 'adv',
    url: '/advertiser/search',
    data: (p) => p.getByText('필터를 설정하고 검색하세요.').first(),
    action: (p) => p.getByRole('button', { name: '검색하기' }).first(),
  },
  {
    name: '매출 관리',
    who: 'inf',
    url: '/influencer/earnings',
    // 「불러오는 중...」이 사라지고 목록이든 빈 상태든 결론이 나온 시점
    data: (p) => p.getByText(/매출 내역이 없어요|정산 예정일/).first(),
    action: (p) => p.getByRole('button', { name: 'CSV 다운로드' }).first(),
  },
  {
    name: '오픈 묶음 보기',
    who: 'inf',
    // 이 오픈은 3-1 에서 인플루언서가 직접 만든 것이다. id 를 박지 않고 실행할 때 찾는다.
    url: '/influencer/schedule/[id]',
    resolveUrl: async () => {
      const id = await latestScheduleId(INF)
      return id ? `/influencer/schedule/${id}` : null
    },
    data: (p) => p.getByText(/받을 순서/).first(),
    action: (p) => p.getByRole('link', { name: '내 일정으로' }).first(),
  },
  {
    name: '관리자 오늘',
    who: 'admin',
    url: '/admin/dashboard',
    data: (p) => p.getByRole('heading', { name: '지금 처리할 것' }).first(),
    action: (p) => p.getByRole('link', { name: '신고 전체' }).first(),
  },
]

// 첫 그림(FCP). buffered 로 이미 지나간 것도 받는다 — 관찰을 늦게 붙였다고 못 재면 안 된다.
async function fcpMs(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((res) => {
        const done = performance.getEntriesByName('first-contentful-paint')[0]
        if (done) return res(done.startTime)
        const obs = new PerformanceObserver((list) => {
          const e = list.getEntries()[0]
          if (e) {
            obs.disconnect()
            res(e.startTime)
          }
        })
        obs.observe({ type: 'paint', buffered: true })
        setTimeout(() => res(-1), 20_000)
      }),
  )
}

// 서버가 첫 바이트를 준 시각. 「서버가 느린 건가 브라우저가 느린 건가」를 가른다.
async function ttfbMs(page: Page): Promise<number> {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    return nav ? nav.responseStart : -1
  })
}

// 이 자리가 보이게 된 시각을, 화면 자신의 시계로 읽는다.
async function visibleAt(page: Page, loc: Locator, label: string): Promise<number> {
  await expect(loc, `${label} 가 30초 안에 안 나왔어요`).toBeVisible({ timeout: 30_000 })
  return page.evaluate(() => performance.now())
}

const ms = (n: number) => (n < 0 ? '못 잼' : `${Math.round(n)}ms`)

// 어디를 쟀는지. 로컬과 배포본은 숫자가 아주 다르므로 같은 칸에 섞으면 안 된다.
const TARGET = process.env.E2E_BASE_URL ? '배포본' : '로컬'

// ⚠️ finding() 이 아니라 이걸 쓴다. finding() 은 글이 조금이라도 다르면 새 줄로 쌓는데,
//    로딩은 실행마다 ms 가 달라서 돌릴 때마다 거의 같은 줄이 하나씩 늘어난다(실제로 11줄이 됐다).
//    화면 하나당 대상 하나당 한 줄만 남기고 덮어쓴다.
function recordLoading(where: string, text: string) {
  const rows = findings().filter((r) => !(r.kind === '로딩' && r.where === where))
  rows.push({ kind: '로딩', where, text, at: new Date().toISOString() })
  fs.writeFileSync(FINDINGS_FILE, JSON.stringify(rows, null, 2) + '\n', 'utf8')
  console.log(`[로딩] ${where} — ${text}`)
}

test.describe('[로딩] 화면이 언제 쓸 수 있게 되나', () => {
  for (const s of SCREENS) {
    test(`${s.name} — ${s.url}`, async ({ browser }) => {
      // 전제(앞 단계가 만든 오픈)가 없으면 skip 이다. 그냥 넘어가 ok 로 찍으면
      // 「재보고 통과했다」로 읽히는데 실은 아무것도 안 잰 것이다(D30 PROMPT-3).
      const url = s.resolveUrl ? await s.resolveUrl() : s.url
      test.skip(!url, `${s.name}: 잴 대상이 없어요 — 3-1 오픈 등록이 먼저 성공해야 합니다 (미검증)`)

      const { ctx, page } =
        s.who === 'admin'
          ? await loginAs(browser, ADMIN.email, ADMIN.password, '**/admin/**')
          : s.who === 'adv'
            ? await loginAs(browser, ADV, PASSWORD, '**/advertiser/**')
            : await loginAs(browser, INF, PASSWORD, '**/influencer/**')

      try {
        // commit 으로 멈춰야 시계가 이 문서의 것이 된다. load 까지 기다리면 이미 늦다.
        await page.goto(url!, { waitUntil: 'commit' })

        const [ttfb, fcp] = [await ttfbMs(page), await fcpMs(page)]

        // ⚠️ 동시에 — 위 주석 참고
        const [tData, tAction] = await Promise.all([
          visibleAt(page, s.data(page), `${s.name} 데이터`),
          visibleAt(page, s.action(page), `${s.name} 주요 버튼`),
        ])

        await shot(page, `L-${s.name}`)

        console.log(
          `[로딩] ${s.name}  서버응답 ${ms(ttfb)} · 첫그림 ${ms(fcp)} · 데이터 ${ms(tData)} · 누를수있음 ${ms(tAction)}`,
        )

        const 요약 = `서버응답 ${ms(ttfb)} · 첫그림 ${ms(fcp)} · 데이터 ${ms(tData)} · 누를수있음 ${ms(tAction)}`

        // 기준을 넘은 것만 말로 적는다. 셋 다 통과면 수치만 남긴다 — 다음에 느려졌을 때 비교선이 된다.
        const 넘은것: string[] = []
        if (fcp > LIMIT_BLANK) {
          넘은것.push(
            `흰 화면이 ${ms(fcp)} 갑니다(기준 2초). 서버 첫 바이트가 ${ms(ttfb)} 라 ${
              ttfb > LIMIT_BLANK ? '원인은 서버 쪽입니다' : '서버는 제때 줬고 브라우저 쪽에서 늦습니다'
            }.`,
          )
        }
        if (tData > LIMIT_DATA) {
          넘은것.push(`데이터가 채워지는 데 ${ms(tData)} 걸립니다(기준 3초).`)
        }
        if (tAction + EARLY_ACTION < tData) {
          넘은것.push(
            `데이터보다 버튼이 ${ms(tData - tAction)} 먼저 눌립니다 — 화면은 다 된 것처럼 보이는데 아직 값이 없어서, 이때 누른 사람은 빈 결과를 받거나 헛손질을 합니다.`,
          )
        }

        recordLoading(
          `${s.name} — 로딩(${TARGET})`,
          `${s.url} — ${요약}. ${넘은것.length ? 넘은것.join(' ') : '기준(빈 화면 2초 · 로딩 3초 · 버튼이 데이터보다 먼저) 모두 통과.'}`,
        )
      } finally {
        await ctx.close()
      }
    })
  }
})
