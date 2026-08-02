'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type DayCounts = { open: number; campaign: number }

export default function HomeCalendar({
  year,
  month, // 1-12
  countsByDate,
  isLoggedIn,
}: {
  year: number
  month: number
  countsByDate: Record<string, DayCounts>
  isLoggedIn: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)

  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startWeekday = firstDay.getDay() // 0=일
  const todayStr = ymd(new Date())

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const weekdays = ['일', '월', '화', '수', '목', '금', '토']

  const handleDayClick = (dateStr: string, c: DayCounts) => {
    if (!c.open && !c.campaign) return
    if (isLoggedIn) {
      router.push(`/day/${dateStr}`)
    } else {
      setSelected(dateStr)
    }
  }

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm p-4">
        {/* 월 표시 */}
        <div className="flex items-center justify-center mb-4">
          <span className="text-lg font-bold text-gray-900">
            {year}년 {month}월
          </span>
        </div>

        {/* 요일 */}
        <div className="grid grid-cols-7 mb-1">
          {weekdays.map((w, i) => (
            <div
              key={w}
              className={`text-center text-xs font-medium py-1 ${
                i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
              }`}
            >
              {w}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (day === null) return <div key={idx} />
            const dateStr = `${year}-${pad(month)}-${pad(day)}`
            const c = countsByDate[dateStr] ?? { open: 0, campaign: 0 }
            const has = c.open > 0 || c.campaign > 0
            const isToday = dateStr === todayStr
            return (
              <button
                key={idx}
                onClick={() => handleDayClick(dateStr, c)}
                className={`aspect-square rounded-xl border text-left p-1.5 flex flex-col transition ${
                  isToday ? 'border-amber-400 bg-[#FEF3C7]' : 'border-gray-100'
                } ${has ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}
              >
                <span className={`text-xs font-medium ${isToday ? 'text-[#B45309]' : 'text-gray-600'}`}>
                  {day}
                </span>
                <div className="mt-auto space-y-0.5">
                  {c.campaign > 0 && (
                    <span className="block text-[10px] leading-tight bg-amber-100 text-amber-700 rounded px-1 truncate">
                      캠페인 {c.campaign}
                    </span>
                  )}
                  {c.open > 0 && (
                    <span className="block text-[10px] leading-tight bg-blue-100 text-blue-700 rounded px-1 truncate">
                      오픈 {c.open}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* 범례 */}
        <div className="flex items-center justify-center gap-4 mt-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> 캠페인(광고주)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> 오픈(인플루언서)
          </span>
        </div>
      </div>

      {/* 비로그인 클릭 안내 */}
      {selected && !isLoggedIn && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-4xl mb-3">🔒</div>
            <h3 className="font-bold text-gray-900 mb-1">로그인이 필요해요</h3>
            <p className="text-sm text-gray-500 mb-5">
              {new Date(selected).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}의
              캠페인·오픈 일정은 로그인 후 볼 수 있어요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/login')}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700"
              >
                로그인
              </button>
              <button
                onClick={() => router.push('/signup')}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200"
              >
                회원가입
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
