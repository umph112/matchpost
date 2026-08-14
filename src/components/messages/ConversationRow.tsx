'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users } from 'lucide-react'
import { initial } from '@/lib/initial'
import MatchScore from '@/components/MatchScore'

// D10 §1-2 — 목록 행은 카드가 아니라 표 행. 아바타 모양으로 캠페인(1:N 파란 사각)/개인(1:1 노란 원)
// 구분, 1:N 참여 N명 배지는 방 헤더에만(여기선 제거). 3행 구성: ①제목+매치스코어+시간
// ②미리보기 ③단계 배지 + 안읽음 숫자.
// D7 4-5: 안 읽음(검정 원 숫자)과 미응답(내 응답 2일↑ 지연, 빨강)은 다른 신호 — 섞어 쓰지 않는다.
const STAGE: Record<string, { text: string; bg: string; fg: string }> = {
  talking: { text: '협의중', bg: '#F1F1F4', fg: '#7C7C88' },
  inner: { text: '내측 확정', bg: '#FEF3C7', fg: '#B45309' },
  both: { text: '양측 확정', bg: '#DCFCE7', fg: '#15803D' },
  canceled: { text: '취소 확정', bg: '#F1F1F4', fg: '#7C7C88' },
}

export default function ConversationRow({
  href,
  kind,
  title,
  subtitle,
  timeLabel,
  unreadCount = 0,
  overdue = false,
  matchScore,
  reviewCount = 0,
  stage,
}: {
  href: string
  kind: 'campaign' | 'personal'
  title: string
  subtitle: string | null
  timeLabel: string
  unreadCount?: number
  overdue?: boolean
  matchScore?: number | null
  reviewCount?: number
  stage?: 'talking' | 'inner' | 'both' | 'canceled'
}) {
  const isCampaign = kind === 'campaign'
  const pathname = usePathname()
  const selected = pathname === href
  const st = stage ? STAGE[stage] : null
  return (
    <Link
      href={href}
      className={`w-full flex items-start gap-3 px-4 py-[13px] border-b border-[#F1F1F4] transition text-left ${
        selected ? 'bg-[#FFFBEB]' : 'hover:bg-[#FAFAFB]'
      }`}
    >
      <div
        className={`w-9 h-9 flex items-center justify-center font-bold shrink-0 ${
          isCampaign ? 'rounded-[10px] bg-[#DBEAFE] text-[#1D4ED8]' : 'rounded-full bg-[#FEF3C7] text-[#B45309]'
        }`}
      >
        {isCampaign ? <Users size={16} strokeWidth={1.75} /> : initial(title)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-gray-800 truncate text-[13.5px]">{title}</p>
          {matchScore !== undefined && <MatchScore score={matchScore} reviewCount={reviewCount} />}
          <span className="ml-auto text-[11px] text-gray-300 shrink-0">{timeLabel}</span>
        </div>
        {subtitle && <p className="text-[12.5px] text-gray-400 truncate mt-0.5">{subtitle}</p>}
        {(st || overdue || unreadCount > 0) && (
          <div className="flex items-center gap-[5px] mt-[6px]">
            {st && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-[4px]"
                style={{ background: st.bg, color: st.fg }}
              >
                {st.text}
              </span>
            )}
            {overdue ? (
              <span className="text-[10.5px] font-bold bg-red-100 text-red-500 px-2 py-0.5 rounded-full">미응답</span>
            ) : unreadCount > 0 ? (
              <span className="text-[10.5px] font-bold bg-[#17171B] text-white rounded-full px-1.5 min-w-[18px] text-center">
                {unreadCount}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </Link>
  )
}
