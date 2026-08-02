'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// 협업 확정 바 — 4단계:
// 1. 협의중: 둘 다 false
// 2. 내 확정 대기: 상대만 true
// 3. 상대 확정 대기: 나만 true
// 4. 양쪽 확정: 둘 다 true → 연락처 공개
// 확정 여부는 advertiser_confirmed / influencer_confirmed 플래그만 본다.
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
  const [errMsg, setErrMsg] = useState('')
  const supabase = createClient()

  const load = async () => {
    const { data } = await supabase.from('proposals').select('*').eq('id', proposalId).single()
    if (!data) { setProposal(null); return }
    setProposal(data)
    if (data.campaign_id) {
      const { data: c } = await supabase.from('campaigns').select('title').eq('id', data.campaign_id).single()
      setTitle(c?.title ?? '캠페인')
    } else if (data.schedule_id) {
      const { data: s } = await supabase.from('schedules').select('title').eq('id', data.schedule_id).single()
      setTitle(s?.title ?? '오픈')
    }
  }

  useEffect(() => { load() }, [proposalId])

  const isAdvertiser = proposal ? currentUserId === proposal.advertiser_id : false
  const myConfirmed: boolean = proposal
    ? (isAdvertiser ? proposal.advertiser_confirmed : proposal.influencer_confirmed) ?? false
    : false
  const otherConfirmed: boolean = proposal
    ? (isAdvertiser ? proposal.influencer_confirmed : proposal.advertiser_confirmed) ?? false
    : false
  const done = myConfirmed && otherConfirmed

  // 양쪽 확정 시 연락처 공개, 철회 시 재비공개
  useEffect(() => {
    if (!done) { setContact(null); return }
    let alive = true
    fetch('/api/deal/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (alive && data && !data.error) setContact(data) })
    return () => { alive = false }
  }, [done, proposalId])

  if (!proposal) return null

  const toggle = async () => {
    setBusy(true)
    setErrMsg('')
    const res = await fetch('/api/deal/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId }),
    })
    if (!res.ok) {
      const json = await res.json()
      setErrMsg(json.error ?? '오류가 발생했어요.')
    } else {
      await load()
    }
    setBusy(false)
  }

  // 4단계 상태 레이블
  const stageLabel = done
    ? { text: '협업 확정', color: 'text-green-600' }
    : myConfirmed
    ? { text: '상대 확정 대기중', color: 'text-amber-600' }
    : otherConfirmed
    ? { text: '내 확정 필요', color: 'text-amber-600' }
    : { text: '협의중', color: 'text-gray-500' }

  return (
    <div className={`rounded-xl p-3 mb-3 border ${done ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-gray-500">{proposal.campaign_id ? '캠페인' : '오픈'} 협업</p>
          <p className="text-sm font-semibold text-gray-800 truncate">{title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[11px] text-gray-500">
              나 {myConfirmed ? '✅' : '⬜'} · 상대 {otherConfirmed ? '✅' : '⬜'}
            </p>
            <span className={`text-[11px] font-semibold ${stageLabel.color}`}>
              {stageLabel.text}
            </span>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1">
          {done ? (
            <>
              <span className="text-sm font-bold text-green-600">협업 확정 ✅</span>
              <button
                onClick={toggle}
                disabled={busy}
                className="text-[11px] text-gray-400 hover:text-red-500 underline disabled:opacity-50"
              >
                {busy ? '처리 중...' : '확정 철회'}
              </button>
            </>
          ) : myConfirmed ? (
            <>
              <span className="text-xs text-gray-500">상대 확정 대기중</span>
              <button
                onClick={toggle}
                disabled={busy}
                className="text-[11px] text-gray-400 hover:text-red-500 underline disabled:opacity-50"
              >
                {busy ? '처리 중...' : '철회'}
              </button>
            </>
          ) : (
            <button
              onClick={toggle}
              disabled={busy}
              className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
            >
              {busy ? '처리 중...' : otherConfirmed ? '협업 확정 ✓' : '협업 확정'}
            </button>
          )}
        </div>
      </div>

      {errMsg && (
        <p className="mt-2 text-[11px] text-red-500 font-medium">{errMsg}</p>
      )}

      {done && contact && (contact.phone || contact.email) && (
        <div className="mt-3 pt-3 border-t border-green-200">
          <p className="text-[11px] text-gray-500 mb-1.5">
            협의가 완료되어 <span className="font-semibold text-gray-700">{contact.name}</span>님의 연락처가 공개됐어요
          </p>
          <div className="flex flex-wrap gap-2">
            {contact.phone && (
              <>
                <a href={`tel:${contact.phone}`} className="flex items-center gap-1 bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-600">
                  📞 {contact.phone}
                </a>
                <a href={`sms:${contact.phone}`} className="flex items-center gap-1 bg-white text-green-700 border border-green-300 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-50">
                  💬 문자
                </a>
              </>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-1 bg-white text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50">
                ✉️ {contact.email}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
