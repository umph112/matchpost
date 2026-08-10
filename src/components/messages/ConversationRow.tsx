'use client'

import Link from 'next/link'
import { initial } from '@/lib/initial'

// 대화 목록 행 — 모양으로 캠페인(1:N, 파란 사각) / 개인(1:1, 노란 원) 구분 (D6 A1)
export default function ConversationRow({
  href,
  kind,
  title,
  subtitle,
  timeLabel,
  unread,
  participantCount,
}: {
  href: string
  kind: 'campaign' | 'personal'
  title: string
  subtitle: string | null
  timeLabel: string
  unread: boolean
  participantCount?: number
}) {
  const isCampaign = kind === 'campaign'
  return (
    <Link
      href={href}
      className="w-full bg-white rounded-2xl p-4 shadow-sm mb-3 flex items-center hover:shadow-md transition text-left"
    >
      <div
        className={`w-11 h-11 flex items-center justify-center font-bold mr-3 shrink-0 ${
          isCampaign ? 'rounded-[10px] bg-[#DBEAFE] text-[#1D4ED8]' : 'rounded-full bg-[#FEF3C7] text-[#B45309]'
        }`}
      >
        {isCampaign ? '👥' : initial(title)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-800 truncate">{title}</p>
          <span
            className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
              isCampaign ? 'bg-[#DBEAFE] text-[#1D4ED8]' : 'bg-[#FEF3C7] text-[#B45309]'
            }`}
          >
            {isCampaign ? `1:N 참여 ${participantCount ?? 0}명` : '1:1'}
          </span>
        </div>
        {subtitle && <p className="text-sm text-gray-400 truncate">{subtitle}</p>}
      </div>
      <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
        {unread && (
          <span className="text-[10.5px] font-bold bg-red-100 text-red-500 px-2 py-0.5 rounded-full">미응답</span>
        )}
        <p className="text-xs text-gray-300">{timeLabel}</p>
      </div>
    </Link>
  )
}
