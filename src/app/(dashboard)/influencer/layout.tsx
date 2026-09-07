import InfluencerShellServer from '@/components/shells/InfluencerShellServer'

// ⚠️ 여기 있어야 한다. 세그먼트 설정은 route 파일에서만 읽히므로 컴포넌트로 옮기면 무시된다.
export const dynamic = 'force-dynamic'

// 인플루언서 공통 셸 — 화면 12개 전부를 여기서 감싼다.
// 셸과 요약값 계산은 InfluencerShellServer 로 옮겼다 — /day/[date] 가 같은 셸을 써야 하는데
// 그 경로는 두 역할 공용이라 이 레이아웃 밑으로 들어오지 않는다(D33).
export default function InfluencerLayout({ children }: { children: React.ReactNode }) {
  return <InfluencerShellServer>{children}</InfluencerShellServer>
}
