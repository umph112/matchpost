'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sendDash } from '@/lib/deals/sendDash'

// 대시 보내기 확인 팝업 — 같은 상대(+같은 캠페인/오픈)에 아직 미확정 proposals 행이
// 있으면 "다시 보내기"로, 없으면 "대시 보내기"로 문구를 바꾼다 (IMPLEMENT-5-DELTA.md A4).
export default function ConfirmDashModal({
  influencerId,
  influencerName,
  scheduleId,
  campaignId,
  message,
  budget,
  collaborationType,
  onClose,
}: {
  influencerId: string
  influencerName: string
  scheduleId?: string | null
  campaignId?: string | null
  message?: string | null
  budget?: number | null
  collaborationType?: string | null
  onClose: () => void
}) {
  const [checking, setChecking] = useState(true)
  const [isResend, setIsResend] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setChecking(false); return }
      let q = supabase
        .from('proposals')
        .select('id, advertiser_confirmed, influencer_confirmed')
        .eq('advertiser_id', user.id)
        .eq('influencer_id', influencerId)
      if (campaignId) q = q.eq('campaign_id', campaignId)
      else if (scheduleId) q = q.eq('schedule_id', scheduleId)
      else q = q.is('campaign_id', null).is('schedule_id', null)

      const { data } = await q
      const open = (data ?? []).some((p) => !(p.advertiser_confirmed && p.influencer_confirmed))
      setIsResend(open)
      setChecking(false)
    }
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const confirm = async () => {
    setBusy(true)
    setError('')
    const res = await sendDash({ influencerId, scheduleId, campaignId, message, budget, collaborationType })
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    router.push(`/advertiser/messages?c=${influencerId}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-[380px] overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4">
          <p className="text-base font-bold text-[#17171B]">
            {checking
              ? '확인 중...'
              : isResend
              ? '조건을 바꿔 다시 보낼까요?'
              : `${influencerName}님에게 대시를 보낼까요?`}
          </p>
          <p className="text-[12px] text-[#7C7C88] mt-1.5 leading-relaxed">
            {isResend
              ? '보내면 기존 대화에 조건이 바뀌었다는 안내가 남고, 상대에게 다시 알림이 가요.'
              : '보내면 바로 대화가 열리고 상대에게 알림이 가요. 베타 기간이라 무료예요.'}
          </p>
        </div>

        {error && <p className="px-5 pb-2 text-xs text-red-500">{error}</p>}

        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl border border-[#EAEAEE] text-sm text-[#7C7C88] hover:bg-[#F6F6F7] transition disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={confirm}
            disabled={busy || checking}
            className="flex-1 py-2.5 rounded-xl bg-[#F59E0B] text-white font-bold text-sm hover:bg-[#D97706] transition disabled:opacity-50"
          >
            {busy ? '보내는 중...' : isResend ? '다시 보내기' : '대시 보내기'}
          </button>
        </div>
      </div>
    </div>
  )
}
