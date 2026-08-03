'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type PendingProposal = {
  id: string
  budget: number | null
  settled_at: string | null
  campaign: { title: string } | null
  advertiser_profile: { name: string | null } | null
}

export default function PaidConfirmModal({
  proposals,
  onClose,
  onDone,
}: {
  proposals: PendingProposal[]
  onClose: () => void
  onDone: (confirmedIds: string[], disputedIds: string[]) => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const total = proposals.reduce((s, p) => s + (p.budget ?? 0), 0)
  const brandName =
    proposals[0]?.advertiser_profile?.name ??
    proposals[0]?.campaign?.title ??
    '광고주'
  const settledDate = proposals[0]?.settled_at
    ? new Date(proposals[0].settled_at).toLocaleDateString('ko-KR', {
        month: 'long', day: 'numeric',
      })
    : ''

  const handleConfirm = async () => {
    setLoading(true)
    setError('')
    const now = new Date().toISOString()
    const { error: err } = await supabase
      .from('proposals')
      .update({ paid_confirmed_at: now })
      .in('id', proposals.map((p) => p.id))
    if (err) { setError(err.message); setLoading(false); return }
    onDone(proposals.map((p) => p.id), [])
  }

  const handleDispute = async () => {
    setLoading(true)
    setError('')
    const now = new Date().toISOString()
    const { error: err } = await supabase
      .from('proposals')
      .update({ paid_disputed_at: now })
      .in('id', proposals.map((p) => p.id))
    if (err) { setError(err.message); setLoading(false); return }
    onDone([], proposals.map((p) => p.id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[480px]">
        {/* 헤더 */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <p className="text-xs text-gray-400 mb-1">{brandName} · {settledDate} 기록</p>
          <h2 className="text-lg font-bold text-gray-900">수금 확인</h2>
        </div>

        {/* 안내 */}
        <div className="px-6 py-4 bg-[#FAFAFB] border-b border-gray-100">
          <p className="text-[13px] text-[#5C5C68] leading-relaxed">
            <span className="font-semibold text-[#17171B]">기록과 수금은 다릅니다.</span><br />
            광고주가 정산을 기록했어요. 실제로 금액을 받으셨나요?
          </p>
        </div>

        {/* 금액 */}
        <div className="px-6 py-5">
          <div className="space-y-2">
            {proposals.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 truncate max-w-[280px]">
                  {p.campaign?.title ?? '캠페인'}
                </span>
                <span className="font-semibold text-gray-800 shrink-0 ml-2">
                  {(p.budget ?? 0).toLocaleString()}원
                </span>
              </div>
            ))}
            {proposals.length > 1 && (
              <div className="flex items-center justify-between text-sm font-bold pt-2 border-t border-gray-100">
                <span className="text-gray-800">합계</span>
                <span className="text-[#17171B]">{total.toLocaleString()}원</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="px-6 pb-3 text-sm text-red-500">{error}</p>
        )}

        {/* 버튼 */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full py-3 bg-[#F59E0B] text-white font-semibold rounded-xl hover:bg-[#D97706] transition disabled:opacity-50"
          >
            잘 받았어요
          </button>
          <button
            onClick={handleDispute}
            disabled={loading}
            className="w-full py-3 bg-red-50 text-red-600 font-semibold rounded-xl hover:bg-red-100 transition disabled:opacity-50"
          >
            수금된 것 없어요 → 브랜드에 알리기
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition"
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  )
}
