import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/service'
import { siteUrl } from '@/lib/siteUrl'

// 검색 색인용 URL 목록. 지금 열려 있는 것만 싣는다 — 지난 캠페인·오픈은 넣지 않는다
// (마감된 항목이 검색에 뜨면 죽은 서비스처럼 보임). 페이지 자체는 살아 있어 직접 링크로는 계속 열린다.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  // 진행 중(공개·모집중) 캠페인
  const { data: campaigns } = await db
    .from('campaigns')
    .select('id')
    .eq('is_public', true)
    .eq('status', 'open')

  // 검색 노출을 켠(seo_public) + 공개(is_public) + 지나지 않은 오픈
  const { data: opens } = await db
    .from('schedules')
    .select('id, date, date_end')
    .eq('is_public', true)
    .eq('seo_public', true)
    .eq('status', 'open')

  // 광고주 공개 프로필 (/advertiser/[id] 는 로그인 없이 열림)
  const { data: advs } = await db.from('advertiser_profiles').select('user_id')

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl('/'), changeFrequency: 'weekly', priority: 1 },
    { url: siteUrl('/intro'), changeFrequency: 'monthly', priority: 0.4 },
    { url: siteUrl('/terms'), changeFrequency: 'yearly', priority: 0.2 },
    { url: siteUrl('/privacy'), changeFrequency: 'yearly', priority: 0.2 },
  ]

  const campaignPages: MetadataRoute.Sitemap = (campaigns ?? []).map((c) => ({
    url: siteUrl(`/campaigns/${c.id}`),
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  const openPages: MetadataRoute.Sitemap = (opens ?? [])
    .filter((o) => {
      const last = (o.date_end as string | null) || (o.date as string | null)
      return !last || last >= today // 지난 오픈 제외
    })
    .map((o) => ({
      url: siteUrl(`/opens/${o.id}`),
      changeFrequency: 'daily',
      priority: 0.6,
    }))

  const advPages: MetadataRoute.Sitemap = (advs ?? []).map((a) => ({
    url: siteUrl(`/advertiser/${a.user_id}`),
    changeFrequency: 'weekly',
    priority: 0.5,
  }))

  return [...staticPages, ...campaignPages, ...openPages, ...advPages]
}
