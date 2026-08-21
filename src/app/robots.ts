import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/siteUrl'

// 크롤러 정책. 공개 페이지(캠페인·오픈·프로필·소개/약관)는 허용하고,
// 로그인 뒤 앱 화면(대시보드·메시지·검색·등록 폼 등)과 /api 는 차단한다.
// 주의: 공개 프로필은 /advertiser/[id]·/influencer/[id]·/profile/[id] 로 (dashboard) 밖 최상위에 있어
// 아래 개별 서브경로 disallow 와 겹치지 않는다(uuid 는 dashboard·search 등 어떤 disallow 와도 매치되지 않음).
// 최장 일치가 이기므로 allow '/advertiser/' + disallow '/advertiser/dashboard' → 프로필은 열리고 대시보드만 막힌다.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/campaigns/',
          '/opens/',
          '/advertiser/',
          '/influencer/',
          '/profile/',
          '/intro',
          '/terms',
          '/privacy',
        ],
        disallow: [
          '/api/',
          '/day',
          // 광고주 대시보드 계열
          '/advertiser/dashboard',
          '/advertiser/campaigns',
          '/advertiser/proposals',
          '/advertiser/connections',
          '/advertiser/team',
          '/advertiser/search',
          '/advertiser/settlements',
          '/advertiser/messages',
          '/advertiser/notifications',
          // 인플루언서 대시보드 계열
          '/influencer/dashboard',
          '/influencer/schedule',
          '/influencer/earnings',
          '/influencer/proposals',
          '/influencer/messages',
          '/influencer/notifications',
          '/influencer/channel-analytics',
          '/influencer/profile',
          '/influencer/search',
          // 인증/온보딩
          '/signup',
          '/pending',
        ],
      },
    ],
    sitemap: siteUrl('/sitemap.xml'),
  }
}
