'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Inbox } from 'lucide-react'
import ConversationRow from './ConversationRow'

export type ConvRow = {
  convId: string
  title: string
  subtitle: string | null
  timeLabel: string
  unreadCount: number
  overdue: boolean
  participantCount?: number
  matchScore?: number | null
  reviewCount?: number
  stage?: 'talking' | 'inner' | 'both' | 'canceled'
}

// D7 3-2/3-4 — 캠페인/개인 탭(광고주만) + 빈 상태에 다음 행동 버튼.
export default function ConversationList({
  hrefPrefix,
  campaignRows,
  personalRows,
  emptyActionHref,
  emptyActionLabel,
}: {
  hrefPrefix: string
  campaignRows?: ConvRow[]
  personalRows: ConvRow[]
  emptyActionHref: string
  emptyActionLabel: string
}) {
  const showTabs = campaignRows !== undefined
  const [tab, setTab] = useState<'campaign' | 'personal'>(
    showTabs && campaignRows!.length === 0 && personalRows.length > 0 ? 'personal' : 'campaign'
  )
  const rows = showTabs ? (tab === 'campaign' ? campaignRows! : personalRows) : personalRows

  return (
    <div className="p-3">
      {showTabs && (
        <div className="flex bg-[#F1F1F4] rounded-lg p-[3px] mb-3">
          <button
            onClick={() => setTab('campaign')}
            className={`flex-1 text-[12px] px-2 py-[7px] rounded-md font-semibold transition ${
              tab === 'campaign' ? 'bg-white text-[#17171B] shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-[#8A8A96]'
            }`}
          >
            캠페인 대화 {campaignRows!.length}
          </button>
          <button
            onClick={() => setTab('personal')}
            className={`flex-1 text-[12px] px-2 py-[7px] rounded-md font-semibold transition ${
              tab === 'personal' ? 'bg-white text-[#17171B] shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-[#8A8A96]'
            }`}
          >
            개인 대화 {personalRows.length}
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-center py-14 px-4">
          <Inbox size={30} strokeWidth={1.5} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 text-sm mb-4">아직 대화가 없어요</p>
          <Link
            href={emptyActionHref}
            className="inline-block bg-[#F59E0B] text-white text-[12.5px] font-semibold px-4 py-2 rounded-lg hover:bg-[#D97706] transition"
          >
            {emptyActionLabel}
          </Link>
        </div>
      ) : (
        rows.map((r) => (
          <ConversationRow
            key={r.convId}
            href={`${hrefPrefix}${r.convId}`}
            kind={showTabs && tab === 'campaign' ? 'campaign' : 'personal'}
            title={r.title}
            subtitle={r.subtitle}
            timeLabel={r.timeLabel}
            unreadCount={r.unreadCount}
            overdue={r.overdue}
            matchScore={r.matchScore}
            reviewCount={r.reviewCount}
            stage={r.stage}
          />
        ))
      )}
    </div>
  )
}
