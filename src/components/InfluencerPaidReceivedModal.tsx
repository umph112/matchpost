'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { kstDateString, listDateLabel } from '@/lib/date'

// D19 PROMPT-6 — 인플루언서가 직접 입금을 확인해 미수 건을 닫는다.
// 광고주가 정산을 기록하지 않았을 때(미수)의 경로. RPC confirm_payment_by_influencer 로 처리한다.
export default function InfluencerPaidReceivedModal({
  proposalId,
  campaignTitle,
  budget,
  settlementDate,
  onClose,
  onDone,
}: {
  proposalId: string
  campaignTitle: string
  budget: number | null
  settlementDate: string // YYYY-MM-DD (원래 결제 예정일)
  onClose: () => void
  onDone: () => void
}) {
  const supabase = createClient()
  const today = kstDateString()
  const [paidOn, setPaidOn] = useState(today)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 예정일 이전은 못 고른다 — 예정일 전에 받았을 리 없다.
  const tooEarly = !!settlementDate && paidOn < settlementDate

  const confirm = async () => {
    if (loading || tooEarly) return
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('로그인이 필요해요.'); setLoading(false); return }
    const { error: err } = await supabase.rpc('confirm_payment_by_influencer', {
      p_proposal_id: proposalId,
      p_by_id: user.id,
      p_paid_on: paidOn,
    })
    if (err) { setError(err.message); setLoading(false); return }
    onDone()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(23,23,27,0.45)] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-[480px] p-10"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-[#17171B]">입금을 받으셨나요?</h2>

        {/* 본문 — 캠페인 · 금액 · 원래 결제 예정일 */}
        <div className="mt-5 space-y-2 rounded-xl bg-[#FAFAFB] p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#5C5C68] truncate max-w-[260px]">{campaignTitle}</span>
            <span className="font-bold text-[#17171B] shrink-0 ml-2">{(budget ?? 0).toLocaleString()}원</span>
          </div>
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="text-[#9A9AA5]">원래 결제 예정일</span>
            <span className="text-[#5C5C68]">{listDateLabel(settlementDate + 'T00:00:00')}</span>
          </div>
        </div>

        {/* 입금일 */}
        <div className="mt-5">
          <label className="block text-[12.5px] font-semibold text-[#5C5C68] mb-1.5">입금 받은 날</label>
          <input
            type="date"
            value={paidOn}
            min={settlementDate || undefined}
            max={today}
            onChange={(e) => setPaidOn(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#17171B] focus:outline-none focus:border-[#15803D]"
          />
          {tooEarly && (
            <p className="mt-1.5 text-[11.5px] text-[#DC2626]">예정일 이후의 날짜만 고를 수 있어요.</p>
          )}
        </div>

        {/* 안내 */}
        <p className="mt-4 text-[11.5px] text-[#7C7C88] leading-relaxed">
          확인하면 미수에서 빠지고 매출로 확정됩니다. 되돌릴 수 없어요.
        </p>

        {error && <p className="mt-3 text-[12.5px] text-[#DC2626]">{error}</p>}

        {/* 버튼 */}
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={confirm}
            disabled={loading || tooEarly}
            className="w-full py-3 rounded-xl text-white font-semibold bg-[#15803D] hover:bg-[#166534] transition disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? '처리 중...' : '입금 확인'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
