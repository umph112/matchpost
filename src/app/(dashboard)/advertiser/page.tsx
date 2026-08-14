import { redirect } from 'next/navigation'

// /advertiser 는 옛 대시보드였다. 실제 화면은 /advertiser/dashboard 이므로 그쪽으로 넘긴다.
// (사이드바 어디에서도 /advertiser 를 직접 링크하지 않아 중복 화면만 남아 있었음 — D8-2 3)
export default function AdvertiserIndexRedirect() {
  redirect('/advertiser/dashboard')
}
