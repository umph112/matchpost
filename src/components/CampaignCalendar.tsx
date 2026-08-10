'use client'

import { useState } from 'react'
import Link from 'next/link'
import DashSendButton from './DashSendButton'

// 광고주 마이페이지 캘린더 — 월 그리드 + 날짜별 캠페인/오픈 카운트 칩 + 날짜 팝업(목록→상세).
/* eslint-disable @typescript-eslint/no-explicit-any */
type DayData = { campaigns: any[]; opens: any[] }
const DOW = ['일', '월', '화', '수', '목', '금', '토']
const pad = (n: number) => String(n).padStart(2, '0')
const BADGE: Record<string, string> = {
  진행중: 'bg-[#FEF3C7] text-[#B45309]',
  완료: 'bg-[#DCFCE7] text-[#15803D]',
  마감: 'bg-[#F1F1F4] text-[#7C7C88]',
  캔슬: 'bg-[#FEE2E2] text-[#DC2626]',
}
const CHIP_C = 'text-[10.5px] font-bold px-[7px] py-[3px] rounded-[5px] bg-[#FEF3C7] text-[#B45309] shrink-0'
const CHIP_O = 'text-[10.5px] font-bold px-[7px] py-[3px] rounded-[5px] bg-[#DBEAFE] text-[#1D4ED8] shrink-0'

