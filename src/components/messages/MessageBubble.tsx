'use client'

import { Paperclip } from 'lucide-react'
import { initial } from '@/lib/initial'
import { attachmentDaysLeft } from '@/lib/storage'
import { dateWithDow } from '@/lib/date'

export type BubbleMessage = {
  id: string
  sender_id: string
  content: string
  created_at: string
  file_url?: string | null
  file_name?: string | null
  file_deleted_at?: string | null
  is_system?: boolean | null
  proxy?: boolean | null
  targeted_only?: boolean | null
  proposed_date?: string | null
  proposed_date_kind?: 'progress' | 'settlement' | null
}

// 메시지 말풍선 — 캠페인 대화 상대 이름 표시(A2), 대리발송/개별발송 배지(A3/A5),
// 단체발송 배지(A4), 시스템 줄(A9), 날짜 제안 카드(A6/A7)를 전부 여기서 처리한다.
export default function MessageBubble({
  msg,
  isMine,
  senderName,
  showSenderName,
  targetedName,
  groupSentBadge,
  dateProposalStatus,
  openDateMatch,
  settlementNowLabel,
  canAcceptDate,
  onAcceptDate,
}: {
  msg: BubbleMessage
  isMine: boolean
  senderName?: string | null
  showSenderName?: boolean
  targetedName?: string | null
  groupSentBadge?: boolean
  dateProposalStatus?: 'live' | 'accepted' | 'answered' | null
  openDateMatch?: boolean | null
  settlementNowLabel?: string | null
  canAcceptDate?: boolean
  onAcceptDate?: () => void
}) {
  if (msg.is_system) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[11px] text-gray-400 bg-gray-100 rounded-full px-3 py-1">{msg.content}</span>
      </div>
    )
  }

  if (msg.proposed_date) {
    // D20 §3-2 — 같은 카드가 종류를 말한다. settlement 이면 라벨·부제가 다르고 오픈 부제를 붙이지 않는다.
    const isSettlement = msg.proposed_date_kind === 'settlement'
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-xs w-full bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl px-4 py-3">
          <p className="text-[10.5px] font-bold text-[#B45309]">{isSettlement ? '결제일 제안' : '진행일 제안'}</p>
          <p className="text-lg font-extrabold text-[#17171B] mt-0.5">
            {dateWithDow(msg.proposed_date)}
          </p>
          {isSettlement
            ? dateProposalStatus === 'live' && settlementNowLabel && (
                <p className="text-[11px] text-[#92702A] mt-1">지금은 {settlementNowLabel}이에요</p>
              )
            : openDateMatch != null && (
                <p className="text-[11px] text-[#92702A] mt-1">
                  {openDateMatch ? '오픈해두신 날짜예요' : '오픈해두신 날짜와 다른 날이에요'}
                </p>
              )}
          <p className="text-[11px] text-[#92400E] mt-1">
            {dateProposalStatus === 'accepted'
              ? isSettlement
                ? '합의됨'
                : '확정됨'
              : dateProposalStatus === 'answered'
              ? '다른 날짜로 답함'
              : isSettlement
              ? '상대가 수락하면 이 날짜가 매출 시점이 돼요'
              : '상대가 수락하면 이 날짜로 확정돼요'}
          </p>
          {dateProposalStatus === 'live' && !isMine && canAcceptDate && (
            <button
              onClick={onAcceptDate}
              className="mt-2 w-full bg-[#F59E0B] hover:bg-[#D97706] text-white text-[12px] font-bold py-1.5 rounded-lg transition"
            >
              이 날짜로 수락
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} items-end gap-1.5`}>
      {showSenderName && !isMine && (
        <div className="w-5 h-5 rounded-full bg-[#DBEAFE] text-[#1D4ED8] text-[9px] font-bold flex items-center justify-center shrink-0 mb-1">
          {initial(senderName)}
        </div>
      )}
      <div className="max-w-xs">
        {showSenderName && !isMine && (
          <p className="text-[10.5px] text-gray-400 mb-0.5 ml-0.5">{senderName}</p>
        )}
        {(msg.proxy || msg.targeted_only || groupSentBadge) && (
          <div className={`flex flex-wrap items-center gap-x-[5px] gap-y-0.5 ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
            {msg.proxy && (
              <span className="text-[9.5px] font-bold bg-[#FEF3C7] text-[#92400E] rounded-full px-1.5 py-0.5">
                회사 대표 대리 발송
              </span>
            )}
            {msg.targeted_only && targetedName && (
              <>
                <span className="text-[9.5px] font-bold bg-[#DBEAFE] text-[#1D4ED8] rounded-full px-1.5 py-0.5">
                  {targetedName}님에게만
                </span>
                <span className="w-full text-[11.5px] text-[#7C7C88]">다른 참여자에게는 가지 않았어요</span>
              </>
            )}
            {groupSentBadge && (
              <>
                <span className="text-[9.5px] font-bold bg-[#DBEAFE] text-[#1E3A8A] rounded-full px-1.5 py-0.5">
                  단체 발송
                </span>
                <span className="w-full text-[11.5px] text-[#7C7C88]">참여자 모두에게 같은 내용이 갔어요</span>
              </>
            )}
          </div>
        )}
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm ${
            isMine
              ? msg.targeted_only
                ? 'bg-[#1D4ED8] text-white rounded-br-sm'
                : 'bg-[#17171B] text-white rounded-br-sm'
              : groupSentBadge
              ? 'bg-[#EFF6FF] border border-[#DBEAFE] text-[#1E3A8A] rounded-bl-sm'
              : 'bg-gray-100 text-gray-800 rounded-bl-sm'
          }`}
        >
          {msg.file_url && !msg.file_deleted_at && (
            <div className="mb-1">
              <a
                href={msg.file_url}
                target="_blank"
                rel="noopener noreferrer"
                download={msg.file_name}
                className={`flex items-center gap-1.5 underline ${isMine ? 'text-white/70' : 'text-[#B45309]'}`}
              >
                <Paperclip size={13} strokeWidth={1.75} className="shrink-0" />
                <span className="truncate max-w-[180px]">{msg.file_name}</span>
              </a>
              <p className={`text-[10px] mt-0.5 ${isMine ? 'text-white/40' : 'text-gray-400'}`}>
                {attachmentDaysLeft(msg.created_at) <= 1
                  ? '오늘 만료돼요'
                  : `${attachmentDaysLeft(msg.created_at)}일 뒤 만료돼요`}
              </p>
            </div>
          )}
          {msg.file_url && msg.file_deleted_at && (
            <p className={`flex items-center gap-1.5 mb-1 ${isMine ? 'text-white/50' : 'text-gray-400'}`}>
              <Paperclip size={13} strokeWidth={1.75} className="shrink-0" />
              <span className="truncate max-w-[180px] line-through">{msg.file_name}</span>
              <span className="text-[10px]">(만료됨)</span>
            </p>
          )}
          {msg.content}
          <p className={`text-xs mt-1 ${isMine ? 'text-white/50' : 'text-gray-400'}`}>
            {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  )
}
