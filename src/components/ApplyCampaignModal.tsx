'use client'

import { useState } from 'react'
import { applyToCampaign } from '@/lib/deals/applyCampaign'
import { dateWithDow } from '@/lib/date'

export type ApplyCampaign = {
  id: string
  title: string
  campaign_type?: string | null
  dates?: { date: string; start_time?: string | null; end_time?: string | null }[] | null
  content_start?: string | null
  channels?: string[] | null
  budget_total?: number | null
}

// D32 1절 — 캠페인 지원 팝업.
// 오픈 대시(ConfirmDashModal)와 모양은 같지만 성격이 다르다.
// 대시는 조건을 제안하는 것이고, 지원은 광고주가 이미 내건 조건에 참여를 신청하는 것이다.
// 그래서 여기엔 「다른 날짜 제안」이 없다 — 광고주가 정해 둔 날 중에서만 고른다.
export default function ApplyCampaignModal({
  campaign,
  onClose,
  onApplied,
}: {
  campaign: ApplyCampaign
  onClose: () => void
  onApplied: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  // 지역 캠페인만 진행일이 있다. 지난 날짜는 고를 수 없다.
  const isRegion = campaign.campaign_type === '지역'
  const dates = isRegion
    ? [...new Set((campaign.dates ?? []).map((d) => d.date))].filter((d) => d >= today).sort()
    : []

  const [selected, setSelected] = useState<string | null>(dates[0] ?? null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const blocked = isRegion && dates.length === 0
  const canSend = !busy && !blocked && (!isRegion || !!selected)

  const submit = async () => {
    setBusy(true)
    setError('')
    const res = await applyToCampaign({
      campaignId: campaign.id,
      message,
      date: isRegion ? selected : null,
    })
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    onApplied()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(17,17,21,0.5)] px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-[380px] overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-4">
          <p className="text-base font-bold text-[#17171B]">이 캠페인에 지원할까요?</p>
          <p className="text-[12px] text-[#7C7C88] mt-1.5 leading-relaxed">
            지원하면 광고주에게 알림이 가고 대화가 열려요. 크레딧은 들지 않아요.
          </p>
          <p className="text-[12px] font-semibold text-[#5C5C68] mt-3 truncate">{campaign.title}</p>
        </div>

        {/* 날짜 — 지역 캠페인만. 광고주가 정해 둔 날 중에서 고른다 */}
        {isRegion ? (
          <div className="px-5 pb-3">
            <p className="text-[11px] font-semibold text-[#9A9AA5] mb-1.5">방문할 날짜</p>
            {blocked ? (
              <p className="text-[12px] text-[#B0B0BB]">남은 진행일이 없어요.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {dates.map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelected(d)}
                    className={`text-[12px] font-semibold px-3 py-1.5 rounded-full border transition ${
                      selected === d
                        ? 'bg-[#17171B] text-white border-[#17171B]'
                        : 'bg-white text-[#5C5C68] border-[#EAEAEE] hover:border-[#C4C4CE]'
                    }`}
                  >
                    {dateWithDow(d)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="px-5 pb-3">
            <p className="text-[11px] font-semibold text-[#9A9AA5] mb-1.5">진행일</p>
            <p className="text-[12px] text-[#7C7C88]">
              {campaign.content_start
                ? `방문이 없는 캠페인이에요. 콘텐츠 등록은 ${dateWithDow(campaign.content_start)}부터예요.`
                : '방문이 없는 캠페인이라 고를 날짜가 없어요.'}
            </p>
          </div>
        )}

        <div className="px-5 pb-3">
          <p className="text-[11px] font-semibold text-[#9A9AA5] mb-1.5">하고 싶은 말 (선택)</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="어떤 콘텐츠로 참여할지 짧게 적어주세요"
            className="w-full border border-[#EAEAEE] rounded-lg px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>

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
            onClick={submit}
            disabled={!canSend}
            className="flex-1 py-2.5 rounded-xl bg-[#F59E0B] text-white font-bold text-sm hover:bg-[#D97706] transition disabled:opacity-50 disabled:bg-[#EAEAEE] disabled:text-[#B0B0BB] whitespace-nowrap"
          >
            {busy ? '보내는 중...' : '지원하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
