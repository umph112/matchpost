import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { ADMIN, PASSWORD, ROOT, botEmail, latestScheduleId, loginAs, userIdByEmail } from './_helpers'

// D33 — 두 폭 전수 캡처.
//
// 셸이 user-agent 로 PC/모바일을 가르던 것을 화면 폭(lg = 1024px)으로 바꿨다.
// 셸을 고치면 모든 화면이 한꺼번에 바뀌므로 눈으로 확인할 캡처가 필요하다(D33 문서 5절).
//
// ⚠️ 폭은 프로젝트가 정한다 — pc(1440x900) · mobile(390x844). 한 실행 안에서 폭을 바꾸지 않는다.
//    같은 창에서 폭만 바꾸면 이미 마운트된 화면이 그대로 남아 「폭은 모바일인데 PC 표」 같은
//    실제로는 없는 상태를 찍는다(D33 문서 6절).
//
// 이 스펙은 재는 것이 목적이라 화면 하나가 이상해도 멈추지 않는다. 전부 찍고 끝에서 한 번에 따진다.

type Screen = { file: string; url: string }

const OUT_ROOT = path.join(ROOT, 'docs', 'design', 'd33', 'screens')

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 로그인이 필요 없는 화면. 셸이 없어 지난 회차들이 전부 빠뜨린 자리다(D33 문서 2절).
const PUBLIC: Screen[] = [
  { file: 'pub-home', url: '/' },
  { file: 'pub-intro', url: '/intro' },
  { file: 'pub-login', url: '/login' },
  { file: 'pub-signup', url: '/signup' },
  { file: 'pub-pending', url: '/pending' },
  { file: 'pub-terms', url: '/terms' },
  { file: 'pub-privacy', url: '/privacy' },
]

const ADV: Screen[] = [
  { file: 'adv-dashboard', url: '/advertiser/dashboard' },
  { file: 'adv-campaigns', url: '/advertiser/campaigns' },
  { file: 'adv-campaign-new', url: '/advertiser/campaigns/new' },
  { file: 'adv-connections', url: '/advertiser/connections' },
  { file: 'adv-messages', url: '/advertiser/messages' },
  { file: 'adv-notifications', url: '/advertiser/notifications' },
  { file: 'adv-proposal-new', url: '/advertiser/proposals/new' },
  { file: 'adv-search', url: '/advertiser/search' },
  { file: 'adv-settlements', url: '/advertiser/settlements' },
  { file: 'adv-team', url: '/advertiser/team' },
  { file: 'adv-team-leaves', url: '/advertiser/team/leaves' },
  { file: 'adv-team-workload', url: '/advertiser/team/workload' },
  { file: 'adv-day', url: `/day/${today()}` },
  // 셸 밖이지만 로그인이 필요한 화면들
  { file: 'adv-credits', url: '/credits' },
  { file: 'adv-credits-about', url: '/credits/about' },
  { file: 'adv-profile', url: '/profile' },
]

const INF: Screen[] = [
  { file: 'inf-dashboard', url: '/influencer/dashboard' },
  { file: 'inf-earnings', url: '/influencer/earnings' },
  { file: 'inf-proposals', url: '/influencer/proposals' },
  { file: 'inf-profile', url: '/influencer/profile' },
  { file: 'inf-notifications', url: '/influencer/notifications' },
  { file: 'inf-search', url: '/influencer/search' },
  { file: 'inf-channel-analytics', url: '/influencer/channel-analytics' },
  { file: 'inf-schedule-new', url: '/influencer/schedule' },
  { file: 'inf-schedule-list', url: '/influencer/schedule/list' },
  { file: 'inf-messages', url: '/influencer/messages' },
  { file: 'inf-day', url: `/day/${today()}` },
]

const ADMIN_SCREENS: Screen[] = [
  { file: 'admin-dashboard', url: '/admin/dashboard' },
  { file: 'admin-users', url: '/admin/users' },
  { file: 'admin-credits', url: '/admin/credits' },
  { file: 'admin-credits-policy', url: '/admin/credits/policy' },
  { file: 'admin-reports', url: '/admin/reports' },
  { file: 'admin-sanctions', url: '/admin/sanctions' },
]

// 모바일 폭에서 가로 스크롤이 나도 「셸 결함」으로 세지 않는 화면.
//
// · admin-* — 관리자는 PC 전용이다(D33 문서 3절). admin/layout.tsx:41 이 min-w-[1360px] 로
//   시작하는 것은 D33 이전부터 그랬고 의도된 것이다.
// · adv-team-leaves — LeavesView 가 전부 인라인 스타일로 짜인 PC 전용 설계다
//   (137행 padding:28, 165행 minmax(0,1fr) 340px). 반응형 규칙이 하나도 없어 셸과 무관하게
//   390px 에서 8px 넘친다. 문서 3절이 「팀 관리」를 광고주 모바일에서 PC 로 보내도 되는 것으로
//   꼽았으니, 만들지 보낼지는 사용자가 정한다 — B 부류다.
//
// ⚠️ 여기 이름을 적는 순간 그 화면은 봇이 안 본다. 새로 넘치는 화면은 그대로 실패해야 하므로
//    「일단 넣고 나중에 본다」로 쓰지 말 것.
const PC_ONLY = ['adv-team-leaves']

