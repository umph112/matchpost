'use client'

import { useState } from 'react'
import { settleCampaign, requestTaxDocs } from '@/lib/deals/settle'
import { creditAmount } from '@/lib/creditConfig'

type Proposal = {
  id: string
  budget: number | null
  tax_doc_received: boolean | null
  tax_doc_type: string | null
  profile: { name: string | null } | null
}

type Campaign = {
  id: string
  title: string
}

export default function SettleConfirmModal({
  proposals,
  campaign,
  onClose,
  onDone,
}: {
  proposals: Proposal[]
  campaign: Campaign
  onClose: () => void
  onDone: (settledIds: string[]) => void
}) {
  // 전원 세무자료 수령이어야 정산 완료 기록 가능 — 미수령이 남으면 "제외하고 기록"이 아니라
  // 잠그고 그 자리에서 일괄 요청으로 이어준다(B1/B2)
  const missing = proposals.filter((p) => !p.tax_doc_type || !p.tax_doc_received)
  const allReceived = missing.length === 0

  const grossTotal = proposals.reduce((s, p) => s + (p.budget ?? 0), 0)
  const [withholding, setWithholding] = useState(false)
  const withheldTotal = withholding ? Math.floor(grossTotal * 0.033) : 0
  const netTotal = grossTotal - withheldTotal

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [requested, setRequested] = useState(false)

  const handleRequestTaxDocs = async () => {
    setSubmitting(true)
    setError('')
    const res = await requestTaxDocs(campaign.id)
    setSubmitting(false)
    if (!res.ok) { setError(res.error); return }
    setRequested(true)
  }

  const handleRecord = async () => {
    if (!allReceived) return
    setSubmitting(true)
    setError('')
    const settled: string[] = []
    for (const p of proposals) {
      const res = await settleCampaign(p.id, {
        withholding: withholding
          ? {
              applied: true,
              gross: p.budget ?? 0,
              withheld: Math.floor((p.budget ?? 0) * 0.033),
              net: (p.budget ?? 0) - Math.floor((p.budget ?? 0) * 0.033),
            }
          : undefined,
      })
      if (res.ok) {
        settled.push(p.id)
      } else {
        setError(res.error)
        setSubmitting(false)
        if (settled.length > 0) onDone(settled)
        return
      }
    }
    setSubmitting(false)
    onDone(settled)
  }

  const fmt = (n: number) => n.toLocaleString()

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(23,23,27,0.45)] px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-[520px] overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-6 pt-6 pb-4 border-b border-[#F1F1F4]">
          <p className="text-[11px] text-[#9A9AA5] mb-0.5">정산 기록</p>
          <p className="text-[15px] font-bold text-[#17171B]">
            {campaign.title}
          </p>
          <p className="text-[12.5px] text-[#5C5C68] mt-1">
            아래 {proposals.length}명에게 결제를 모두 마치셨나요? 수금은 광고주가 직접 하고, 이 화면은 그 기록을 남깁니다.
          </p>
          {!allReceived && (
            <p className="text-[11.5px] text-[#B45309] mt-1.5 bg-[#FEF3C7] rounded px-2 py-1">
              전원 자료를 받아야 기록할 수 있어요 — 세무자료 미수령 {missing.length}명
            </p>
          )}
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* 3.3% 원천징수 */}
          <div className="flex items-center justify-between bg-[#FAFAFB] rounded-xl px-4 py-3">
            <div>
              <p className="text-[13px] font-semibold text-[#17171B]">3.3% 원천징수 적용</p>
              <p className="text-[11px] text-[#9A9AA5] mt-0.5">
                개인 인플루언서에 대한 소득세 원천징수 신고 시 필요한 자료를 전달받으세요.
              </p>
            </div>
            <button
              onClick={() => setWithholding(!withholding)}
              className={`w-10 h-6 rounded-full transition-colors flex items-center ${
                withholding ? 'bg-[#F59E0B] justify-end pr-1' : 'bg-[#E5E5EA] justify-start pl-1'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </button>
          </div>

          {/* 금액 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[12.5px]">
              <span className="text-[#7C7C88]">지급 이상(세전)</span>
              <span className="font-semibold text-[#3C3C46]">{fmt(grossTotal)}원</span>
            </div>
            {withholding && (
              <div className="flex justify-between text-[12.5px]">
                <span className="text-[#7C7C88]">원천징수액 (3.3%)</span>
                <span className="font-semibold text-[#DC2626]">−{fmt(withheldTotal)}원</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-[#F1F1F4]">
              <span className="text-[13px] font-semibold text-[#3C3C46]">실지급액</span>
              <span className="text-[18px] font-extrabold text-[#17171B]">{fmt(netTotal)}원</span>
            </div>
          </div>

          {/* 기록하면 이렇게 됩니다 */}
          <div className="bg-[#FAFAFB] rounded-xl px-4 py-3">
            <p className="text-[11.5px] font-bold text-[#5C5C68] mb-2">기록하면 이렇게 됩니다</p>
            <ul className="flex flex-col gap-1.5 text-[11.5px] text-[#7C7C88]">
              <li>· 정산 기록이 남습니다 (이후 수정 불가)</li>
              <li>· 양쪽에 각각 {creditAmount('deal_complete').toLocaleString()}C가 지급됩니다</li>
              <li>· 상호 평가 요청 알림이 발송됩니다</li>
              <li>· 5일 뒤 양쪽 연락처가 차단됩니다</li>
            </ul>
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}

          {/* 버튼 */}
          <div className="flex flex-col gap-2">
            {allReceived ? (
              <button
                onClick={handleRecord}
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-white font-bold text-[14px] transition disabled:opacity-40"
              >
                {submitting ? '기록 중...' : `${proposals.length}명 기록하기`}
              </button>
            ) : (
              <button
                onClick={handleRequestTaxDocs}
                disabled={submitting || requested}
                className="w-full py-3 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-white font-bold text-[14px] transition disabled:opacity-40"
              >
                {requested ? '요청 보냄 · 대기' : submitting ? '요청 중...' : `세무자료 ${missing.length}명 요청하기`}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-[#EAEAEE] text-[13px] text-[#7C7C88] hover:bg-[#F6F6F7] transition"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
