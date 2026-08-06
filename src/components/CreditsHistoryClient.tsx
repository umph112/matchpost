'use client'

import { useState } from 'react'

type Row = {
  id: string
  delta: number
  kind: string
  reason_code: string
  memo: string | null
  created_at: string
  label: string
}

const KIND_CHIP: Record<string, string> = {
  reward: 'bg-[#DCFCE7] text-[#15803D]',
  welcome: 'bg-[#DCFCE7] text-[#15803D]',
  purchase: 'bg-[#F1F1F4] text-[#5C5C68]',
  refund: 'bg-[#DBEAFE] text-[#1D4ED8]',
  penalty: 'bg-[#FEE2E2] text-[#DC2626]',
  decay: 'bg-[#FEE2E2] text-[#DC2626]',
  admin: 'bg-[#F1F1F4] text-[#5C5C68]',
}

type Filter = '전체' | '쌓임' | '사용'

export default function CreditsHistoryClient({ rows }: { rows: Row[] }) {
  const [filter, setFilter] = useState<Filter>('전체')

  const filtered = rows.filter((r) => {
    if (filter === '쌓임') return r.delta > 0
    if (filter === '사용') return r.delta < 0
    return true
  })

  const fmt = (n: number) => n.toLocaleString()

  return (
    <div>
      <div className="flex gap-[3px] bg-[#F1F1F4] rounded-lg p-[3px] w-fit mb-3">
        {(['전체', '쌓임', '사용'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[12.5px] font-semibold px-3.5 py-[7px] rounded-md transition ${
              filter === f ? 'bg-white text-[#17171B] shadow-[0_1px_2px_rgba(0,0,0,.06)]' : 'text-[#8A8A96] hover:text-[#5C5C68]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#EAEAEE] rounded-[14px] overflow-hidden">
        <div className="grid grid-cols-[100px_minmax(0,1fr)_110px_100px] gap-2 px-4 py-2.5 bg-[#FAFAFB] border-b border-[#F1F1F4] text-[11px] font-bold text-[#9A9AA5]">
          <span>날짜</span>
          <span>내용</span>
          <span className="text-right">변동</span>
          <span className="text-right">종류</span>
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-[#B0B0BB] text-center py-12">내역이 없어요.</p>
        ) : (
          filtered.map((r) => (
            <div key={r.id} className="grid grid-cols-[100px_minmax(0,1fr)_110px_100px] gap-2 px-4 py-3 border-b border-[#F5F5F7] items-center text-[12.5px]">
              <span className="text-[#9A9AA5] text-[11.5px]">
                {new Date(r.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
              </span>
              <span className="truncate font-medium text-[#3C3C46]">{r.label}{r.memo ? ` · ${r.memo}` : ''}</span>
              <span className={`text-right font-bold ${r.delta > 0 ? 'text-emerald-600' : 'text-[#DC2626]'}`}>
                {r.delta > 0 ? '+' : ''}{fmt(r.delta)} C
              </span>
              <span className="text-right">
                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${KIND_CHIP[r.kind] ?? 'bg-[#F1F1F4] text-[#5C5C68]'}`}>
                  {r.kind}
                </span>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
