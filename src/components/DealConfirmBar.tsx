'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { acceptCancellation, withdrawCancellation } from '@/lib/cancellations/actions'
import { setProposalTime } from '@/lib/deals/time'

type PendingCancellation = {
  id: string
  by_id: string
  reason: string
  message: string | null
  created_at: string
}

function timeLeft(createdAt: string) {
  const deadline = new Date(createdAt).getTime() + 3 * 24 * 60 * 60 * 1000
  const diffMs = deadline - Date.now()
  if (diffMs <= 0) return '곧 자동 확정돼요'
  const h = Math.floor(diffMs / (60 * 60 * 1000))
  if (h < 1) return '1시간 이내 자동 확정'
  if (h < 24) return `${h}시간 후 자동 확정`
  return `${Math.floor(h / 24)}일 후 자동 확정`
}

// 협업 확정 바 — 4단계:
// 1. 협의중: 둘 다 false
// 2. 내 확정 대기: 상대만 true
// 3. 상대 확정 대기: 나만 true
// 4. 양쪽 확정: 둘 다 true → 연락처 공개
// 확정 여부는 advertiser_confirmed / influencer_confirmed 플래그만 본다.
export default function DealConfirmBar({
  proposalId,
  currentUserId,
  onPrefill,
}: {
  proposalId: string
  currentUserId: string
  onPrefill?: (text: string) => void
}) {
  const [proposal, setProposal] = useState<any>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [contact, setContact] = useState<{ name: string; phone: string; email: string } | null>(null)
  const [errMsg, setErrMsg] = useState('')
  const [pendingCancel, setPendingCancel] = useState<PendingCancellation | null>(null)
  const [askInChat, setAskInChat] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [timeForm, setTimeForm] = useState(false)
  const [timeInput, setTimeInput] = useState('')
  const [durationInput, setDurationInput] = useState(60)
  const [timeBusy, setTimeBusy] = useState(false)
  const [timeErr, setTimeErr] = useState('')
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

  const loadCancellation = async () => {
    const { data } = await supabase
      .from('cancellations')
      .select('id, by_id, reason, message, created_at')
      .eq('deal_id', proposalId)
      .is('agreed', null)
      .maybeSingle()
    setPendingCancel(data ?? null)
  }

  useEffect(() => { load(); loadCancellation() }, [proposalId])

  const handleAcceptCancel = async () => {
    if (!pendingCancel) return
    setCancelBusy(true)
    setErrMsg('')
    const res = await acceptCancellation(pendingCancel.id)
    setCancelBusy(false)
    if (!res.ok) { setErrMsg(res.error); return }
    setPendingCancel(null)
  }

  const handleWithdrawCancel = async () => {
    if (!pendingCancel) return
    setCancelBusy(true)
    setErrMsg('')
    const res = await withdrawCancellation(pendingCancel.id)
    setCancelBusy(false)
    if (!res.ok) { setErrMsg(res.error); return }
    setPendingCancel(null)
  }

  const handleSetTime = async () => {
    if (!timeInput) { setTimeErr('시간을 선택해주세요.'); return }
    setTimeBusy(true)
    setTimeErr('')
    const res = await setProposalTime(proposalId, new Date(timeInput).toISOString(), durationInput)
    setTimeBusy(false)
    if (!res.ok) { setTimeErr(res.error); return }
    setTimeForm(false)
    await load()
  }

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

  // 상대가 취소를 요청했으면 확정 바가 취소 요청 바로 바뀐다
  if (pendingCancel && pendingCancel.by_id !== currentUserId) {
    return (
      <div className="rounded-xl p-3 mb-3 border bg-red-50 border-red-200">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-red-500 font-semibold">협업 취소 요청</p>
            <p className="text-sm font-semibold text-gray-800 truncate">{title}</p>
            <p className="text-[11px] text-gray-600 mt-0.5">
              사유: {pendingCancel.reason}
              {pendingCancel.message && ` — "${pendingCancel.message}"`}
            </p>
            <p className="text-[11px] text-red-400 mt-0.5">{timeLeft(pendingCancel.created_at)}</p>
          </div>
        </div>

        {errMsg && <p className="mt-2 text-[11px] text-red-500 font-medium">{errMsg}</p>}

        {askInChat ? (
          <p className="mt-3 text-[11px] text-gray-500">
            아래 대화로 사유를 물어보세요. 응답이 없으면 위 시한에 자동으로 취소가 확정돼요.
          </p>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleAcceptCancel}
              disabled={cancelBusy}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {cancelBusy ? '처리 중...' : '취소 요청 수락'}
            </button>
            <button
              onClick={() => setAskInChat(true)}
              className="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-lg hover:bg-white transition"
            >
              사유 물어보기(대화로)
            </button>
          </div>
        )}
      </div>
    )
  }

  // 내가 취소를 요청한 쪽이면 대기 상태 + 철회 버튼을 보여준다
  if (pendingCancel && pendingCancel.by_id === currentUserId) {
    return (
      <div className="rounded-xl p-3 mb-3 border bg-gray-50 border-gray-200">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-gray-500 font-semibold">취소 요청 보냄 · 상대 수락 대기</p>
            <p className="text-sm font-semibold text-gray-800 truncate">{title}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              사유: {pendingCancel.reason} · {timeLeft(pendingCancel.created_at)}
            </p>
          </div>
          <button
            onClick={handleWithdrawCancel}
            disabled={cancelBusy}
            className="shrink-0 text-[11px] text-gray-400 hover:text-red-500 underline disabled:opacity-50"
          >
            {cancelBusy ? '처리 중...' : '요청 철회'}
          </button>
        </div>
        {errMsg && <p className="mt-2 text-[11px] text-red-500 font-medium">{errMsg}</p>}
      </div>
    )
  }

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
          {!done && onPrefill && (
            <button
              onClick={() => onPrefill('협업 조건을 이렇게 바꾸고 싶어요 — ')}
              className="mt-1 text-[11px] text-[#B45309] hover:underline"
            >
              조건 수정 제안하기
            </button>
          )}
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
                {busy ? '처리 중...' : '내 수락 취소'}
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

      {/* 협업 시간 — 최소 60분, 설정된 시간끼리는 겹치면 확정이 막힌다 */}
      <div className="mt-2 pt-2 border-t border-black/5">
        {timeForm ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="datetime-local"
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              className="text-[12px] border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <select
              value={durationInput}
              onChange={(e) => setDurationInput(Number(e.target.value))}
              className="text-[12px] border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
            >
              {[60, 90, 120, 180, 240].map((m) => (
                <option key={m} value={m}>{m}분</option>
              ))}
            </select>
            <button
              onClick={handleSetTime}
              disabled={timeBusy}
              className="text-[12px] bg-[#17171B] text-white px-3 py-1 rounded-lg hover:bg-black disabled:opacity-50"
            >
              {timeBusy ? '저장 중...' : '저장'}
            </button>
            <button
              onClick={() => { setTimeForm(false); setTimeErr('') }}
              className="text-[12px] text-gray-400 hover:text-gray-600"
            >
              취소
            </button>
            {timeErr && <p className="w-full text-[11px] text-red-500">{timeErr}</p>}
          </div>
        ) : proposal.start_at ? (
          <p className="text-[11px] text-gray-500">
            협업 시간 {new Date(proposal.start_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {' '}· {proposal.duration_min ?? 60}분
            <button onClick={() => setTimeForm(true)} className="ml-1.5 text-[#B45309] hover:underline">변경</button>
          </p>
        ) : (
          <button onClick={() => setTimeForm(true)} className="text-[11px] text-gray-400 hover:text-[#B45309] hover:underline">
            협업 시간 설정 (대화로 합의한 시간을 입력하세요)
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
