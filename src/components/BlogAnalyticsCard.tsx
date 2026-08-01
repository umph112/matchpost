export type PostKeywordRanking = {
  log_no: string
  title: string
  found: boolean
  rank: number | null
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

// ── 등급 스타일 ──────────────────────────────────────────────────────────────

const GRADE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  S: { bg: '#FEF3C7', text: '#B45309', label: 'S급' },
  A: { bg: '#DBEAFE', text: '#1D4ED8', label: 'A급' },
  B: { bg: '#DCFCE7', text: '#15803D', label: 'B급' },
  C: { bg: '#F1F1F4', text: '#5C5C68', label: 'C급' },
  D: { bg: '#F1F1F4', text: '#9A9AA5', label: 'D급' },
}

function GradeBadge({ grade, size = 'sm' }: { grade: string | null | undefined; size?: 'sm' | 'md' }) {
  if (!grade) return null
  const s = GRADE_STYLE[grade] ?? GRADE_STYLE['D']
  return (
    <span
      className={`font-bold rounded-md ${size === 'md' ? 'text-[13px] px-2.5 py-1' : 'text-[10.5px] px-2 py-[3px]'}`}
      style={{ background: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  )
}

function fmtNum(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`
  if (n >= 1000)  return `${(n / 1000).toFixed(1)}K`
  return String(n)
}


// ── Compact: 검색 카드 내 한 줄 요약 ──────────────────────────────────────

export function BlogAnalyticsCompact({ data }: { data: BlogAnalytics | null }) {
  if (!data?.blog_id) return null

  const hasAny = data.neighbor_count != null || data.post_count != null || data.blog_grade
  if (!hasAny) return null

  // 포스팅 노출률 계산
  const postRankings = data.post_keyword_rankings ?? []
  const exposedCount = postRankings.filter((p) => p.found).length
  const totalChecked = postRankings.length

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10.5px] text-[#B0B0BB]">블로그</span>
      <GradeBadge grade={data.blog_grade} />
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
      {totalChecked > 0 && (
        <span
          className={`text-[10.5px] font-semibold rounded px-1.5 py-[2px] ${
            exposedCount > 0 ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#F1F1F4] text-[#9A9AA5]'
          }`}
        >
          노출 {exposedCount}/{totalChecked}
        </span>
      )}
    </div>
  )
}


// ── Full: 인플루언서 마이페이지 분석 카드 ─────────────────────────────────

export function BlogAnalyticsFull({ data }: { data: BlogAnalytics | null }) {
  if (!data?.blog_id) return null

  const postRankings  = data.post_keyword_rankings ?? []
  const kwRankings    = data.keyword_rankings ?? []
  const exposedCount  = postRankings.filter((p) => p.found).length

  const stats = [
    { label: '이웃 수',       value: data.neighbor_count != null ? `${data.neighbor_count.toLocaleString()}명` : '비공개' },
    { label: '오늘 방문자',   value: data.visitor_today  != null ? `${data.visitor_today.toLocaleString()}명`  : '비공개' },
    { label: '총 글 수',      value: data.post_count     != null ? `${data.post_count}개`                      : '—' },
    { label: '월 평균 포스팅', value: data.post_frequency != null ? `${data.post_frequency}회`                 : '—' },
  ]

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-gray-800">블로그 분석</h2>
          <GradeBadge grade={data.blog_grade} size="md" />
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

      {/* 포스팅 단위 노출 체크 (블맥스 핵심 기능) */}
      {postRankings.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[11px] font-bold text-[#9A9AA5] tracking-[0.04em]">최근 포스팅 검색 노출</p>
            <span className="text-[10.5px] text-[#C4C4CE]">
              {exposedCount}/{postRankings.length}개 노출
            </span>
          </div>
          <div className="space-y-1.5">
            {postRankings.map((p) => (
              <div key={p.log_no} className="flex items-center gap-2">
                {/* 노출 뱃지 */}
                <span
                  className={`text-[10px] font-bold rounded px-1.5 py-[2px] shrink-0 ${
                    p.found ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEE2E2] text-[#DC2626]'
                  }`}
                >
                  {p.found ? '노출' : '미노출'}
                </span>
                {/* 제목 */}
                <span className="text-[12px] text-[#3C3C46] truncate flex-1">{p.title}</span>
                {/* 순위 */}
                {p.found && p.rank != null && (
                  <span
                    className={`text-[11px] font-bold shrink-0 ${
                      p.rank <= 10 ? 'text-[#1D4ED8]'
                      : p.rank <= 30 ? 'text-[#D97706]'
                      : 'text-[#9A9AA5]'
                    }`}
                  >
                    {p.rank}위
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 카테고리 키워드 보조 체크 */}
      {kwRankings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[11px] font-bold text-[#9A9AA5] tracking-[0.04em]">카테고리 키워드 노출</p>
            <span className="text-[10.5px] text-[#C4C4CE]">
              TOP10 {data.top10_count ?? 0}건 / TOP30 {data.top30_count ?? 0}건
            </span>
          </div>
          <div className="space-y-1.5">
            {kwRankings.map((kr) => (
              <div key={kr.keyword} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="text-[#5C5C68] truncate flex-1">{kr.keyword}</span>
                {kr.found && kr.rank != null ? (
                  <span
                    className={`font-bold shrink-0 ${
                      kr.rank <= 10 ? 'text-[#1D4ED8]'
                      : kr.rank <= 30 ? 'text-[#D97706]'
                      : 'text-[#9A9AA5]'
                    }`}
                  >
                    {kr.rank}위
                  </span>
                ) : (
                  <span className="text-[#C4C4CE] shrink-0">미노출</span>
                )}
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
