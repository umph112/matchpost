'use client'

import { useState } from 'react'

// D20 §3-1 — 결제일 변경 제안 모달. 대시 대화창 입력창 위 「결제일 변경 제안」에서 그 자리에서 연다.
// currentDateLabel 은 지금의 매출 시점("지금 8월 20일이에요") — settlementDateOf() 결과의 「M월 D일」.
export default function SettlementDateModal({
  currentDateLabel,
  onClose,
  onSubmit,
}: {
  currentDateLabel: string | null
  onClose: () => void
  onSubmit: (date: string, reason: string) => Promise<{ ok: boolean; error?: string }>
}) {
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!date || submitting) return
    setSubmitting(true)
    setError(null)
    const res = await onSubmit(date, reason)
    setSubmitting(false)
    if (res.ok) onClose()
    else setError(res.error ?? '제안을 보내지 못했어요.')
  }

  const disabled = !date || submitting

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(23,23,27,0.42)] px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-[432px]"
        style={{ padding: 40 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-extrabold text-[#17171B]">결제일을 언제로 할까요?</h2>
        <p className="text-[11.5px] text-[#7C7C88] mt-1.5">
          {currentDateLabel ? `지금 ${currentDateLabel}이에요` : '아직 결제 예정일이 정해지지 않았어요'}
        </p>

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full mt-4 border border-[#E5E5EA] rounded-[11px] px-3.5 text-[14px] text-[#17171B] focus:outline-none focus:ring-2 focus:ring-amber-400"
          style={{ height: 46 }}
        />
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="예: 월말 정산 주기에 맞춰서"
          className="w-full mt-2.5 border border-[#E5E5EA] rounded-[11px] px-3.5 text-[13.5px] text-[#17171B] placeholder-[#B0B0BB] focus:outline-none focus:ring-2 focus:ring-amber-400"
          style={{ height: 44 }}
        />

        <div
          className="mt-3.5 rounded-[10px]"
          style={{ background: '#FBFBFC', border: '1px solid #EFEFF2', padding: '12px 13px' }}
        >
          <p className="text-[11.5px] text-[#5C5C68]" style={{ lineHeight: 1.65 }}>
            상대가 수락하면 그 날짜가 매출 시점이 됩니다. 합의된 변경은 지연으로 세지 않아요.
          </p>
        </div>

        {error && <p className="text-[11.5px] text-red-500 mt-2.5">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl border border-[#EAEAEE] text-sm text-[#7C7C88] hover:bg-[#F6F6F7] disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={disabled}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm transition"
            style={{
              background: disabled ? '#EAEAEE' : '#17171B',
              color: disabled ? '#B0B0BB' : '#fff',
            }}
          >
            {submitting ? '보내는 중…' : '제안 보내기'}
          </button>
        </div>
      </div>
    </div>
  )
}
