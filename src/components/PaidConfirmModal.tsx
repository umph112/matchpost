'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { dateWithDow } from '@/lib/date'
import { Phone } from 'lucide-react'

type PendingProposal = {
  id: string
  budget: number | null
  settled_at: string | null
  campaign: { title: string; manager_phone: string | null; company_phone: string | null } | null
  advertiser_profile: { name: string | null; manager_phone: string | null; company_phone: string | null } | null
  company_name?: string | null
}

export default function PaidConfirmModal({
  proposals,
  onDone,
}: {
  proposals: PendingProposal[]
  // 정상 수금은 닫기만 해도 처리되므로(confirmAndClose가 onDone을 호출) 별도 onClose는 쓰지 않는다.
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
    ? dateWithDow(proposals[0].settled_at)
    : ''

  // 담당자 휴대폰 › 회사 대표번호 순 — 대표번호는 담당자에게 안 닿아 미수 상황엔 소용없다
  const contactPhone =
    proposals[0]?.campaign?.manager_phone ??
    proposals[0]?.advertiser_profile?.manager_phone ??
    proposals[0]?.campaign?.company_phone ??
    proposals[0]?.advertiser_profile?.company_phone ??
    ''
  const contactLabel = [proposals[0]?.company_name, proposals[0]?.advertiser_profile?.name]
    .filter(Boolean)
    .join(' · ')

  // 정상 입금은 아무 액션도 요구하지 않는다 — 오버레이 클릭이든 버튼이든, "닫기" 자체가 확인이다.
  const confirmAndClose = async () => {
    if (loading) return
    setLoading(true)
    const now = new Date().toISOString()
    await supabase
      .from('proposals')
      .update({ paid_confirmed_at: now })
      .in('id', proposals.map((p) => p.id))
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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(23,23,27,0.45)] p-4"
      onClick={confirmAndClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-[480px]"
        onClick={(e) => e.stopPropagation()}
      >
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

        {/* 버튼 — 위계가 뒤집혀 있는 게 의도된 설계: 신고가 주 액션, 정상 수금은 닫기만 해도 처리됨 */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          <button
            onClick={handleDispute}
            disabled={loading}
            className="w-full py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition disabled:opacity-50"
          >
            입금된 게 없어요 — 브랜드에 알리기
          </button>
          {contactPhone ? (
            <a
              href={`tel:${contactPhone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center gap-1.5 w-full py-2.5 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition"
            >
              <Phone size={16} strokeWidth={1.75} className="shrink-0" /> {contactLabel && `${contactLabel} · `}{contactPhone}
            </a>
          ) : (
            <p className="text-[11px] text-gray-400 text-center">
              담당자 번호가 등록되지 않았어요 — 대시로 문의해주세요.
            </p>
          )}
          <button
            onClick={confirmAndClose}
            disabled={loading}
            className="w-full py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50 whitespace-nowrap"
          >
            잘 받았어요 · 닫기
          </button>
          <p className="text-[11px] text-gray-400 text-center leading-snug">
            들어왔으면 따로 하실 일이 없습니다 — 그대로 닫으면 정상 처리돼요.
          </p>
        </div>
      </div>
    </div>
  )
}
