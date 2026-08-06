// scripts/blog_analyzer.py의 크롤링·산식 로직을 TS로 이식(Vercel Cron에서 Python을 못 돌려서).
// 기존 Python 스크립트는 로컬 수동 실행/디버깅용으로 남겨둔다 — 운영 배치는 이 모듈 기준.
import type { AnalyticsData, CategoryKeywordResult, NaverPost, PostKeywordResult, PostRankingResult } from './types'

const PC_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  Referer: 'https://www.naver.com/',
}
const MOBILE_HEADERS: Record<string, string> = {
  ...PC_HEADERS,
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
}

// 카테고리별 보조 키워드 (포스팅 노출 체크가 메인, 이건 보완용 — 3개로 축소)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  스타일: ['스타일링 추천', '코디 추천', '데일리룩'],
  패션: ['패션 추천', '옷 코디', '브랜드 추천'],
  뷰티: ['뷰티 리뷰', '화장품 추천', '스킨케어 추천'],
  라이프: ['라이프스타일', '생활 꿀팁', '일상 공유'],
  리빙: ['인테리어 추천', '집꾸미기', '홈데코'],
  육아: ['육아 일기', '아기 용품 추천', '육아 꿀팁'],
  생활건강: ['건강 관리', '영양제 추천', '다이어트 식단'],
  푸드: ['맛집 추천', '레시피', '맛집 탐방'],
  여행: ['국내여행', '해외여행 추천', '여행 후기'],
  '동물/펫': ['반려동물 용품', '강아지 추천', '고양이 추천'],
  '스포츠/운동/레저': ['운동 루틴', '헬스 추천', '홈트 추천'],
  프로스포츠: ['프로야구 분석', '축구 분석', '스포츠 뉴스'],
  게임: ['게임 리뷰', '게임 공략', '모바일 게임 추천'],
  '테크/IT': ['IT 제품 리뷰', '스마트폰 리뷰', '노트북 추천'],
  자동차: ['자동차 리뷰', '신차 시승기', '전기차 추천'],
  '방송/연예': ['드라마 추천', '연예 뉴스', '예능 추천'],
  대중음악: ['음악 추천', '앨범 리뷰', '신곡 추천'],
  컬처: ['전시회 추천', '공연 후기', '문화생활'],
  '영화/공연/전시/예술': ['영화 리뷰', '공연 추천', '전시회 후기'],
  도서: ['책 추천', '독서 후기', '베스트셀러'],
  '경제/비즈니스': ['재테크', '주식 추천', '경제 뉴스'],
  '어학/교육': ['영어 공부법', '자격증 공부', '공부 꿀팁'],
  기타: ['솔직 후기', '생활 정보', '사용 후기'],
}
const DEFAULT_KEYWORDS = ['솔직 후기', '생활 정보', '사용 후기']

const STOPWORDS = new Set([
  '의', '가', '이', '은', '는', '을', '를', '에', '에서', '과', '와', '로', '으로', '도', '만',
  '한', '하는', '하고', '더', '정말', '진짜', '완전', '너무', '아주', '매우', '제', '내',
  '그', '저', '것', '수', '등', '때', '후', '전', '중', '안', '위', '아래', '및', '또는',
  '그리고', '하면', '부터', '까지', '에게',
])

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const jitter = (minMs: number, maxMs: number) => sleep(minMs + Math.random() * (maxMs - minMs))

// ── KST 날짜 유틸 — 배치가 자정을 넘겨도 이 함수들 기준으로 같은 날짜를 유지한다 ──────
export function kstDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d)
}
export function kstToday(): string {
  return kstDateString(new Date())
}
function kstDateDaysAgo(n: number): string {
  return kstDateString(new Date(Date.now() - n * 86400000))
}
function daysBetween(earlier: string, later: string): number {
  const a = new Date(`${earlier}T00:00:00Z`).getTime()
  const b = new Date(`${later}T00:00:00Z`).getTime()
  return Math.round((b - a) / 86400000)
}

