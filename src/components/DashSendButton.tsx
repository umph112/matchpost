'use client'

import { useState } from 'react'
import ConfirmDashModal from './ConfirmDashModal'

// 대시 보내기 트리거 버튼 — 서버 컴포넌트 페이지에도 그대로 꽂아 쓸 수 있게 감싼 것.
export default function DashSendButton({
  influencerId,
  influencerName,
  scheduleId,
  campaignId,
  message,
  budget,
  collaborationType,
  scheduleDate,
  className,
  children,
}: {
  influencerId: string
  influencerName: string
  scheduleId?: string | null
  campaignId?: string | null
  message?: string | null
  budget?: number | null
  collaborationType?: string | null
  scheduleDate?: string | null
  className?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open && (
        <ConfirmDashModal
          influencerId={influencerId}
          influencerName={influencerName}
          scheduleId={scheduleId}
          campaignId={campaignId}
          message={message}
          budget={budget}
          collaborationType={collaborationType}
          scheduleDate={scheduleDate}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
