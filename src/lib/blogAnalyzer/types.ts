export type PostKeywordResult = {
  keyword: string
  found: boolean
  rank: number | null
}

export type PostRankingResult = {
  log_no: string
  title: string
  published_on: string | null
  found: boolean
  rank: number | null
  keywords: PostKeywordResult[]
}

export type CategoryKeywordResult = {
  keyword: string
  found: boolean
  rank: number | null
  post_title: string | null
}

export type AnalyticsData = {
  blog_id: string | null
  neighbor_count: number | null
  visitor_today: number | null
  visitor_total: number | null
  post_count: number | null
  avg_likes: number | null
  avg_comments: number | null
  last_post_date: string | null
  post_frequency: number | null
  error_message: string | null
  post_keyword_rankings?: PostRankingResult[]
  keyword_rankings?: CategoryKeywordResult[]
  top10_count?: number
  top30_count?: number
  blog_grade?: string
  grade_score?: number
  missing_metrics?: number
}

export type NaverPost = {
  title?: string
  logNo?: string | number
  addDate?: string
  commentCount?: string | number
}
