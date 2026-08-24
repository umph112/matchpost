import { cancelStage, type Role } from '@/lib/cancellation/thresholds'

// 공개 표시 단계에서만 뜨는 배지. 상대가 수락하기 전에 보여야 의미가 있어서
// 공개 프로필과 검색 결과 양쪽에 같은 배지를 건다.
// 숫자는 넣지 않는다 — 점수를 그대로 보는 곳은 관리자 화면뿐이다.
export default function CancelBadge({
  role,
  count,
}: {
  role: Role
  count: number | null | undefined
}) {
  if (cancelStage(role, count ?? 0) !== 'public') return null
  return (
    <span className="inline-flex items-center rounded-[4px] bg-[#FEE2E2] px-1.5 py-0.5 text-[10px] font-bold text-[#DC2626]">
      취소 요청 잦음
    </span>
  )
}
