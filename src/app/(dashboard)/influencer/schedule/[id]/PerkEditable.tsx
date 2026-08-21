'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// 「서비스 제공」을 「저녁 2인 · 음료 포함」처럼 실제 받은 대로 고친다.
// 금액(budget)은 합의된 값이라 여기서 바꾸지 않는다 — 대시에서만 바뀐다.
export default function PerkEditable({
  proposalId,
  userId,
  perk,
  variant,
}: {
  proposalId: string
  userId: string
  perk: string | null
  variant: 'only' | 'plus'
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(perk ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const label = variant === 'plus' ? `+ ${perk ?? ''}` : (perk ?? '제공')

  const save = async () => {
    if (saving) return
    if ((value.trim() || null) === (perk ?? null)) { setEditing(false); return }
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('set_proposal_perk', {
      p_proposal_id: proposalId,
      p_by_id: userId,
      p_perk: value.trim(),
    })
    setSaving(false)
    if (rpcError) {
      setError('저장하지 못했어요. 잠시 후 다시 시도해주세요.')
      return
    }
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <span className="flex items-center gap-1.5 min-w-0">
        <input
          autoFocus
          value={value}
          disabled={saving}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') { setValue(perk ?? ''); setEditing(false); setError(null) }
          }}
          onBlur={save}
          placeholder="예: 저녁 2인 · 음료 포함"
          className="w-[168px] h-7 px-2 rounded-[7px] border border-[#93C5FD] text-[12px] text-[#17171B] outline-none focus:border-[#1D4ED8]"
        />
        {error && <span className="text-[10.5px] text-[#B45309] whitespace-nowrap">{error}</span>}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="눌러서 실제 받은 대로 고칠 수 있어요"
      className={`flex-shrink-0 whitespace-nowrap text-[13px] font-extrabold tracking-[-0.02em] text-[#1D4ED8] border-b border-dashed border-[#93C5FD] cursor-pointer bg-transparent p-0 ${
        variant === 'plus' ? 'font-bold text-[12px]' : ''
      }`}
    >
      {label}
    </button>
  )
}