export default function CampaignCalendar({
  year,
  month,
  byDay,
}: {
  year: number
  month: number
  byDay: Record<number, DayData>
}) {
  const [sel, setSel] = useState<number | null>(null)
  const [item, setItem] = useState<{ type: 'campaign' | 'open'; data: any } | null>(null)

  const firstDow = new Date(year, month - 1, 1).getDay()
  const daysIn = new Date(year, month, 0).getDate()
  const now = new Date()
  const today = now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : 0

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysIn; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const openDay = (d: number) => {
    setSel(d)
    setItem(null)
  }
  const close = () => {
    setSel(null)
    setItem(null)
  }

  const dayData = sel ? byDay[sel] : undefined
  const dayCamps = dayData?.campaigns ?? []
  const dayOpens = dayData?.opens ?? []
  const dowOf = (d: number) => DOW[(firstDow + d - 1) % 7]

  // 상세 행 구성
  const campRows = (c: any): [string, string][] => {
    const r: [string, string][] = [['유형', c.campaign_type || '—']]
    if (c.channels?.length) r.push(['채널', c.channels.join(', ')])
    if (c.recruit_start || c.recruit_end)
      r.push(['모집 일정', `${c.recruit_start || '?'} ~ ${c.recruit_end || '?'}${c.announce_date ? ` (발표 ${c.announce_date})` : ''}`])
    if (c.dates?.length) {
      const ds = c.dates
      r.push(['진행 일정', ds.length > 1 ? `${ds[0].date} ~ ${ds[ds.length - 1].date}` : `${ds[0].date}${ds[0].start_time ? ' ' + ds[0].start_time : ''}`])
    }
    if (c.location_name || c.location_address) r.push(['장소', [c.location_name, c.location_address].filter(Boolean).join(' ')])
    if (c.budget_total) r.push(['예산', `${c.budget_total.toLocaleString()}원`])
    if (c.payment_methods?.length) r.push(['결제', c.payment_methods.join(' / ')])
    return r
  }
  const openRows = (o: any): [string, string][] => {
    const r: [string, string][] = [
      ['오픈 날짜', sel ? `${year}. ${month}. ${sel} (${dowOf(sel)})` : ''],
      ['가능 시간', o.time || '종일'],
    ]
    if (o.channels?.length) r.push(['채널', o.channels.join(', ')])
    r.push(['희망 지역', o.region || '—'])
    if (o.fee) r.push(['희망 페이', o.fee])
    return r
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {DOW.map((w, i) => (
          <div key={w} className={`text-center text-[11px] font-bold pb-0.5 ${i === 0 ? 'text-[#EF4444]' : i === 6 ? 'text-[#3B82F6]' : 'text-[#9A9AA5]'}`}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, idx) => {
          if (d === null) return <div key={idx} className="min-h-[74px]" />
          const data = byDay[d]
          const nCamp = data?.campaigns.length || 0
          const nOpen = data?.opens.length || 0
          const has = nCamp > 0 || nOpen > 0
          const isToday = d === today
          const isSel = sel === d
          const dow = (firstDow + d - 1) % 7
          const numColor = isToday || isSel ? 'text-[#B45309]' : dow === 0 ? 'text-[#EF4444]' : dow === 6 ? 'text-[#3B82F6]' : 'text-[#5C5C68]'
          let cls = 'min-h-[74px] flex flex-col p-1.5 rounded-lg border transition-shadow '
          if (isSel) cls += 'border-[#F59E0B] bg-[#FFFBEB] shadow-[0_0_0_2px_rgba(245,158,11,0.25)] '
          else if (isToday) cls += 'border-[#FCD34D] bg-[#FFFBEB] '
          else cls += 'border-[#F1F1F4] bg-white '
          cls += has ? 'cursor-pointer' : 'cursor-default'
          return (
            <div key={idx} className={cls} onClick={() => has && openDay(d)}>
              <span className={`text-[11.5px] ${isToday || isSel ? 'font-extrabold' : 'font-medium'} ${numColor}`}>{d}</span>
              <div className="mt-auto flex flex-col gap-0.5">
                {nCamp > 0 && <span className="text-[9.5px] font-semibold leading-normal bg-[#FEF3C7] text-[#B45309] rounded-[3px] px-1 truncate">캠페인 {nCamp}</span>}
                {nOpen > 0 && <span className="text-[9.5px] font-semibold leading-normal bg-[#DBEAFE] text-[#1D4ED8] rounded-[3px] px-1 truncate">오픈 {nOpen}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* 날짜 팝업 */}
      {sel !== null && (
        <div
          className="fixed inset-0 z-[60] bg-[rgba(18,18,24,0.44)] flex items-center justify-center p-6 md:p-12"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-[720px] max-w-full max-h-[80vh] bg-white rounded-2xl overflow-hidden flex flex-col shadow-[0_24px_64px_rgba(0,0,0,0.28)]"
            onClick={(e) => e.stopPropagation()}
          >
            {!item ? (
              <>
                {/* 목록 뷰 */}
                <div className="flex items-center px-[22px] py-[18px] border-b border-[#F1F1F4] shrink-0">
                  <div>
                    <div className="text-base font-extrabold tracking-[-0.02em]">{`${year}년 ${month}월 ${sel}일 (${dowOf(sel)})`}</div>
                    <div className="text-xs text-[#8A8A96] mt-[3px]">내 캠페인 {dayCamps.length}건 · 공개 오픈 {dayOpens.length}건</div>
                  </div>
                  <button onClick={close} className="ml-auto w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[15px] text-[#8A8A96] hover:bg-[#F1F1F4]">✕</button>
                </div>
                <div className="overflow-y-auto p-2.5">
                  {dayCamps.map((c) => {
                    const target = c.recruit_target || c.stats?.total || 0
                    const meta = [c.campaign_type || '캠페인', c.channels?.length ? c.channels.join('·') : null, c.location_city || null].filter(Boolean).join(' · ')
                    return (
                      <button key={'c' + c.id} onClick={() => setItem({ type: 'campaign', data: c })} className="w-full flex items-center gap-3 p-3 rounded-[10px] hover:bg-[#FAFAFB] text-left">
                        <div className="w-9 h-9 rounded-[9px] bg-[#FEF3C7] text-[#B45309] text-[13px] font-extrabold flex items-center justify-center shrink-0">캠</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-[7px]">
                            <span className={CHIP_C}>내 캠페인</span>
                            <span className="text-[13.5px] font-bold tracking-[-0.01em] truncate">{c.title}</span>
                          </div>
                          <div className="text-[11.5px] text-[#9A9AA5] mt-1 truncate">{meta}</div>
                        </div>
                        <span className="text-xs font-semibold text-[#5C5C68] shrink-0">확정 {c.stats?.confirmed ?? 0}/{target}</span>
                        <span className="text-[13px] text-[#C4C4CE] shrink-0">›</span>
                      </button>
                    )
                  })}
                  {dayOpens.map((o) => (
                    <button key={'o' + o.id} onClick={() => setItem({ type: 'open', data: o })} className="w-full flex items-center gap-3 p-3 rounded-[10px] hover:bg-[#FAFAFB] text-left">
                      <div className="w-9 h-9 rounded-full bg-[#DBEAFE] text-[#1D4ED8] text-[13px] font-extrabold flex items-center justify-center shrink-0">{o.name[0]}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-[7px]">
                          <span className={CHIP_O}>공개 오픈</span>
                          <span className="text-[13.5px] font-bold tracking-[-0.01em] truncate">{o.name}</span>
                        </div>
                        <div className="text-[11.5px] text-[#9A9AA5] mt-1 truncate">
                          {[o.category, o.followers ? `팔로워 ${o.followers.toLocaleString()}` : null, o.time].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      {o.fee && <span className="text-xs font-semibold text-[#5C5C68] shrink-0">{o.fee}</span>}
                      <span className="text-[13px] text-[#C4C4CE] shrink-0">›</span>
                    </button>
                  ))}
                  {dayCamps.length === 0 && dayOpens.length === 0 && <p className="text-sm text-[#9A9AA5] p-4 text-center">이 날짜의 항목이 없어요.</p>}
                </div>
              </>
            ) : item.type === 'campaign' ? (
              <>
                {/* 캠페인 상세 */}
                <div className="flex items-center gap-2.5 px-[22px] py-[18px] border-b border-[#F1F1F4] shrink-0">
                  <button onClick={() => setItem(null)} className="w-7 h-7 rounded-lg border border-[#E2E2E8] flex items-center justify-center text-[13px] text-[#5C5C68] hover:bg-[#F6F6F7] shrink-0">‹</button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold tracking-[-0.02em] truncate">{item.data.title}</span>
                      <span className={`text-[11px] font-bold px-2 py-[3px] rounded-[5px] ${BADGE[item.data.derivedStatus] ?? ''}`}>{item.data.derivedStatus}</span>
                    </div>
                    <div className="text-xs text-[#8A8A96] mt-[3px]">{`${month}월 ${sel}일 (${dowOf(sel)}) · 확정 ${item.data.stats?.confirmed ?? 0}/${item.data.recruit_target || item.data.stats?.total || 0}명`}</div>
                  </div>
                  <button onClick={close} className="ml-auto w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[15px] text-[#8A8A96] hover:bg-[#F1F1F4] shrink-0">✕</button>
                </div>
                <div className="overflow-y-auto px-[22px] pt-1.5 pb-[18px]">
                  {campRows(item.data).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[104px_minmax(0,1fr)] gap-3.5 py-[11px] border-b border-[#F5F5F7]">
                      <span className="text-[12.5px] font-semibold text-[#9A9AA5]">{k}</span>
                      <span className="text-[13px] font-medium text-[#2A2A33]">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 px-[22px] py-3.5 border-t border-[#F1F1F4] bg-[#FAFAFB] shrink-0">
                  <button onClick={close} className="h-[38px] px-[15px] rounded-[9px] border border-[#E2E2E8] bg-white text-[13px] font-semibold text-[#3C3C46] hover:bg-[#F1F1F4]">닫기</button>
                  <Link href={`/advertiser/campaigns/${item.data.id}`} className="ml-auto h-[38px] px-[18px] rounded-[9px] bg-[#F59E0B] text-white text-[13px] font-bold flex items-center hover:bg-[#D97706] shadow-[0_1px_2px_rgba(245,158,11,0.35)]">딜시트 열기 →</Link>
                </div>
              </>
            ) : (
              <>
                {/* 오픈 상세 */}
                <div className="flex items-center gap-2.5 px-[22px] py-[18px] border-b border-[#F1F1F4] shrink-0">
                  <button onClick={() => setItem(null)} className="w-7 h-7 rounded-lg border border-[#E2E2E8] flex items-center justify-center text-[13px] text-[#5C5C68] hover:bg-[#F6F6F7] shrink-0">‹</button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold tracking-[-0.02em] truncate">{item.data.name}</span>
                      <span className={CHIP_O}>공개 오픈</span>
                    </div>
                    <div className="text-xs text-[#8A8A96] mt-[3px]">{[item.data.category, item.data.followers ? `팔로워 ${item.data.followers.toLocaleString()}` : null].filter(Boolean).join(' · ')}</div>
                  </div>
                  <button onClick={close} className="ml-auto w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[15px] text-[#8A8A96] hover:bg-[#F1F1F4] shrink-0">✕</button>
                </div>
                <div className="overflow-y-auto px-[22px] pt-1.5 pb-[18px]">
                  {openRows(item.data).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[104px_minmax(0,1fr)] gap-3.5 py-[11px] border-b border-[#F5F5F7]">
                      <span className="text-[12.5px] font-semibold text-[#9A9AA5]">{k}</span>
                      <span className="text-[13px] font-medium text-[#2A2A33]">{v}</span>
                    </div>
                  ))}
                  {item.data.memo && (
                    <div className="mt-3.5 bg-[#F6F6F7] rounded-[10px] px-[15px] py-[13px]">
                      <div className="text-[11px] font-bold text-[#9A9AA5] mb-1">인플루언서 메모</div>
                      <div className="text-[13px] leading-relaxed text-[#3C3C46]">{item.data.memo}</div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 px-[22px] py-3.5 border-t border-[#F1F1F4] bg-[#FAFAFB] shrink-0">
                  <Link href={`/profile/${item.data.influencerId}`} className="h-[38px] px-[15px] rounded-[9px] border border-[#E2E2E8] bg-white text-[13px] font-semibold text-[#3C3C46] flex items-center hover:bg-[#F1F1F4]">프로필 보기</Link>
                  <DashSendButton
                    influencerId={item.data.influencerId}
                    influencerName={item.data.name}
                    scheduleId={item.data.id}
                    scheduleDate={`${year}-${pad(month)}-${pad(sel!)}`}
                    className="ml-auto h-[38px] px-[18px] rounded-[9px] bg-[#F59E0B] text-white text-[13px] font-bold flex items-center hover:bg-[#D97706] shadow-[0_1px_2px_rgba(245,158,11,0.35)]"
                  >
                    이 날짜로 대시 보내기 →
                  </DashSendButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
