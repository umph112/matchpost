'use client'

import { useState } from 'react'

// 광고주 마이페이지 캘린더 — 월 그리드 + 날짜별 캠페인/오픈 카운트 칩.
// 일정 있는 날 클릭 → selectedDay 하이라이트 (날짜 팝업은 STEP 5에서 추가).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DayData = { campaigns: any[]; opens: any[] }
const DOW = ['일', '월', '화', '수', '목', '금', '토']

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

  const firstDow = new Date(year, month - 1, 1).getDay()
  const daysIn = new Date(year, month, 0).getDate()
  const now = new Date()
  const today = now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : 0

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysIn; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {DOW.map((w, i) => (
          <div
            key={w}
            className={`text-center text-[11px] font-bold pb-0.5 ${i === 0 ? 'text-[#EF4444]' : i === 6 ? 'text-[#3B82F6]' : 'text-[#9A9AA5]'}`}
          >
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
          const numColor =
            isToday || isSel ? 'text-[#B45309]' : dow === 0 ? 'text-[#EF4444]' : dow === 6 ? 'text-[#3B82F6]' : 'text-[#5C5C68]'
          let cls = 'min-h-[74px] flex flex-col p-1.5 rounded-lg border transition-shadow '
          if (isSel) cls += 'border-[#F59E0B] bg-[#FFFBEB] shadow-[0_0_0_2px_rgba(245,158,11,0.25)] '
          else if (isToday) cls += 'border-[#FCD34D] bg-[#FFFBEB] '
          else cls += 'border-[#F1F1F4] bg-white '
          cls += has ? 'cursor-pointer' : 'cursor-default'
          return (
            <div key={idx} className={cls} onClick={() => has && setSel(d)}>
              <span className={`text-[11.5px] ${isToday || isSel ? 'font-extrabold' : 'font-medium'} ${numColor}`}>{d}</span>
              <div className="mt-auto flex flex-col gap-0.5">
                {nCamp > 0 && (
                  <span className="text-[9.5px] font-semibold leading-normal bg-[#FEF3C7] text-[#B45309] rounded-[3px] px-1 truncate">
                    캠페인 {nCamp}
                  </span>
                )}
                {nOpen > 0 && (
                  <span className="text-[9.5px] font-semibold leading-normal bg-[#DBEAFE] text-[#1D4ED8] rounded-[3px] px-1 truncate">
                    오픈 {nOpen}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {/* STEP 5: 선택 날짜 팝업(목록→상세) 예정 */}
    </div>
  )
}
