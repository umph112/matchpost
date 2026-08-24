import { cancelNotice, type Role } from '@/lib/cancellation/thresholds'

// 본인 화면 안내. notify 단계부터 뜬다.
// 회복 경로(60일)를 문구에 반드시 남긴다 — 낙인만 있고 벗을 길이 없으면 계정을 버린다.
export default function CancelNoticeCard({
  role,
  count,
}: {
  role: Role
  count: number | null | undefined
}) {
  const msg = cancelNotice(role, count ?? 0)
  if (!msg) return null
  return (
    <div className="mb-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
      {msg}
    </div>
  )
}
