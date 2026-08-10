'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { initial } from '@/lib/initial'

// D6 E3 — 제재 사다리: 안내(0) → 표시(1) → 제한(2) → 정지(3) → 해지(4)
const LADDER = ['안내', '표시', '제한', '정지', '해지']
const LADDER_STYLE = [
  'bg-gray-100 text-gray-500',
  'bg-blue-100 text-blue-600',
  'bg-orange-100 text-orange-600',
  'bg-red-100 text-red-500',
  'bg-red-600 text-white',
]

export default function AdminSanctionsPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const supabase = createClient()

  const load = async () => {
    const { data: levels } = await supabase.from('user_sanction_level').select('user_id, level').gt('level', 0)
    const userIds = (levels ?? []).map((l) => l.user_id)
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, name, role').in('id', userIds)
      : { data: [] }
    const { data: history } = userIds.length
      ? await supabase.from('sanctions').select('user_id, level, reason, created_at').in('user_id', userIds).order('created_at', { ascending: false })
      : { data: [] }
    const latestReason: Record<string, string> = {}
    for (const h of history ?? []) if (!latestReason[h.user_id]) latestReason[h.user_id] = h.reason

    const profById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))
    setRows(
      (levels ?? []).map((l) => ({
        userId: l.user_id,
        level: l.level as number,
        name: profById[l.user_id]?.name ?? '알 수 없음',
        role: profById[l.user_id]?.role,
        reason: latestReason[l.user_id] ?? '',
      }))
    )
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // "단계 올리기"가 실제로 사다리를 올린다 — sanctions에 새 행을 남겨 다음 단계로
  const raiseLevel = async (userId: string, currentLevel: number) => {
    if (currentLevel >= LADDER.length - 1) return
    const reason = prompt('다음 단계로 올리는 사유를 입력해주세요:')
    if (!reason) return
    setBusyId(userId)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('sanctions').insert({
      user_id: userId,
      level: currentLevel + 1,
      reason,
      set_by: user?.id ?? null,
    })
    setBusyId(null)
    load()
  }

  const release = async (userId: string) => {
    if (!confirm('제재를 해제할까요?')) return
    setBusyId(userId)
    await supabase.from('sanctions').update({ released_at: new Date().toISOString() }).eq('user_id', userId).is('released_at', null)
    setBusyId(null)
    load()
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center mb-8">
        <Link href="/admin/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">← 뒤로</Link>
        <h1 className="text-xl font-bold text-gray-900">제재 관리</h1>
      </div>

      {/* 사다리 범례 */}
      <div className="flex items-center gap-2 mb-6">
        {LADDER.map((l, i) => (
          <span key={l} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${LADDER_STYLE[i]}`}>
            {i}. {l}
          </span>
        ))}
      </div>

      {loading && <p className="text-center text-gray-400 py-16">불러오는 중...</p>}
      {!loading && rows.length === 0 && (
        <p className="text-center text-gray-400 py-16">제재 대상이 없어요.</p>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.userId} className="bg-white rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-[#FEF3C7] rounded-full flex items-center justify-center text-[#B45309] font-bold shrink-0">
                {initial(r.name)}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 truncate">{r.name} <span className="text-xs text-gray-400 font-normal">({r.role === 'advertiser' ? '광고주' : '인플루언서'})</span></p>
                <p className="text-xs text-gray-400 truncate">{r.reason}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${LADDER_STYLE[r.level]}`}>
                {r.level}. {LADDER[r.level]}
              </span>
              {r.level < LADDER.length - 1 && (
                <button
                  onClick={() => raiseLevel(r.userId, r.level)}
                  disabled={busyId === r.userId}
                  className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  다음 단계로
                </button>
              )}
              <button
                onClick={() => release(r.userId)}
                disabled={busyId === r.userId}
                className="text-xs font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                해제
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
