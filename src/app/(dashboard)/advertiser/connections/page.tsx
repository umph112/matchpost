'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { initial } from '@/lib/initial'
import { respondConnection, revokeConnection } from '@/lib/connections/actions'

type ConnectionRow = {
  id: string
  a_id: string
  b_id: string
  a_ok: boolean
  b_ok: boolean
  otherId: string
  otherName: string
  active: boolean
  proposedByMe: boolean
}

export default function AdvertiserConnectionsPage() {
  const [rows, setRows] = useState<ConnectionRow[]>([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const supabase = createClient()

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data } = await supabase
      .from('connections')
      .select('id, a_id, b_id, a_ok, b_ok')
      .or(`a_id.eq.${user.id},b_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (!data || data.length === 0) { setRows([]); setLoading(false); return }

    const otherIds = data.map((c) => (c.a_id === user.id ? c.b_id : c.a_id))
    const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', otherIds)
    const nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.name]))

    setRows(
      data.map((c) => {
        const otherId = c.a_id === user.id ? c.b_id : c.a_id
        return {
          ...c,
          otherId,
          otherName: nameMap[otherId] ?? '알 수 없음',
          active: c.a_ok && c.b_ok,
          proposedByMe: !(c.a_ok && c.b_ok) && ((c.a_id === user.id && c.a_ok) || (c.b_id === user.id && c.b_ok)),
        }
      })
    )
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const accept = async (id: string) => {
    setBusyId(id); setError('')
    const res = await respondConnection(id, true)
    setBusyId(null)
    if (!res.ok) { setError(res.error); return }
    load()
  }

  const decline = async (id: string) => {
    setBusyId(id); setError('')
    const res = await respondConnection(id, false)
    setBusyId(null)
    if (!res.ok) { setError(res.error); return }
    load()
  }

  const revoke = async (id: string) => {
    setBusyId(id); setError('')
    const res = await revokeConnection(id)
    setBusyId(null)
    if (!res.ok) { setError(res.error); return }
    load()
  }

  const active = rows.filter((r) => r.active)
  const incoming = rows.filter((r) => !r.active && !r.proposedByMe)
  const sent = rows.filter((r) => !r.active && r.proposedByMe)

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center mb-8">
        <Link href="/advertiser/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">← 뒤로</Link>
        <h1 className="text-xl font-bold text-gray-900">내 인플루언서</h1>
      </div>

      {loading && <p className="text-center text-gray-400 py-16">불러오는 중...</p>}
      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {!loading && incoming.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 mb-2">받은 등록 제안</p>
          {incoming.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm mb-2 flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-9 h-9 bg-[#FEF3C7] rounded-full flex items-center justify-center text-[#B45309] font-bold mr-3">
                  {initial(r.otherName)}
                </div>
                <p className="font-semibold text-gray-800 text-sm">{r.otherName}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => decline(r.id)} disabled={busyId === r.id}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">거절</button>
                <button onClick={() => accept(r.id)} disabled={busyId === r.id}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#F59E0B] text-white hover:bg-[#D97706]">수락</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div>
          <p className="text-xs font-semibold text-gray-400 mb-2">등록된 인플루언서 ({active.length}명)</p>
          {active.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">
              아직 없어요 — 협업이 정산 완료되면 딜시트에서 등록을 제안할 수 있어요
            </p>
          )}
          {active.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm mb-2 flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-9 h-9 bg-[#DCFCE7] rounded-full flex items-center justify-center text-[#15803D] font-bold mr-3">
                  {initial(r.otherName)}
                </div>
                <p className="font-semibold text-gray-800 text-sm">{r.otherName}</p>
              </div>
              <div className="flex items-center gap-3">
                <Link href={`/advertiser/messages?to=${r.otherId}`} className="text-xs text-[#B45309] hover:underline">
                  메시지
                </Link>
                <button onClick={() => revoke(r.id)} disabled={busyId === r.id}
                  className="text-xs text-gray-300 hover:text-red-500">해제</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && sent.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold text-gray-400 mb-2">보낸 제안 — 상대 수락 대기 중</p>
          {sent.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm mb-2 flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold mr-3">
                  {initial(r.otherName)}
                </div>
                <p className="font-semibold text-gray-800 text-sm">{r.otherName}</p>
              </div>
              <button onClick={() => revoke(r.id)} disabled={busyId === r.id}
                className="text-xs text-gray-300 hover:text-red-500">취소</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
