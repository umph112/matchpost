import { createServiceClient } from '@/lib/supabase/service'
import {
  calculateGrade,
  checkCategoryKeywords,
  checkPostKeywordRankings,
  extractBlogId,
  fetchBlogAnalytics,
  jitter,
  kstToday,
  parseNaverDate,
} from './naver'
import type { AnalyticsData, PostRankingResult } from './types'

const BLOG_SCORE_VERSION = 1 // 배점·컷을 바꾸면 올린다 — 과거 등급과 비교 가능하게

async function getInfluencers(userId?: string) {
  const db = createServiceClient()
  let q = db.from('influencer_profiles').select('user_id, blog_url, categories').neq('blog_url', '').not('blog_url', 'is', null)
  if (userId) q = q.eq('user_id', userId)
  const { data } = await q
  return data ?? []
}

async function saveAnalytics(userId: string, blogUrl: string, data: AnalyticsData, batchDate: string) {
  const db = createServiceClient()

  // 전일 대비 방문자 차분(history.visitor_daily) — 기존 스냅샷을 덮어쓰기 전에 조회
  const { data: prevRows } = await db.from('blog_analytics').select('visitor_total').eq('user_id', userId)
  const prevTotal = prevRows?.[0]?.visitor_total ?? null
  const visitorTotal = data.visitor_total
  const visitorDaily =
    visitorTotal != null && prevTotal != null && visitorTotal >= prevTotal ? visitorTotal - prevTotal : null

  await db.from('blog_analytics').upsert(
    { user_id: userId, blog_url: blogUrl, crawled_at: new Date().toISOString(), ...data },
    { onConflict: 'user_id' },
  )

  if (data.error_message) return // 크롤링 실패한 날은 이력을 남기지 않는다(측정 자체가 안 됐으므로)

  const postRankings = data.post_keyword_rankings ?? []
  const allKws = postRankings.flatMap((p) => p.keywords ?? [])
  const exposedKws = allKws.filter((k) => k.found && k.rank)
  const exposureRate = allKws.length > 0 ? Math.round((exposedKws.length / allKws.length) * 1000) / 1000 : null
  const avgRank =
    exposedKws.length > 0
      ? Math.round((exposedKws.reduce((s, k) => s + (k.rank as number), 0) / exposedKws.length) * 10) / 10
      : null

  await db.from('blog_analytics_history').upsert(
    {
      user_id: userId,
      crawled_on: batchDate,
      blog_grade: data.blog_grade ?? null,
      grade_score: data.grade_score ?? null,
      visitor_total: visitorTotal,
      visitor_daily: visitorDaily,
      neighbor_count: data.neighbor_count,
      post_count: data.post_count,
      post_frequency: data.post_frequency,
      exposure_rate: exposureRate,
      avg_rank: avgRank,
      missing_metrics: data.missing_metrics ?? null,
      score_version: BLOG_SCORE_VERSION,
    },
    { onConflict: 'user_id,crawled_on' },
  )
}

async function savePostRankings(userId: string, batchDate: string, postRankings: PostRankingResult[]) {
  const db = createServiceClient()
  for (const p of postRankings) {
    const kws = p.keywords ?? []
    const exposed = kws.filter((k) => k.found && k.rank)
    await db.from('blog_post_rankings').upsert(
      {
        user_id: userId,
        log_no: p.log_no,
        published_on: p.published_on || batchDate,
        checked_on: batchDate,
        title: p.title,
        keywords: kws,
        exposure_rate: kws.length > 0 ? Math.round((exposed.length / kws.length) * 1000) / 1000 : null,
        avg_rank:
          exposed.length > 0
            ? Math.round((exposed.reduce((s, k) => s + (k.rank as number), 0) / exposed.length) * 10) / 10
            : null,
      },
      { onConflict: 'user_id,log_no,checked_on' },
    )
  }
}

export type BlogAnalyzerRunResult = {
  batchDate: string
  total: number
  results: Array<{ userId: string; blogId: string | null; ok: boolean; error?: string }>
}

export async function runBlogAnalyzerBatch(opts?: { userId?: string; skipKeywords?: boolean }): Promise<BlogAnalyzerRunResult> {
  const batchDate = kstToday() // 배치 시작일 기준 고정 — 자정을 넘겨도 이 실행 내내 같은 날짜
  const influencers = await getInfluencers(opts?.userId)
  const results: BlogAnalyzerRunResult['results'] = []

  for (const inf of influencers) {
    const uid = inf.user_id as string
    const url = (inf.blog_url as string) ?? ''
    const categories = (inf.categories as string[]) ?? []

    // 실패해도 다음 유저로 계속 — 로그만 남기고 넘어간다(다음 배치에서 자연히 재시도됨)
    try {
      const blogId = extractBlogId(url)
      if (!blogId) {
        await saveAnalytics(
          uid,
          url,
          {
            blog_id: null, neighbor_count: null, visitor_today: null, visitor_total: null,
            post_count: null, avg_likes: null, avg_comments: null, last_post_date: null,
            post_frequency: null, error_message: '네이버 블로그 URL 아님',
          },
          batchDate,
        )
        results.push({ userId: uid, blogId: null, ok: false, error: 'not_naver_blog' })
        continue
      }

      const { data, posts } = await fetchBlogAnalytics(blogId)

      if (!opts?.skipKeywords && !data.error_message) {
        // 그날 발행한 포스팅만, 최대 5개
        const todayPosts = posts.filter((p) => parseNaverDate(p.addDate || '') === batchDate).slice(0, 5)

        let postRankings: PostRankingResult[] = []
        if (todayPosts.length > 0) {
          postRankings = await checkPostKeywordRankings(blogId, todayPosts)
          data.post_keyword_rankings = postRankings
          await savePostRankings(uid, batchDate, postRankings)
        }

        const kwData = await checkCategoryKeywords(blogId, categories)
        data.keyword_rankings = kwData.keyword_rankings
        data.top10_count = kwData.top10_count
        data.top30_count = kwData.top30_count

        const { grade, score, missing } = calculateGrade(data, postRankings)
        data.blog_grade = grade
        data.grade_score = score
        data.missing_metrics = missing
      }

      await saveAnalytics(uid, url, data, batchDate)
      results.push({ userId: uid, blogId, ok: !data.error_message, error: data.error_message ?? undefined })
    } catch (e) {
      console.error(`[blog-analyzer] ${uid} 처리 실패`, e)
      results.push({ userId: uid, blogId: null, ok: false, error: e instanceof Error ? e.message : String(e) })
    }

    await jitter(1500, 3000) // 인플루언서 사이 대기 — Naver 레이트리밋 회피
  }

  return { batchDate, total: influencers.length, results }
}
