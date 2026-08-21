// 공개 절대 URL(canonical·og·sitemap·robots)의 단일 출처.
// 값은 Vercel 환경변수 NEXT_PUBLIC_SITE_URL 로 주입한다 — 코드에 운영 도메인을 하드코딩하지 않는다.
// 지금은 배포 URL을 넣고, 도메인(matchpost.kr) 확정 후 env 값만 바꾸면 canonical·og·sitemap 이 함께 따라온다.
// 폴백은 localhost 뿐 — 운영에서 env 가 비면 검색용 URL이 localhost 로 나와 즉시 티가 나도록(잘못된 도메인이 색인되는 사고 방지).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

export function siteUrl(path = ''): string {
  if (!path || path === '/') return SITE_URL
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}
