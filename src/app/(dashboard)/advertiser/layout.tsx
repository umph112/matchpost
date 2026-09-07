import AdvertiserShellServer from '@/components/shells/AdvertiserShellServer'

// 광고주 전용 데스크탑 셸 레이아웃 (모든 /advertiser/* 페이지를 감쌈)
// 셸과 요약값 계산은 AdvertiserShellServer 로 옮겼다 — /day/[date] 가 같은 셸을 써야 하는데
// 그 경로는 두 역할 공용이라 이 레이아웃 밑으로 들어오지 않는다(D33).
export default function AdvertiserLayout({ children }: { children: React.ReactNode }) {
  return <AdvertiserShellServer>{children}</AdvertiserShellServer>
}
