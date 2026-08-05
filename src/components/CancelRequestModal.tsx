'use client'

import { useState } from 'react'
import { requestCancellation, CANCEL_REASONS, type CancelReason } from '@/lib/cancellations/actions'

export default function CancelRequestModal({
  proposalId,
  onClose,
  onDone,
}: {
  proposalId: string
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState<CancelReason | ''>('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!reason) { setError('사유를 선택해주세요.'); return }
    setSubmitting(true)
    setError('')
    const res = await requestCancellation(proposalId, reason, message)
    setSubmitting(false)
    if (!res.ok) { setError(res.error); return }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-[420px] overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 border-b border-[#F1F1F4]">
          <p className="text-[11px] text-[#9A9AA5] mb-0.5">협업 취소 요청</p>
          <p className="text-base font-bold text-[#17171B]">즉시 취소되지 않아요</p>
          <p className="text-[11.5px] text-[#7C7C88] mt-1">
            사유를 보내면 상대가 「취소 요청 수락」을 눌러야 확정돼요. 3일간 응답이 없으면 자동으로 확정돼요.
          </p>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-semibold text-[#9A9AA5] mb-2">사유</p>
            <div className="flex flex-wrap gap-1.5">
              {CANCEL_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`text-[12px] font-medium px-3 py-1.5 rounded-full border transition ${
                    reason === r
                      ? 'bg-[#17171B] text-white border-[#17171B]'
                      : 'bg-white text-[#5C5C68] border-[#EAEAEE] hover:border-[#C4C4CE]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-[#9A9AA5] mb-2">전할 말 (선택)</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="상대에게 전할 말을 남겨주세요"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#EAEAEE] resize-none focus:outline-none focus:border-[#C4C4CE] text-[#17171B] placeholder:text-[#C4C4CE]"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex flex-col gap-2">
            <button
              onClick={submit}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-[#17171B] text-white font-bold text-sm hover:bg-black transition disabled:opacity-40"
            >
              {submitting ? '요청 중...' : '대화로 조율하기 — 취소 요청 보내기'}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-[#EAEAEE] text-sm text-[#7C7C88] hover:bg-[#F6F6F7] transition"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