// ── URL 파싱 ──────────────────────────────────────────────────────────────
export function extractBlogId(url: string): string | null {
  let u = url.trim()
  if (!u) return null
  if (!u.startsWith('http')) u = 'https://' + u
  try {
    const parsed = new URL(u)
    if (!parsed.hostname.includes('blog.naver.com')) return null
    const path = parsed.pathname.replace(/^\/+|\/+$/g, '')
    if (!path) return null
    return path.split('/')[0] || null
  } catch {
    return null
  }
}

export function parseNaverDate(s: string): string | null {
  s = (s || '').trim()
  let m = s.match(/^(\d+)\s*일\s*전/)
  if (m) return kstDateDaysAgo(parseInt(m[1], 10))
  m = s.match(/^(\d+)\s*시간\s*전/)
  if (m) return kstToday()
  if (s.includes('분') || s.includes('방금')) return kstToday()
  m = s.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/)
  if (m) {
    const y = m[1]
    const mo = m[2].padStart(2, '0')
    const d = m[3].padStart(2, '0')
    return `${y}-${mo}-${d}`
  }
  return null
}

function unquotePlus(s: string): string {
  const withSpaces = s.replace(/\+/g, ' ')
  try {
    return decodeURIComponent(withSpaces)
  } catch {
    return withSpaces
  }
}

function stripHtml(html: string): string {
  // BeautifulSoup.get_text() 근사 — script/style 제거 후 태그 제거
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
}

// ── 크롤링 ────────────────────────────────────────────────────────────────
async function getText(url: string, headers: Record<string, string>, timeoutMs = 12000): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers, signal: controller.signal })
    if (res.status === 200) return await res.text()
    return null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchBlogAnalytics(blogId: string): Promise<{ data: AnalyticsData; posts: NaverPost[] }> {
  const data: AnalyticsData = {
    blog_id: blogId,
    neighbor_count: null,
    visitor_today: null,
    visitor_total: null,
    post_count: null,
    avg_likes: null,
    avg_comments: null,
    last_post_date: null,
    post_frequency: null,
    error_message: null,
  }
  let posts: NaverPost[] = []

  const html = await getText(`https://m.blog.naver.com/${blogId}`, MOBILE_HEADERS)
  if (!html) {
    data.error_message = '블로그 페이지 접근 실패'
    return { data, posts }
  }

  const text = stripHtml(html)
  const neighborM = text.match(/([\d,]+)\s*명의\s*이웃/)
  if (neighborM) data.neighbor_count = parseInt(neighborM[1].replace(/,/g, ''), 10)

  const visitorM = text.match(/오늘\s*([\d,]+)\s*전체\s*([\d,]+)/)
  if (visitorM) {
    data.visitor_today = parseInt(visitorM[1].replace(/,/g, ''), 10)
    data.visitor_total = parseInt(visitorM[2].replace(/,/g, ''), 10)
  }

  const listUrl = `https://blog.naver.com/PostTitleListAsync.naver?blogId=${blogId}&viewdate=&currentPage=1&categoryNo=&countPerPage=10&orderby=desc`
  const raw = await getText(listUrl, PC_HEADERS)
  if (raw) {
    try {
      let parsed: { postList?: NaverPost[]; totalCount?: number }
      try {
        parsed = JSON.parse(raw)
      } catch {
        const fixed = raw.replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
        parsed = JSON.parse(fixed)
      }
      posts = parsed.postList || []
      data.post_count = parsed.totalCount ?? null

      if (posts.length > 0) {
        data.last_post_date = parseNaverDate(posts[0]?.addDate || '')

        const commentCounts = posts
          .map((p) => String(p.commentCount ?? ''))
          .filter((c) => /^\d+$/.test(c))
          .map((c) => parseInt(c, 10))
        if (commentCounts.length > 0) {
          data.avg_comments = Math.round((commentCounts.reduce((a, b) => a + b, 0) / commentCounts.length) * 10) / 10
        }

        const dated = posts.map((p) => parseNaverDate(p.addDate || '')).filter((d): d is string => !!d)
        if (dated.length >= 2) {
          const spanDays = Math.max(1, daysBetween(dated[dated.length - 1], dated[0]))
          data.post_frequency = Math.round((dated.length / spanDays) * 30 * 10) / 10
        }
      }
    } catch (e) {
      data.error_message = `포스트 목록 파싱 오류: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  return { data, posts }
}

// ── 네이버 블로그 검색 API ────────────────────────────────────────────────
async function naverBlogSearch(query: string, display = 100): Promise<Array<{ link?: string; bloggerlink?: string; title?: string }> | null> {
  const clientId = process.env.NAVER_API_CLIENT_ID
  const clientSecret = process.env.NAVER_API_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  try {
    const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=${display}&sort=sim`
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    })
    if (res.status === 200) {
      const j = await res.json()
      return j.items || []
    }
    if (res.status === 429) {
      console.warn('[blog-analyzer] Naver API quota exceeded')
      return null
    }
  } catch (e) {
    console.error('[blog-analyzer] search failed', e)
  }
  return []
}

