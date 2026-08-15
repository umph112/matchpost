'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { CREDIT_POLICY } from '@/lib/creditConfig'

const STATUS_LABEL: Record<string, string> = { once: '1회', active: '활성', beta_free: '베타 무료' }
const STATUS_STYLE: Record<string, string> = {
  once: 'bg-gray-100 text-gray-500',
  active: 'bg-green-100 text-green-600',
  beta_free: 'bg-amber-100 text-amber-600',
}

// D6 E1/D5 — 카탈로그(D1)를 표로 보여주고, 값 변경 예고를 기록한다.
// ⚠️ 실제 지급/차감 금액은 src/lib/creditConfig.ts(코드 배포)가 원본이다 — 여기서 "예고"를
// 남겨도 자동으로 반영되지 않는다. 시행일에 코드도 같이 바꿔야 한다.
export default function AdminCreditPolicyPage() {
  const [changes, setChanges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<{ key: string; newAmount: string; effectiveAt: string; note: string } | null>(null)
  const supabase = createClient()

  const load = async () => {
    const { data } = await supabase.from('credit_policy_changes').select('*').order('created_at', { ascending: false })
    setChanges(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const submitChange = async () => {
    if (!form) return
    const current = CREDIT_POLICY.find((p) => p.key === form.key)
    if (!current || !form.newAmount || !form.effectiveAt) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('credit_policy_changes').insert({
      key: form.key,
      old_amount: current.amount,
      new_amount: parseInt(form.newAmount),
      announced_at: new Date().toISOString().slice(0, 10),
      effective_at: form.effectiveAt,
      note: form.note || null,
      created_by: user?.id ?? null,
    })
    setForm(null)
    load()
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center mb-8">
        <Link href="/admin/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">← 뒤로</Link>
        <h1 className="text-xl font-bold text-gray-900">크레딧 정책</h1>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-xs text-amber-700 leading-relaxed">
        값 변경은 시행 30일 전 공지 + 유예 기간 후 시행하고, 진행 중인 협업에는 소급하지 않아요.
        여기 "변경 예고"는 공지 기록일 뿐 — 실제 금액은 시행일에 코드 배포로 바꿔야 반영돼요.
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="grid grid-cols-[1fr_100px_90px_100px_90px] gap-2 px-4 py-2.5 bg-gray-50 text-[11px] font-bold text-gray-400">
          <span>항목</span><span>방향</span><span className="text-right">금액</span><span>상태</span><span></span>
        </div>
        {CREDIT_POLICY.map((p) => (
          <div key={p.key} className="grid grid-cols-[1fr_100px_90px_100px_90px] gap-2 px-4 py-3 items-center border-t border-gray-50 text-sm">
            <span className="font-medium text-gray-800">{p.label}</span>
            <span className={p.dir === 'grant' ? 'text-green-600 text-xs font-semibold' : 'text-red-500 text-xs font-semibold'}>
              {p.dir === 'grant' ? '지급' : '차감'}
            </span>
            <span className="text-right font-semibold tabular-nums">{p.amount.toLocaleString()}C</span>
            <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full w-fit ${STATUS_STYLE[p.status]}`}>
              {STATUS_LABEL[p.status]}
            </span>
            <button
              onClick={() => setForm({ key: p.key, newAmount: String(p.amount), effectiveAt: '', note: '' })}
              className="text-xs text-amber-600 hover:underline text-right"
            >
              변경 예고
            </button>
          </div>
        ))}
      </div>

      {form && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(23,23,27,0.45)] px-4" onClick={() => setForm(null)}>
          <div className="bg-white rounded-2xl w-full max-w-[400px] p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-gray-900 mb-3">{CREDIT_POLICY.find((p) => p.key === form.key)?.label} 변경 예고</p>
            <label className="text-xs font-semibold text-gray-500">새 금액</label>
            <input type="number" value={form.newAmount} onChange={(e) => setForm({ ...form, newAmount: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 mt-1" />
            <label className="text-xs font-semibold text-gray-500">시행일 (오늘로부터 30일 이후 권장)</label>
            <input type="date" value={form.effectiveAt} onChange={(e) => setForm({ ...form, effectiveAt: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 mt-1" />
            <label className="text-xs font-semibold text-gray-500">메모</label>
            <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 mt-1 resize-none" />
            <div className="flex gap-2">
              <button onClick={() => setForm(null)} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-500">취소</button>
              <button onClick={submitChange} className="flex-1 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold">기록</button>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-sm font-bold text-gray-700 mb-3">변경 이력</h2>
      {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}
      {!loading && changes.length === 0 && <p className="text-sm text-gray-400">아직 변경 예고가 없어요.</p>}
      <div className="space-y-2">
        {changes.map((c) => (
          <div key={c.id} className="bg-white rounded-xl p-3.5 shadow-sm text-sm">
            <p className="font-medium text-gray-800">
              {CREDIT_POLICY.find((p) => p.key === c.key)?.label ?? c.key}: {c.old_amount?.toLocaleString()}C → {c.new_amount.toLocaleString()}C
            </p>
            <p className="text-xs text-gray-400 mt-0.5">공지 {c.announced_at} · 시행 {c.effective_at}{c.note && ` · ${c.note}`}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
