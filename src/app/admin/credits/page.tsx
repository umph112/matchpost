'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { CREDIT_ACTION_LABELS } from '@/lib/creditConfig'

type UserRow = {
  id: string
  name: string
  email: string
  role: string
  balance: number
}

type TxRow = {
  id: string
  amount: number
  action: string
  description: string | null
  reference_id: string | null
  created_at: string
}

type RawLedgerRow = {
  id: string
  delta: number
  reason_code: string
  memo: string | null
  ref_id: string | null
  created_at: string
}

export default function AdminCreditsPage() {
  const supabase = createClient()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<UserRow | null>(null)
  const [txs, setTxs] = useState<TxRow[]>([])
  const [txLoading, setTxLoading] = useState(false)
  const [grantAmount, setGrantAmount] = useState('')
  const [grantDesc, setGrantDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, role')
      .neq('role', 'admin')
      .order('created_at', { ascending: false })

    const { data: privs } = await supabase
      .from('user_private')
      .select('user_id, email')

    const { data: balances } = await supabase
      .from('credit_balances')
      .select('user_id, balance')

    const privMap = Object.fromEntries((privs ?? []).map(p => [p.user_id, p.email]))
    const balMap = Object.fromEntries((balances ?? []).map(b => [b.user_id, b.balance]))

    const rows: UserRow[] = (profiles ?? []).map(p => ({
      id: p.id,
      name: p.name,
      email: privMap[p.id] ?? '',
      role: p.role,
      balance: balMap[p.id] ?? 0,
    }))

    setUsers(rows)
    setLoading(false)
  }

  const openUser = async (user: UserRow) => {
    setSelected(user)
    setMsg('')
    setGrantAmount('')
    setGrantDesc('')
    setTxLoading(true)
    const { data } = await supabase
      .from('credit_ledger')
      .select('id, delta, reason_code, memo, ref_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setTxs(((data ?? []) as RawLedgerRow[]).map(row => ({
      id: row.id,
      amount: row.delta,
      action: row.reason_code,
      description: row.memo,
      reference_id: row.ref_id,
      created_at: row.created_at,
    })))
    setTxLoading(false)
  }

  const handleSubmit = async () => {
    if (!selected || !grantAmount) return
    const amount = parseInt(grantAmount, 10)
    if (isNaN(amount) || amount === 0) return

    setSubmitting(true)
    setMsg('')
    const res = await fetch('/api/credits/admin-grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: selected.id, amount, description: grantDesc }),
    })
    const json = await res.json()
    if (!res.ok) {
      setMsg(`오류: ${json.error}`)
    } else {
      const updated = { ...selected, balance: selected.balance + amount }
      setSelected(updated)
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
      setMsg(amount > 0 ? `${amount.toLocaleString()} C 지급 완료` : `${Math.abs(amount).toLocaleString()} C 차감 완료`)
      setGrantAmount('')
      setGrantDesc('')
      await openUser(updated)
    }
    setSubmitting(false)
  }

  const filtered = users.filter(u =>
    !search || u.name.includes(search) || u.email.includes(search)
  )

  const fmtAction = (action: string) => CREDIT_ACTION_LABELS[action] ?? action
  const fmtAmt = (amount: bigint | number) => {
    const n = Number(amount)
    return n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString()
  }
  const amtColor = (amount: bigint | number) => Number(amount) > 0 ? 'text-emerald-600' : 'text-red-500'

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center mb-8">
        <Link href="/admin/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">← 뒤로</Link>
        <h1 className="text-xl font-bold text-gray-900">크레딧 관리</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-6">
        {/* 좌: 유저 목록 */}
        <div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름·이메일 검색"
            className="w-full mb-4 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-amber-400"
          />

          {loading && <p className="text-center text-gray-400 py-16">불러오는 중...</p>}

          <div className="space-y-2">
            {filtered.map(user => (
              <button
                key={user.id}
                onClick={() => openUser(user)}
                className={`w-full text-left bg-white rounded-xl px-4 py-3.5 shadow-sm border transition ${
                  selected?.id === user.id ? 'border-amber-400' : 'border-transparent hover:border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 font-bold text-sm flex items-center justify-center">
                      {user.name?.[0] ?? '?'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{user.name}</p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-extrabold text-gray-900">{user.balance.toLocaleString()} <span className="text-amber-500 text-xs">C</span></p>
                    <p className="text-[11px] text-gray-400">{user.role === 'influencer' ? '인플루언서' : '광고주'}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 우: 선택된 유저 상세 */}
        <div>
          {!selected ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm text-center text-gray-400 text-sm">
              왼쪽에서 회원을 선택하면<br />크레딧 이력과 지급/차감 기능이 표시됩니다
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* 유저 헤더 */}
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900">{selected.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{selected.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">보유 크레딧</p>
                    <p className="text-xl font-extrabold text-gray-900 tracking-tight">
                      {selected.balance.toLocaleString()}
                      <span className="text-amber-500 text-sm ml-1">C</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* 지급/차감 폼 */}
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 mb-3">크레딧 지급 · 차감</p>
                <div className="flex gap-2 mb-2">
                  <input
                    type="number"
                    value={grantAmount}
                    onChange={e => setGrantAmount(e.target.value)}
                    placeholder="양수=지급, 음수=차감"
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !grantAmount}
                    className="px-4 py-2 text-sm font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 transition"
                  >
                    {submitting ? '처리 중' : '실행'}
                  </button>
                </div>
                <input
                  value={grantDesc}
                  onChange={e => setGrantDesc(e.target.value)}
                  placeholder="사유 (선택)"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-amber-400"
                />
                {msg && (
                  <p className={`mt-2 text-xs font-medium ${msg.startsWith('오류') ? 'text-red-500' : 'text-emerald-600'}`}>
                    {msg}
                  </p>
                )}
              </div>

              {/* 이력 */}
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-gray-500 mb-3">최근 거래 이력</p>
                {txLoading && <p className="text-xs text-gray-400 py-4 text-center">불러오는 중...</p>}
                {!txLoading && txs.length === 0 && (
                  <p className="text-xs text-gray-400 py-4 text-center">이력이 없어요</p>
                )}
                <div className="space-y-2.5">
                  {txs.map(tx => (
                    <div key={tx.id} className="flex items-start justify-between text-sm">
                      <div>
                        <p className="text-gray-700 font-medium">{tx.description || fmtAction(tx.action)}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {fmtAction(tx.action)} · {new Date(tx.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className={`font-bold text-sm shrink-0 ml-3 ${amtColor(tx.amount)}`}>
                        {fmtAmt(tx.amount)} C
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
