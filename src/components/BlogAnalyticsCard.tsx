'use client'

import { useState } from 'react'
import Link from 'next/link'

export type PostKwDetail = {
  keyword: string
  found: boolean
  rank: number | null
}

export type PostKeywordRanking = {
  log_no: string
  title: string
  found: boolean
  rank: number | null
  keywords?: PostKwDetail[]
}

export type KeywordRanking = {
  keyword: string
  found: boolean
  rank: number | null
  post_title: string | null
}

export type BlogAnalytics = {
  blog_id?: string | null
  neighbor_count?: number | null
  visitor_today?: number | null
  visitor_total?: number | null
  post_count?: number | null
  avg_comments?: number | null
  last_post_date?: string | null
  post_frequency?: number | null
  post_keyword_rankings?: PostKeywordRanking[] | null
  keyword_rankings?: KeywordRanking[] | null
  top10_count?: number | null
  top30_count?: number | null
  blog_grade?: string | null
  crawled_at?: string | null
}

// ── 공통 유틸 ──────────────────────────────────────────────────────────────

const GRADE_STYLE: Record<string, { bg: string; text: string }> = {
  S:   { bg: '#FEF3C7', text: '#B45309' },
  A:   { bg: '#DBEAFE', text: '#1D4ED8' },
  B:   { bg: '#DCFCE7', text: '#15803D' },
  C:   { bg: '#F1F1F4', text: '#5C5C68' },
  D:   { bg: '#F1F1F4', text: '#9A9AA5' },
}

function gradeStyle(grade: string | null | undefined) {
  const base = grade?.charAt(0) ?? 'D'
  return GRADE_STYLE[base] ?? GRADE_STYLE['D']
}

function RankBadge({ rank, size = 'sm' }: { rank: number | null | undefined; size?: 'sm' | 'xs' }) {
  if (!rank) return null
  const cls = rank <= 3  ? 'text-[#1D4ED8] font-extrabold'
            : rank <= 10 ? 'text-[#1D4ED8] font-bold'
            : rank <= 30 ? 'text-[#D97706] font-bold'
            : 'text-[#9A9AA5] font-semibold'
  return (
    <span className={`${cls} ${size === 'xs' ? 'text-[10px]' : 'text-[11px]'} shrink-0`}>
      {rank}위
    </span>
  )
}

function fmtNum(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`
  if (n >= 1000)  return `${(n / 1000).toFixed(1)}K`
  return String(n)
}


// ── Compact: 검색 카드 한 줄 요약 ─────────────────────────────────────────

export function BlogAnalyticsCompact({ data }: { data: BlogAnalytics | null }) {
  if (!data?.blog_id) return null
  const postRankings = data.post_keyword_rankings ?? []
  const exposedCount = postRankings.filter((p) => p.found).length
  if (!data.blog_grade && !data.neighbor_count && !postRankings.length) return null

  const s = gradeStyle(data.blog_grade)
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10.5px] text-[#B0B0BB]">블로그</span>
      {data.blog_grade && (
        <span className="text-[10.5px] font-bold rounded-md px-2 py-[2px]"
          style={{ background: s.bg, color: s.text }}>
          {data.blog_grade}
        </span>
      )}
      {data.neighbor_count != null && (
        <span className="text-[10.5px] font-semibold bg-[#F1F1F4] text-[#5C5C68] rounded px-1.5 py-[2px]">
          이웃 {fmtNum(data.neighbor_count)}
        </span>
      )}
      {data.post_count != null && (
        <span className="text-[10.5px] font-semibold bg-[#F1F1F4] text-[#5C5C68] rounded px-1.5 py-[2px]">
          글 {data.post_count}
        </span>
      )}
      {postRankings.length > 0 && (
        <span className={`text-[10.5px] font-semibold rounded px-1.5 py-[2px] ${
          exposedCount > 0 ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#F1F1F4] text-[#9A9AA5]'}`}>
          노출 {exposedCount}/{postRankings.length}
        </span>
      )}
    </div>
  )
}


// ── PostRow: 포스팅 한 행 (접었다 펴기) ────────────────────────────────────

