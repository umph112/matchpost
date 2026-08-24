'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ClipboardList, CalendarDays, MapPin, MessageSquare } from 'lucide-react'
import { dateRangeWithDow } from '@/lib/date'

type Open = {
  id: string
  title: string
  date: string
  date_end?: string | null
  location_city?: string
  location_district?: string
  derivedStatus: '진행중' | '메이드' | '마감' | '캔슬'
  dashHref?: string | null
}

const STATUS_STYLE: Record<string, string> = {
  진행중: 'bg-[#FEF3C7] text-[#B45309]',
  메이드: 'bg-green-100 text-green-600',
  마감: 'bg-gray-100 text-gray-500',
  캔슬: 'bg-red-100 text-red-500',
}

export default function MyOpensList({ opens }: { opens: Open[] }) {
  const [onlyActive, setOnlyActive] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const list = onlyActive ? opens.filter((o) => o.derivedStatus === '진행중') : opens

  const cancelOpen = async (id: string) => {
    if (!confirm('이 오픈을 취소할까요? (캔슬 처리됩니다)')) return
    setBusy(id)
    await supabase.from('schedules').update({ status: 'cancelled' }).eq('id', id)
    setBusy(null)
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1"><ClipboardList size={16} strokeWidth={1.75} /> 내가 등록한 오픈</h2>
        <button
          onClick={() => setOnlyActive((v) => !v)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
            onlyActive ? 'bg-[#F59E0B] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          진행중만
        </button>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-gray-400 bg-white rounded-2xl p-4 shadow-sm">
          {onlyActive ? '진행중인 오픈이 없어요.' : '아직 등록한 오픈이 없어요.'}
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((o) => (
            <div key={o.id} className="bg-white rounded-2xl p-4 shadow-sm">
              {/* 오픈을 누르면 그날의 묶음 보기로 — D24 */}
              <Link
                href={`/influencer/schedule/${o.id}`}
                className="flex items-start justify-between gap-2 -m-1 p-1 rounded-xl hover:bg-gray-50 transition"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{o.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center flex-wrap gap-x-2 gap-y-0.5">
                    {/* 기간 오픈이면 「8/28 (금) – 8/29 (토)」 */}
                    <span className="inline-flex items-center gap-1"><CalendarDays size={16} strokeWidth={1.75} /> {dateRangeWithDow(o.date, o.date_end)}</span>
                    <span className="inline-flex items-center gap-1"><MapPin size={16} strokeWidth={1.75} /> {o.location_city} {o.location_district}</span>
                  </p>
                </div>
                <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE[o.derivedStatus]}`}>
                  {o.derivedStatus}
                </span>
              </Link>
              {/* 대시가 온 오픈만 대화로 연결(0건은 커서 없음) — C4 */}
              {o.dashHref && (
                <Link
                  href={o.dashHref}
                  className="text-[11px] text-[#B45309] hover:text-[#92400E] font-medium mt-1 inline-flex items-center gap-1"
                >
                  <MessageSquare size={16} strokeWidth={1.75} /> 대시 열기 →
                </Link>
              )}
              {o.derivedStatus === '진행중' && (
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => cancelOpen(o.id)}
                    disabled={busy === o.id}
                    className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50"
                  >
                    {busy === o.id ? '취소 중...' : '오픈 취소'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