async function checkPostRank(blogId: string, logNo: string, query: string): Promise<{ found: boolean; rank: number | null }> {
  const items = await naverBlogSearch(query, 100)
  if (items === null) return { found: false, rank: null }
  for (let i = 0; i < items.length; i++) {
    const link = items[i]?.link || ''
    if (link.toLowerCase().includes(blogId.toLowerCase()) && link.includes(logNo)) {
      return { found: true, rank: i + 1 }
    }
  }
  return { found: false, rank: null }
}

// ── 포스팅 제목 키워드 추출(2-gram) ───────────────────────────────────────
export function extractKeywords(title: string): string[] {
  const cleaned = title.replace(/[^\w\s가-힣]/g, ' ')
  const words = cleaned.split(/\s+/).filter((w) => w.length >= 2 && !STOPWORDS.has(w))
  const grams: string[] = []
  for (let i = 0; i < words.length - 1; i++) grams.push(`${words[i]} ${words[i + 1]}`)
  return [...new Set(grams)].slice(0, 3)
}

// ── 포스팅 단위 노출 체크 ─────────────────────────────────────────────────
export async function checkPostKeywordRankings(blogId: string, posts: NaverPost[]): Promise<PostRankingResult[]> {
  const results: PostRankingResult[] = []
  const checkPosts = posts.slice(0, 5)

  for (const post of checkPosts) {
    const title = unquotePlus((post.title || '').replace(/<[^>]+>/g, '')).trim()
    const logNo = String(post.logNo || '')
    const publishedOn = parseNaverDate(post.addDate || '')
    if (!title || !logNo) continue

    const titleResult = await checkPostRank(blogId, logNo, title)
    await jitter(300, 600)

    const kwResults: PostKeywordResult[] = []
    for (const kw of extractKeywords(title)) {
      const r = await checkPostRank(blogId, logNo, kw)
      kwResults.push({ keyword: kw, found: r.found, rank: r.rank })
      await jitter(300, 600)
    }

    results.push({
      log_no: logNo,
      title,
      published_on: publishedOn,
      found: titleResult.found,
      rank: titleResult.rank,
      keywords: kwResults,
    })
    await jitter(400, 800)
  }

  return results
}