function PostRow({ post }: { post: PostKeywordRanking }) {
  const [open, setOpen] = useState(false)
  const hasKeywords = (post.keywords ?? []).length > 0

  return (
    <div className="border border-[#EAEAEE] rounded-xl overflow-hidden">
      {/* 포스팅 헤더 행 */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#F6F6F7] transition"
        onClick={() => hasKeywords && setOpen((v) => !v)}
        disabled={!hasKeywords}
      >
        {/* 노출/미노출 뱃지 */}
        <span className={`text-[10px] font-bold rounded px-1.5 py-[2px] shrink-0 ${
          post.found ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>
          {post.found ? '노출' : '미노출'}
        </span>
        {/* 제목 */}
        <span className="text-[12px] text-[#3C3C46] truncate flex-1">{post.title}</span>
        {/* 순위 */}
        <RankBadge rank={post.rank} />
        {/* 펼치기 화살표 */}
        {hasKeywords && (
          <span className="text-[10px] text-[#C4C4CE] shrink-0 ml-1">
            {open ? '▲' : '▼'}
          </span>
        )}
      </button>

      {/* 키워드별 상세 (펼쳐졌을 때) */}
      {open && (
        <div className="border-t border-[#F1F1F4] bg-[#FAFAFA] px-3 py-2 space-y-1.5">
          {(post.keywords ?? []).map((kw) => (
            <div key={kw.keyword} className="flex items-center gap-2">
              <span className={`text-[9px] font-bold rounded px-1 py-[1px] shrink-0 ${
                kw.found ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#F1F1F4] text-[#9A9AA5]'}`}>
                {kw.found ? '노출' : '미노출'}
              </span>
              <span className="text-[11.5px] text-[#5C5C68] flex-1 truncate">#{kw.keyword}</span>
              <RankBadge rank={kw.rank} size="xs" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ── Full: 인플루언서 마이페이지 ────────────────────────────────────────────

export function BlogAnalyticsFull({ data }: { data: BlogAnalytics | null }) {
  if (!data?.blog_id) return null

  const postRankings = data.post_keyword_rankings ?? []
  const kwRankings   = data.keyword_rankings ?? []
  const exposedCount = postRankings.filter((p) => p.found).length
  const s = gradeStyle(data.blog_grade)

  const stats = [
    { label: '이웃 수',        value: data.neighbor_count != null ? `${data.neighbor_count.toLocaleString()}명` : '비공개' },
    { label: '오늘 방문자',    value: data.visitor_today  != null ? `${data.visitor_today.toLocaleString()}명`  : '비공개' },
    { label: '총 글 수',       value: data.post_count     != null ? `${data.post_count}개`                      : '—' },
    { label: '월 평균 포스팅', value: data.post_frequency != null ? `${data.post_frequency}회`                  : '—' },
  ]

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-gray-800">블로그 분석</h2>
          {data.blog_grade && (
            <span className="text-[13px] font-bold rounded-md px-2.5 py-1"
              style={{ background: s.bg, color: s.text }}>
              {data.blog_grade}
            </span>
          )}
        </div>
        {data.crawled_at && (
          <span className="text-xs text-gray-400">
            {new Date(data.crawled_at).toLocaleDateString('ko-KR')} 기준
          </span>
        )}
      </div>

      {/* 지표 그리드 */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        {stats.map(({ label, value }) => (
          <div key={label} className="bg-[#F6F6F7] rounded-xl p-3">
            <p className="text-[11px] text-[#9A9AA5] mb-0.5">{label}</p>
            <p className="text-[14px] font-bold text-[#17171B]">{value}</p>
          </div>
        ))}
      </div>

      {/* 포스팅 노출 (접었다 펴기) */}
      {postRankings.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[11px] font-bold text-[#9A9AA5] tracking-[0.04em]">
              최근 포스팅 검색 노출
            </p>
            <span className="text-[10.5px] text-[#C4C4CE]">
              {exposedCount}/{postRankings.length}개 · 제목 클릭 시 키워드 상세
            </span>
          </div>
          <div className="space-y-1.5">
            {postRankings.map((p) => (
              <PostRow key={p.log_no} post={p} />
            ))}
          </div>
        </div>
      )}

      {/* 카테고리 키워드 보조 */}
      {kwRankings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[11px] font-bold text-[#9A9AA5] tracking-[0.04em]">카테고리 키워드</p>
            <span className="text-[10.5px] text-[#C4C4CE]">
              TOP10 {data.top10_count ?? 0} / TOP30 {data.top30_count ?? 0}
            </span>
          </div>
          <div className="space-y-1.5">
            {kwRankings.map((kr) => (
              <div key={kr.keyword} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="text-[#5C5C68] truncate flex-1">{kr.keyword}</span>
                {kr.found && kr.rank != null
                  ? <RankBadge rank={kr.rank} />
                  : <span className="text-[#C4C4CE] shrink-0 text-[11px]">미노출</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10.5px] text-[#C4C4CE] mt-4">
        자동 수집 데이터 · 매일 갱신 · 광고주에게도 공개됩니다
      </p>
    </div>
  )
}


// ── SummaryCard: 대시보드 "내 채널 분석" 요약 카드 ───────────────────────

export function BlogAnalyticsSummaryCard({ data }: { data: BlogAnalytics | null }) {
  if (!data?.blog_id) {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
        <p className="text-sm text-gray-400">아직 채널 분석 데이터가 없어요.</p>
        <p className="text-xs text-gray-300 mt-1">분석은 매일 자동으로 수집됩니다.</p>
      </div>
    )
  }

  const postRankings  = data.post_keyword_rankings ?? []
  const exposedCount  = postRankings.filter((p) => p.found).length
  const totalChecked  = postRankings.length
  const exposureRate  = totalChecked > 0 ? exposedCount / totalChecked : 0
  const s = gradeStyle(data.blog_grade)

  // 평균 순위 (노출된 포스팅 기준)
  const rankedPosts = postRankings.filter((p) => p.found && p.rank)
  const avgRank = rankedPosts.length
    ? Math.round(rankedPosts.reduce((sum, p) => sum + (p.rank ?? 0), 0) / rankedPosts.length)
    : null

  const chips = [
    data.neighbor_count != null && { label: '이웃', value: fmtNum(data.neighbor_count) },
    data.visitor_today  != null && { label: '방문자', value: fmtNum(data.visitor_today) },
    data.post_count     != null && { label: '글', value: String(data.post_count) },
    avgRank             != null && { label: '평균순위', value: `${avgRank}위` },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <Link href="/influencer/channel-analytics"
      className="block bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition">

      {/* 상단: 등급 + 날짜 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {data.blog_grade ? (
            <span className="text-[15px] font-extrabold rounded-lg px-2.5 py-1"
              style={{ background: s.bg, color: s.text }}>
              {data.blog_grade}
            </span>
          ) : (
            <span className="text-[13px] font-semibold text-[#9A9AA5]">등급 산정 중</span>
          )}
          <span className="text-[11.5px] text-[#9A9AA5]">네이버 블로그</span>
        </div>
        {data.crawled_at && (
          <span className="text-[10.5px] text-[#C4C4CE]">
            {new Date(data.crawled_at).toLocaleDateString('ko-KR')} 기준
          </span>
        )}
      </div>

      {/* 지표 칩 */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {chips.map(({ label, value }) => (
            <span key={label}
              className="text-[11px] bg-[#F6F6F7] text-[#5C5C68] rounded-lg px-2 py-1">
              <span className="text-[#9A9AA5]">{label}</span>{' '}
              <span className="font-bold text-[#17171B]">{value}</span>
            </span>
          ))}
        </div>
      )}

      {/* 노출 프로그레스 바 */}
      {totalChecked > 0 && (
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-[#9A9AA5]">포스팅 검색 노출</span>
            <span className={`font-bold ${exposedCount === totalChecked ? 'text-[#15803D]' : 'text-[#D97706]'}`}>
              {exposedCount}/{totalChecked}개
            </span>
          </div>
          <div className="h-1.5 bg-[#F1F1F4] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${exposureRate * 100}%`,
                background: exposureRate >= 0.8 ? '#22C55E' : exposureRate >= 0.5 ? '#F59E0B' : '#EF4444',
              }}
            />
          </div>
        </div>
      )}

      <p className="text-[10.5px] text-[#C4C4CE] mt-2.5 text-right">상세 분석 보기 →</p>
    </Link>
  )
}
