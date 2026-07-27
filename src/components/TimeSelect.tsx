'use client'

// 24시간 단위 시간 선택 (시 00~23 / 분 00~59). 값 형식은 'HH:MM'.
// 네이티브 input[type=time]이 로케일에 따라 오전/오후로 표시되는 문제를 피하기 위해 사용.
export default function TimeSelect({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  const [h, m] = value ? value.split(':') : ['', '']

  const set = (hh: string, mm: string) => {
    if (!hh && !mm) return onChange('')
    onChange(`${(hh || '00').padStart(2, '0')}:${(mm || '00').padStart(2, '0')}`)
  }

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const mins = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
  const sel = 'border border-gray-200 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500'

  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`}>
      <select value={h} onChange={(e) => set(e.target.value, m)} className={sel} aria-label="시">
        <option value="">시</option>
        {hours.map((x) => (
          <option key={x} value={x}>{x}</option>
        ))}
      </select>
      <span className="text-gray-400 text-sm">:</span>
      <select value={m} onChange={(e) => set(h, e.target.value)} className={sel} aria-label="분">
        <option value="">분</option>
        {mins.map((x) => (
          <option key={x} value={x}>{x}</option>
        ))}
      </select>
    </div>
  )
}