// ── 카테고리 키워드 보조 체크 ─────────────────────────────────────────────
export async function checkCategoryKeywords(
  blogId: string,
  categories: string[],
): Promise<{ keyword_rankings: CategoryKeywordResult[]; top10_count: number; top30_count: number }> {
  let keywords: string[] = []
  for (const cat of categories || []) {
    if (CATEGORY_KEYWORDS[cat]) keywords.push(...CATEGORY_KEYWORDS[cat])
  }
  if (keywords.length === 0) keywords = DEFAULT_KEYWORDS
  keywords = [...new Set(keywords)].slice(0, 3)

  const results: CategoryKeywordResult[] = []
  for (const keyword of keywords) {
    const items = await naverBlogSearch(keyword, 100)
    if (items === null) break

    let found = false
    let rank: number | null = null
    let postTitle: string | null = null
    for (let i = 0; i < items.length; i++) {
      const blogLink = items[i]?.bloggerlink || ''
      const link = items[i]?.link || ''
      if (blogLink.toLowerCase().includes(blogId.toLowerCase()) || link.toLowerCase().includes(blogId.toLowerCase())) {
        found = true
        rank = i + 1
        postTitle = (items[i]?.title || '').replace(/<[^>]+>/g, '')
        break
      }
    }
    results.push({ keyword, found, rank, post_title: postTitle })
    await jitter(300, 600)
  }

  const top10 = results.filter((r) => r.found && r.rank !== null && r.rank <= 10).length
  const top30 = results.filter((r) => r.found && r.rank !== null && r.rank <= 30).length
  return { keyword_rankings: results, top10_count: top10, top30_count: top30 }
}

// ── 종합 등급 계산 (13단계, 결측 항목 제외 환산) ──────────────────────────
export function calculateGrade(
  data: AnalyticsData,
  postRankings: PostRankingResult[],
): { grade: string; score: number; missing: number } {
  let earned = 0
  let maxPossible = 0
  let missing = 0

  const visitor = data.visitor_today
  const freq = data.post_frequency
  const neighbor = data.neighbor_count

  if (visitor == null) {
    missing += 1
  } else {
    maxPossible += 40
    if (visitor >= 50_000) earned += 40
    else if (visitor >= 20_000) earned += 32
    else if (visitor >= 10_000) earned += 22
    else if (visitor >= 3_000) earned += 10
    else if (visitor >= 1_000) earned += 4
  }

  const allKws = postRankings.flatMap((p) => p.keywords || [])
  const exposedKws = allKws.filter((k) => k.found && k.rank)
  if (allKws.length > 0) {
    maxPossible += 35
    const rate = exposedKws.length / allKws.length
    if (rate >= 0.9) earned += 20
    else if (rate >= 0.7) earned += 15
    else if (rate >= 0.5) earned += 10
    else if (rate >= 0.3) earned += 5
    else if (rate > 0) earned += 2

    if (exposedKws.length > 0) {
      const avgRank = exposedKws.reduce((s, k) => s + (k.rank as number), 0) / exposedKws.length
      if (avgRank <= 3) earned += 15
      else if (avgRank <= 10) earned += 12
      else if (avgRank <= 20) earned += 8
      else if (avgRank <= 50) earned += 4
      else earned += 1
    }
  } else {
    missing += 1
  }

  if (freq == null) {
    missing += 1
  } else {
    maxPossible += 15
    if (freq >= 20) earned += 15
    else if (freq >= 10) earned += 10
    else if (freq >= 4) earned += 6
    else if (freq >= 1) earned += 3
  }

  if (neighbor == null) {
    missing += 1
  } else {
    maxPossible += 10
    if (neighbor >= 100_000) earned += 10
    else if (neighbor >= 30_000) earned += 8
    else if (neighbor >= 10_000) earned += 6
    else if (neighbor >= 3_000) earned += 4
    else if (neighbor >= 1_000) earned += 2
    else if (neighbor >= 300) earned += 1
  }

  const score = maxPossible > 0 ? Math.round((earned / maxPossible) * 100) : 0

  if (score >= 90) return { grade: 'S', score, missing }

  let base: string
  let cuts: [number, number]
  if (score >= 75) { base = 'A'; cuts = [85, 80] }
  else if (score >= 60) { base = 'B'; cuts = [70, 65] }
  else if (score >= 45) { base = 'C'; cuts = [55, 50] }
  else { base = 'D'; cuts = [40, 35] }

  const sub = score >= cuts[0] ? 1 : score >= cuts[1] ? 2 : 3
  return { grade: `${base}-${sub}`, score, missing }
}

export { jitter }
