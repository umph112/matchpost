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
  const [contact, setContact] = useState<{ name: string; phone: string; email: string } | null>(null)
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

  const done = proposal ? proposal.advertiser_confirmed && proposal.influencer_confirmed : false

  // 양쪽 확정 완료 시 상대 연락처 공개 (서버 라우트가 당사자·확정 여부 재검증)
  useEffect(() => {
    if (!done) {
      setContact(null)
      return
    }
    let alive = true
    fetch('/api/deal/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data && !data.error) setContact(data)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, proposalId])

  if (!proposal) return null

  const isAdvertiser = currentUserId === proposal.advertiser_id
  const myConfirmed = isAdvertiser ? proposal.advertiser_confirmed : proposal.influencer_confirmed
  const otherConfirmed = isAdvertiser ? proposal.influencer_confirmed : proposal.advertiser_confirmed

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

      {done && contact && (contact.phone || contact.email) && (
        <div className="mt-3 pt-3 border-t border-green-200">
          <p className="text-[11px] text-gray-500 mb-1.5">
            협의가 완료되어 <span className="font-semibold text-gray-700">{contact.name}</span>님의 연락처가 공개됐어요
          </p>
          <div className="flex flex-wrap gap-2">
            {contact.phone && (
              <>
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-1 bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-600"
                >
                  📞 {contact.phone}
                </a>
                <a
                  href={`sms:${contact.phone}`}
                  className="flex items-center gap-1 bg-white text-green-700 border border-green-300 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-50"
                >
                  💬 문자
                </a>
              </>
            )}
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-1 bg-white text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                ✉️ {contact.email}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