// ── 잰 값 ──────────────────────────────────────────────────────────
type Row = {
  화면: string
  주소: string
  도착: string
  본문폭: number
  본문안쪽: number
  콘텐츠폭: number
  첫칸폭: number
  창폭: number
  가로스크롤: boolean
  범인: string[]
  사이드바: number
  하단탭: number
}
const rows: Row[] = []
const skipped: string[] = []

async function capture(page: Page, s: Screen, dir: string) {
  await page.goto(s.url, { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(700)
  fs.mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: path.join(dir, `${s.file}.png`), fullPage: true })

  // 「눌렀다」가 아니라 「몇 px 이다」를 본다 — 추측으로 A 에 넣지 말라는 지시(D33 문서 2절).
  const m = await page.evaluate(() => {
    const w = (el: Element | null | undefined) => (el ? Math.round(el.getBoundingClientRect().width) : -1)
    const visible = (el: Element) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0
    // 셸이 없는 화면은 <main> 이 없다. 그때는 body 아래에서 실제로 폭을 가진 첫 칸을 쓴다.
    // (firstElementChild 로 잡으면 next 의 0px 짜리 script·route-announcer 를 재서
    //  「본문 0px」이라는 재지도 못한 값이 「문제없음」처럼 표에 남는다)
    const main = document.querySelector('main')
    const box = main ?? [...document.body.children].find((el) => el.getBoundingClientRect().width > 0) ?? null
    // <main> 이 있으면 셸이 폭을 정한 것이니 그 값이 곧 본문 폭이다.
    // <main> 이 없는 화면(/day/[date] · /credits · 공개 화면)은 바깥 래퍼가 창 전체를 덮어
    // 「1440px 이니 안 갇혔다」로 보인다 — 스스로 폭을 제한한 가장 바깥 칸을 대신 잰다.
    let inner = box
    if (!main && box) {
      const capped = [...box.querySelectorAll('*')].find(
        (el) => getComputedStyle(el).maxWidth !== 'none' && el.getBoundingClientRect().width > 0,
      )
      if (capped) inner = capped
    }

    // 첫칸이 본문을 다 쓰는지 보려면 본문의 「안쪽 폭」(패딩 뺀 값)과 견줘야 한다.
    // 본문폭과 그냥 비교하면 정상인 화면도 좌우 패딩(px-7=56px)만큼 늘 좁게 나온다.
    const inset = (el: Element | null) => {
      if (!el) return -1
      const cs = getComputedStyle(el)
      return Math.round(el.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))
    }

    return {
      본문폭: w(box),
      본문안쪽: inset(box),
      콘텐츠폭: w(inner),
      첫칸폭: w(box?.firstElementChild),
      창폭: window.innerWidth,
      가로스크롤: document.documentElement.scrollWidth > window.innerWidth + 1,
      // 넘칠 때 어디가 넘치는지까지 재둔다 — 「가로 스크롤 있음」만 알면 결국 눈으로 찾아야 한다.
      범인: [...document.querySelectorAll('body *')]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.right > window.innerWidth + 1)
        .sort((a, b) => b.r.right - a.r.right)
        .slice(0, 3)
        .map(({ el, r }) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(/\s+/).slice(0, 4).join('.')} →${Math.round(r.right)}px`),
      사이드바: w([...document.querySelectorAll('aside')].find(visible)),
      하단탭: w([...document.querySelectorAll('nav')].filter(visible).find((n) => getComputedStyle(n).position === 'fixed')),
    }
  })

  const row: Row = { 화면: s.file, 주소: s.url, 도착: new URL(page.url()).pathname, ...m }
  rows.push(row)
  const 벗어남 = row.도착 !== s.url ? `  ↪ ${row.도착}` : ''
  console.log(
    `[D33] ${s.file.padEnd(22)} 본문 ${String(row.본문폭).padStart(5)}px · 내용 ${String(row.콘텐츠폭).padStart(5)}px · 첫칸 ${String(row.첫칸폭).padStart(5)}px` +
      ` · 사이드바 ${row.사이드바 > 0 ? `${row.사이드바}px` : '—'} · 하단탭 ${row.하단탭 > 0 ? `${row.하단탭}px` : '—'}` +
      `${row.가로스크롤 ? ` · ⚠️가로스크롤 [${row.범인.join(' | ')}]` : ''}${벗어남}`,
  )
}

// 목록 화면에서 상세 주소를 얻는다. 스펙에 id 를 박아두면 그 데이터가 사라진 다음
// 실행부터 404 를 찍는데, 404 에는 셸이 없어 「셸이 깨졌다」로 잘못 읽힌다(D30 [2]).
async function hrefFrom(page: Page, listUrl: string, prefix: string): Promise<string | null> {
  await page.goto(listUrl, { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(400)
  const href = await page.evaluate((p) => {
    const a = [...document.querySelectorAll('a[href]')]
      .map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? '')
      .find((h) => h.startsWith(p) && h.length > p.length)
    return a ?? null
  }, prefix)
  return href
}

async function run(
  browser: Browser,
  viewport: { width: number; height: number },
  dir: string,
  email: string,
  waitUrl: string,
  screens: Screen[],
  extra?: (page: Page) => Promise<Screen[]>,
) {
  let sess: { ctx: BrowserContext; page: Page }
  try {
    sess = await loginAs(browser, email, PASSWORD, waitUrl, viewport)
  } catch (e) {
    // 계정이 없으면 그 역할 전체를 「미검증」으로 남긴다 — 조용히 건너뛰면 「다 봤다」가 거짓이 된다.
    skipped.push(`${email} 로그인 실패 (${screens.map((s) => s.file).join(', ')}) — ${(e as Error).message.slice(0, 80)}`)
    return
  }
  try {
    const list = extra ? [...screens, ...(await extra(sess.page))] : screens
    for (const s of list) await capture(sess.page, s, dir)
  } finally {
    await sess.ctx.close()
  }
}

test('[D33] 전 화면 두 폭 캡처', async ({ browser }, info) => {
  // 40여 화면을 한 테스트에서 찍는다 — 기본 120초로는 중간에 잘린다.
  test.setTimeout(20 * 60_000)
  const viewport = info.project.use.viewport ?? { width: 1440, height: 900 }
  const dir = path.join(OUT_ROOT, info.project.name)
  console.log(`\n[D33] ${info.project.name} — ${viewport.width}x${viewport.height} → ${dir}\n`)

  // ── 공개 화면 (로그인 없음) ──
  {
    const ctx = await browser.newContext({ viewport })
    const page = await ctx.newPage()
    try {
      for (const s of PUBLIC) await capture(page, s, dir)
    } finally {
      await ctx.close()
    }
  }

  // ── 광고주 ──
  await run(browser, viewport, dir, botEmail('adv'), '**/advertiser/**', ADV, async (page) => {
    const found: Screen[] = []
    const campaign = await hrefFrom(page, '/advertiser/campaigns', '/advertiser/campaigns/')
    if (campaign && !campaign.endsWith('/new')) found.push({ file: 'adv-campaign-detail', url: campaign })
    else skipped.push('adv-campaign-detail — 이 계정에 캠페인이 없어요 (미검증)')

    const msg = await hrefFrom(page, '/advertiser/messages', '/advertiser/messages/')
    if (msg) found.push({ file: 'adv-message-detail', url: msg })
    else skipped.push('adv-message-detail — 대화가 없어요 (미검증)')

    const deal = await hrefFrom(page, '/advertiser/dashboard', '/advertiser/deals/')
    if (deal) found.push({ file: 'adv-deal', url: deal })
    else skipped.push('adv-deal — 대시보드에 딜시트 링크가 없어요 (미검증)')

    const leaver = await hrefFrom(page, '/advertiser/team/leaves', '/advertiser/team/handover/')
    if (leaver) found.push({ file: 'adv-handover', url: leaver })
    else skipped.push('adv-handover — 이관 대기자가 없어요 (미검증)')
    return found
  })

  // ── 인플루언서 ──
  await run(browser, viewport, dir, botEmail('inf-pc'), '**/influencer/**', INF, async (page) => {
    const found: Screen[] = []
    const openId = await latestScheduleId(botEmail('inf-pc')).catch(() => null)
    if (openId) found.push({ file: 'inf-schedule-detail', url: `/influencer/schedule/${openId}` })
    else skipped.push('inf-schedule-detail — 이 계정에 오픈이 없어요 (미검증)')

    const msg = await hrefFrom(page, '/influencer/messages', '/influencer/messages/')
    if (msg) found.push({ file: 'inf-message-detail', url: msg })
    else skipped.push('inf-message-detail — 대화가 없어요 (미검증)')

    const deal = await hrefFrom(page, '/influencer/dashboard', '/influencer/deals/')
    if (deal) found.push({ file: 'inf-deal', url: deal })
    else skipped.push('inf-deal — 대시보드에 딜시트 링크가 없어요 (미검증)')

    // 공개 프로필은 셸 밖이라 규격이 따로다(D33 문서 4절).
    const infId = await userIdByEmail(botEmail('inf-pc')).catch(() => null)
    const advId = await userIdByEmail(botEmail('adv')).catch(() => null)
    if (infId) found.push({ file: 'pub-influencer-detail', url: `/influencer/${infId}` })
    if (advId) found.push({ file: 'pub-advertiser-detail', url: `/advertiser/${advId}` })
    if (!infId || !advId) skipped.push('pub-*-detail — 봇 계정을 못 찾았어요 (미검증)')
    return found
  })

  // ── 관리자 (PC 전용 화면이지만 모바일 폭에서 깨지는지도 본다) ──
  await run(browser, viewport, dir, ADMIN.email, '**/admin/**', ADMIN_SCREENS, async (page) => {
    const report = await hrefFrom(page, '/admin/reports', '/admin/reports/')
    if (report && !report.endsWith('/policy')) return [{ file: 'admin-report-detail', url: report }]
    skipped.push('admin-report-detail — 신고가 없어요 (미검증)')
    return []
  })

  // ── 표로 남긴다. 「확인 필요」 6개와 B 5개를 이 숫자로 확정한다 ──
  fs.mkdirSync(OUT_ROOT, { recursive: true })
  fs.writeFileSync(
    path.join(OUT_ROOT, `measure-${info.project.name}.json`),
    JSON.stringify({ project: info.project.name, viewport, rows, skipped }, null, 2),
    'utf8',
  )
  if (skipped.length) console.log(`\n[D33] 미검증 ${skipped.length}건\n  - ${skipped.join('\n  - ')}`)

  // ── 여기서만 따진다. 위에서 멈추면 나머지 화면을 못 본다 ──
  const pc = viewport.width >= 1024
  // 바깥 래퍼가 아니라 내용 칸으로 본다 — 래퍼만 보면 갇힌 화면을 「안 갇혔다」고 말한다.
  // 공개 화면은 뺀다: 문서 4절이 따로 규격을 준다(로그인·가입은 420px 카드, 약관은 720px).
  const 갇힘 = rows
    .filter((r) => pc && !r.화면.startsWith('pub-') && r.콘텐츠폭 > 0 && r.콘텐츠폭 <= 512)
    .map((r) => `${r.화면}(본문 ${r.본문폭}px 안에서 내용 ${r.콘텐츠폭}px)`)
  const 넘침 = rows.filter((r) => !pc && r.가로스크롤)
  const 알려진 = 넘침.filter((r) => r.화면.startsWith('admin-') || PC_ONLY.includes(r.화면)).map((r) => r.화면)
  const 결함넘침 = 넘침
    .filter((r) => !r.화면.startsWith('admin-') && !PC_ONLY.includes(r.화면))
    .map((r) => `${r.화면} [${r.범인[0] ?? '?'}]`)
  // 첫칸이 본문 안쪽보다 좁으면 래퍼가 쪼그라든 것이다 — PC 해제에 mx-0 이 빠졌을 때 나온다.
  // 셸의 <main> 은 PC 에서 flex flex-col 이라, 래퍼에 mx-auto 가 남아 있으면
  // auto 가로여백이 align-items: stretch 를 무력화해 내용 폭으로 줄어든다.
  // 증상이 「갇힘」이 아니라 「가운데 좁은 기둥」이라 512 검사로는 안 잡혔다(D33).
  // 셸이 있는 화면(adv-·inf-)만 본다 — 마커 셸 밖에는 이 함정이 없다.
  const 쪼그라듦 = rows
    .filter((r) => pc && /^(adv|inf)-/.test(r.화면) && r.본문안쪽 > 0 && r.첫칸폭 > 0 && r.첫칸폭 < r.본문안쪽 - 1)
    .map((r) => `${r.화면}(본문 안쪽 ${r.본문안쪽}px 인데 첫칸 ${r.첫칸폭}px)`)
  console.log(`\n[D33] ${rows.length}개 화면 · 512 갇힘 ${갇힘.length} · 쪼그라듦 ${쪼그라듦.length} · 가로스크롤 ${결함넘침.length}`)
  if (알려진.length) console.log(`[D33] PC 전용이라 셈에서 뺀 것 ${알려진.length}개: ${알려진.join(', ')}`)
  console.log('')
  expect(갇힘, `PC 폭인데 본문이 512px 에 갇힘: ${갇힘.join(', ')}`).toEqual([])
  expect(
    쪼그라듦,
    `PC 해제에 mx-0 이 빠져 래퍼가 쪼그라듦(max-w-none · mx-0 · px-0 이 한 벌이다): ${쪼그라듦.join(', ')}`,
  ).toEqual([])
  expect(결함넘침, `모바일 폭에서 가로 스크롤: ${결함넘침.join(', ')}`).toEqual([])
})
