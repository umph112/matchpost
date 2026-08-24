'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sendDash } from '@/lib/deals/sendDash'
import { dateWithDow } from '@/lib/date'

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
  scheduleDate,
  onClose,
}: {
  influencerId: string
  influencerName: string
  scheduleId?: string | null
  campaignId?: string | null
  message?: string | null
  budget?: number | null
  collaborationType?: string | null
  scheduleDate?: string | null
  onClose: () => void
}) {
  const [checking, setChecking] = useState(true)
  const [isResend, setIsResend] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [openDates, setOpenDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(scheduleDate ?? null)
  const [customDate, setCustomDate] = useState(false)
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

      // A6: 상대가 열어둔 오픈 날짜를 기본 선택지로
      if (!open) {
        const { data: opens } = await supabase
          .from('schedules')
          .select('date')
          .eq('influencer_id', influencerId)
          .eq('status', 'open')
          .gte('date', new Date().toISOString().slice(0, 10))
          .order('date', { ascending: true })
          .limit(4)
        const dates = [...new Set((opens ?? []).map((o) => o.date as string))]
        setOpenDates(dates)
        if (!selectedDate && dates.length > 0) setSelectedDate(dates[0])
      }
      setChecking(false)
    }
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const confirm = async () => {
    if (!isResend && !selectedDate) return
    setBusy(true)
    setError('')
    const res = await sendDash({
      influencerId, scheduleId, campaignId, message, budget, collaborationType,
      date: selectedDate ?? '',
    })
    if (!res.ok) { setBusy(false); setError(res.error); return }

    const { data: user } = await supabase.auth.getUser()
    const { data: convId } = await supabase.rpc('get_or_create_conversation', {
      p_advertiser_id: user.user?.id, p_kind: campaignId ? 'campaign' : 'personal',
      p_campaign_id: campaignId ?? null, p_other_id: campaignId ? null : influencerId,
    })
    setBusy(false)
    router.push(`/advertiser/messages/${convId}`)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(17,17,21,0.5)] px-4" onClick={onClose}>
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

        {/* A6: 다시 보내기 모드에는 날짜 질문이 없다 */}
        {!checking && !isResend && (
          <div className="px-5 pb-3">
            <p className="text-[11px] font-semibold text-[#9A9AA5] mb-1.5">날짜</p>
            <div className="flex flex-wrap gap-1.5">
              {openDates.map((d) => (
                <button
                  key={d}
                  onClick={() => { setSelectedDate(d); setCustomDate(false) }}
                  className={`text-[12px] font-semibold px-3 py-1.5 rounded-full border transition ${
                    selectedDate === d && !customDate
                      ? 'bg-[#17171B] text-white border-[#17171B]'
                      : 'bg-white text-[#5C5C68] border-[#EAEAEE] hover:border-[#C4C4CE]'
                  }`}
                >
                  {dateWithDow(d)}
                </button>
              ))}
              <button
                onClick={() => { setCustomDate(true); setSelectedDate(null) }}
                className={`text-[12px] font-semibold px-3 py-1.5 rounded-full border transition ${
                  customDate
                    ? 'bg-[#17171B] text-white border-[#17171B]'
                    : 'bg-white text-[#5C5C68] border-[#EAEAEE] hover:border-[#C4C4CE]'
                }`}
              >
                다른 날짜 제안
              </button>
            </div>
            {customDate && (
              <input
                type="date"
                value={selectedDate ?? ''}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-2 w-full border border-[#EAEAEE] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            )}
            {!selectedDate && (
              <p className="text-[11px] text-[#B0B0BB] mt-1.5">날짜를 골라야 보낼 수 있어요 — 이 값이 딜시트의 진행일이 됩니다.</p>
            )}
          </div>
        )}

        {error && <p className="px-5 pb-2 text-xs text-red-500">{error}</p>}

        <div className="flex items-stretch gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl border border-[#EAEAEE] text-sm text-[#7C7C88] hover:bg-[#F6F6F7] transition disabled:opacity-50 whitespace-nowrap"
          >
            취소
          </button>
          <button
            onClick={confirm}
            disabled={busy || checking || (!isResend && !selectedDate)}
            className="flex-1 py-2.5 rounded-xl bg-[#F59E0B] text-white font-bold text-sm hover:bg-[#D97706] transition disabled:opacity-50 disabled:bg-[#EAEAEE] disabled:text-[#B0B0BB] whitespace-nowrap"
          >
            {busy ? '보내는 중...' : isResend ? '다시 보내기' : '대시 보내기'}
          </button>
        </div>
      </div>
    </div>
  )
}
