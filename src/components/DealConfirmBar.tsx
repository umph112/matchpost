'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// 채팅 상단 협업 확정 바 — 광고주/인플루언서 각 1회 [협업 확정] → 둘 다 누르면 최종 확정
export default function DealConfirmBar({
  proposalId,
  currentUserId,
}: {
  proposalId: string
  currentUserId: string
}) {
  const [proposal, setProposal] = useState<any>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const supabase = createClient()

  const load = async () => {
    const { data } = await supabase.from('proposals').select('*').eq('id', proposalId).single()
    if (!data) {
      setProposal(null)
      return
    }
    setProposal(data)
    if (data.campaign_id) {
      const { data: c } = await supabase.from('campaigns').select('title').eq('id', data.campaign_id).single()
      setTitle(c?.title ?? '캠페인')
    } else if (data.schedule_id) {
      const { data: s } = await supabase.from('schedules').select('title').eq('id', data.schedule_id).single()
      setTitle(s?.title ?? '오픈')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId])

  if (!proposal) return null

  const isAdvertiser = currentUserId === proposal.advertiser_id
  const myConfirmed = isAdvertiser ? proposal.advertiser_confirmed : proposal.influencer_confirmed
  const otherConfirmed = isAdvertiser ? proposal.influencer_confirmed : proposal.advertiser_confirmed
  const done = proposal.advertiser_confirmed && proposal.influencer_confirmed

  const confirm = async () => {
    setBusy(true)
    await fetch('/api/deal/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId }),
    })
    await load()
    setBusy(false)
  }

  return (
    <div className={`rounded-xl p-3 mb-3 border ${done ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-gray-500">{proposal.campaign_id ? '캠페인' : '오픈'} 협업</p>
          <p className="text-sm font-semibold text-gray-800 truncate">{title}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            나 {myConfirmed ? '✅' : '⬜'} · 상대 {otherConfirmed ? '✅' : '⬜'}
          </p>
        </div>
        {done ? (
          <span className="shrink-0 text-sm font-bold text-green-600">협업 확정 ✅</span>
        ) : myConfirmed ? (
          <span className="shrink-0 text-xs text-gray-500 text-right">
            확인 완료<br />상대 대기중
          </span>
        ) : (
          <button
            onClick={confirm}
            disabled={busy}
            className="shrink-0 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
          >
            {busy ? '처리 중...' : '협업 확정'}
          </button>
        )}
      </div>
    </div>
  )
}
