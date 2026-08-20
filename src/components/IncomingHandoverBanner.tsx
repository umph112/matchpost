import Link from 'next/link'

// 받는 사람 이관 배너 — D14 5-5. 내 페이지 위에 한 줄만 얹는다(내 일이 가려지면 안 됨).
// 받는 사람은 미리 지정되지 않으므로(5-3), 나에게 캠페인이 넘어오기 시작한 퇴사자만 대상으로 한다.
// 남은 게 0건이면 배너를 띄우지 않는다(넘어올 게 없으면 볼 이유가 없다).
export type IncomingHandoverItem = {
  leaverId: string
  leaverName: string
  leaveOn: string | null
  total: number
  received: number
  remaining: number
}

// 'YYYY-MM-DD' → 'M월 D일'
const korDate = (s: string) => `${Number(s.slice(5, 7))}월 ${Number(s.slice(8, 10))}일`

export default function IncomingHandoverBanner({ items }: { items: IncomingHandoverItem[] }) {
  if (!items.length) return null
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((it) => (
        <div
          key={it.leaverId}
          style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '16px 18px' }}
          className="flex flex-col gap-3 [.adv-pc_&]:flex-row [.adv-pc_&]:items-center [.adv-pc_&]:gap-4"
        >
          <div className="min-w-0">
            <span
              style={{ fontSize: '10px', fontWeight: 800, background: '#F59E0B', color: '#17171B', letterSpacing: '0.03em', borderRadius: 4, padding: '2px 6px' }}
            >
              이관
            </span>
            <p style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '-0.02em', color: '#92400E', marginTop: 6 }}>
              {it.leaverName}님 담당 {it.total}건이 넘어오는 중이에요
            </p>
            <p style={{ fontSize: '12px', color: '#B45309', lineHeight: 1.65, marginTop: 4 }}>
              {it.leaveOn ? `${it.leaverName}님이 ${korDate(it.leaveOn)} 퇴사 예정이에요. ` : ''}
              {it.total}건 중 {it.received}건이 넘어왔고, 나머지는 {it.leaverName}님이 메모와 함께 보내줍니다. 기다리지 않고 직접 가져올 수도 있어요.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 [.adv-pc_&]:ml-auto">
            <Link
              href={`/advertiser/team/handover/${it.leaverId}`}
              style={{ height: 40, borderRadius: 10 }}
              className="inline-flex items-center px-4 bg-[#17171B] text-white text-[13px] font-bold hover:opacity-90"
            >
              이관내역 보기 →
            </Link>
            <Link
              href={`/advertiser/team/handover/${it.leaverId}`}
              style={{ fontSize: '11.5px', fontWeight: 700, color: '#B45309' }}
              className="underline"
            >
              이관 기록
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
