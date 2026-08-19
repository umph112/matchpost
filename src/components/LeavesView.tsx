'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { requestLeave, approveLeave, rejectLeave, replyLeave } from '@/lib/team/leaves'

// D14 4절 휴무·대행 — 목업 leave-request.dc.html 값 그대로. 역할(대표/팀원)은 서버가 정한다(미리보기 토글 제거).

export type LeaveNote = { who: string; at: string; text: string; mine: boolean }
export type LeaveLite = {
  id: string
  memberId: string
  memberName: string
  fromDate: string // 'YYYY-MM-DD'
  toDate: string
  kind: string
  reason: string | null
  status: string // pending | rejected | replied | approved | done
  substituteName: string | null
  notes: LeaveNote[]
}
export type Clash = { at: string; what: string }
export type SubCand = { id: string; name: string; load: string; heavy: boolean }
export type PendingItem = {
  leave: LeaveLite
  clashN: number
  clashText: string
  subs: SubCand[]
}
export type DatedItem = { day: number; what: string }

const KINDS = ['연차', '반차', '병가', '기타']
const DOWS = ['일', '월', '화', '수', '목', '금', '토']

const pad = (n: number) => String(n).padStart(2, '0')
const initialOf = (n: string) => ((n.trim().split(/\s+/).pop() ?? n)[0] ?? '')

export default function LeavesView(props: {
  isOwner: boolean
  year: number
  month: number // 1-12
  todayDay: number // 0 if the visible month isn't the current one
  monthLabel: string
  myName: string
  approved: LeaveLite[]
  myOpen: LeaveLite | null
  myDated: DatedItem[]
  myWaiting: number
  pending: PendingItem[]
}) {
  const { isOwner, year, month, todayDay, monthLabel, myName, approved, myOpen, myDated, myWaiting, pending } = props
  const isMember = !isOwner
  const router = useRouter()
  const [busy, startTransition] = useTransition()

  const dim = new Date(year, month, 0).getDate()
  const lead = new Date(year, month - 1, 1).getDay()
  const monthStart = `${year}-${pad(month)}-01`
  const dstr = (d: number) => `${year}-${pad(month)}-${pad(d)}`

  // 신청 폼 상태 — 신규일 때만 편집 가능. 이미 신청/반려/답한 건은 그 값을 보여준다.
  const stage: 'new' | 'pending' | 'rejected' | 'replied' = myOpen
    ? (myOpen.status as 'pending' | 'rejected' | 'replied')
    : 'new'
  const editable = stage === 'new'

  const clampDay = (s: string, fallback: number) => {
    const [y, m, d] = s.split('-').map(Number)
    if (y === year && m === month) return d
    return s < monthStart ? 1 : fallback
  }
  const initLo = myOpen ? clampDay(myOpen.fromDate, 1) : 21
  const initHi = myOpen ? clampDay(myOpen.toDate, dim) : 21

  const [a, setA] = useState(initLo)
  const [b, setB] = useState(initHi)
  const [kind, setKind] = useState(myOpen?.kind ?? '연차')
  const [reason, setReason] = useState('')
  const [reply, setReply] = useState('')

  // 대표 상태
  const [subById, setSubById] = useState<Record<string, string>>({})
  const [reject, setReject] = useState<{ leaveId: string; memo: string } | null>(null)

  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const pickLo = editable ? lo : clampDay(myOpen!.fromDate, 1)
  const pickHi = editable ? hi : clampDay(myOpen!.toDate, dim)

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) alert(r.error)
      else router.refresh()
    })

  // ── 달력 셀 ──
  type Cell = { key: string; empty?: boolean; num: string; inPick?: boolean; appr?: LeaveLite; isToday?: boolean; d?: number }
  const cells: Cell[] = []
  for (let i = 0; i < lead; i++) cells.push({ key: `e${i}`, empty: true, num: '' })
  for (let d = 1; d <= dim; d++) {
    const s = dstr(d)
    const inPick = isMember && d >= pickLo && d <= pickHi
    const appr = approved.find((x) => s >= x.fromDate && s <= x.toDate)
    cells.push({ key: `d${d}`, num: String(d), d, inPick, appr, isToday: d === todayDay })
  }
  while (cells.length % 7) cells.push({ key: `t${cells.length}`, empty: true, num: '' })

  const onCell = (d: number) => {
    if (!editable) return
    // 한 번 누르면 하루, 이미 하루 고른 상태에서 다른 날을 누르면 그 사이 기간
    if (a === b && a !== d) setB(d)
    else {
      setA(d)
      setB(d)
    }
  }

  const rangeLabel = (fromD: number, toD: number) =>
    fromD === toD ? `${month}월 ${fromD}일 (하루)` : `${month}월 ${fromD}일 – ${toD}일 (${toD - fromD + 1}일)`
  const pickedLabel = editable
    ? rangeLabel(lo, hi)
    : rangeLabel(clampDay(myOpen!.fromDate, 1), clampDay(myOpen!.toDate, dim))

  // 내 신청 기간에 걸린 일 (신규는 고른 범위, 신청건은 그 범위)
  const clashItems: Clash[] = myDated
    .filter((x) => x.day >= pickLo && x.day <= pickHi)
    .map((x) => ({ at: `${month}/${x.day}`, what: x.what }))
  if (myWaiting > 0) clashItems.push({ at: '지금', what: `미응답 대화 ${myWaiting}건` })
  const hasClash = clashItems.length > 0

  const submit = () =>
    run(() => requestLeave({ fromDate: dstr(lo), toDate: dstr(hi), kind, reason }))
  const sendReply = () => myOpen && run(() => replyLeave(myOpen.id, reply))

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1180 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.03em' }}>
              {isOwner ? '휴무 관리' : '내 휴무'}
            </h1>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                borderRadius: 5,
                padding: '3px 7px',
                ...(isOwner ? { background: '#17171B', color: '#fff' } : { background: '#F1F1F4', color: '#5C5C68' }),
              }}
            >
              {isOwner ? '대표만 보임' : myName}
            </span>
          </div>
          <p style={{ margin: '5px 0 0', fontSize: 13, color: '#7C7C88' }}>
            {isOwner
              ? '수락하면서 대행자를 지정해요. 대행은 이관이 아니라 휴무 기간 동안만 돕는 것입니다.'
              : '날짜를 눌러 고르고 신청하세요. 휴무 중에도 원하면 본인이 직접 처리할 수 있습니다.'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 14, alignItems: 'start' }}>
        {/* 달력 */}
        <div style={{ background: '#fff', border: '1px solid #EAEAEE', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid #F1F1F4' }}>
            <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em' }}>{monthLabel}</h2>
            <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#9A9AA5' }}>
              {isOwner ? '팀 전체 휴무가 함께 보여요' : '두 번 눌러 기간을 고르세요'}
            </span>
          </div>
          <div style={{ padding: '16px 20px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
              {DOWS.map((d) => (
                <span key={d} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: '#B0B0BB', padding: '3px 0' }}>
                  {d}
                </span>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
              {cells.map((c) => {
                if (c.empty) return <div key={c.key} style={{ aspectRatio: '1' }} />
                const bg = c.inPick ? '#FFFBEB' : c.appr ? '#EFF6FF' : c.isToday ? '#F1F1F4' : 'transparent'
                const bd = c.inPick ? '1.5px dashed #F59E0B' : c.appr ? '1.5px solid #93C5FD' : '1px solid transparent'
                const numColor = c.inPick ? '#B45309' : c.appr ? '#1D4ED8' : c.isToday ? '#17171B' : '#9A9AA5'
                const numWeight = c.inPick || c.appr || c.isToday ? 700 : 500
                return (
                  <div
                    key={c.key}
                    onClick={c.d ? () => onCell(c.d!) : undefined}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 9,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      cursor: editable ? 'pointer' : 'default',
                      background: bg,
                      border: bd,
                    }}
                  >
                    <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', fontWeight: numWeight, color: numColor }}>
                      {c.num}
                    </span>
                    {c.appr && (
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#1D4ED8', lineHeight: 1 }}>
                        {initialOf(c.appr.memberName)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14, paddingTop: 13, borderTop: '1px solid #F1F1F4' }}>
              {[
                { label: '신청하려는 날', bg: '#FFFBEB', bd: '1.5px dashed #F59E0B' },
                { label: '수락된 휴무', bg: '#EFF6FF', bd: '1.5px solid #93C5FD' },
                { label: '오늘', bg: '#F1F1F4', bd: '1px solid #EAEAEE' },
              ].map((l) => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 4, display: 'block', flexShrink: 0, background: l.bg, border: l.bd }} />
                  <span style={{ fontSize: 11, color: '#7C7C88' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 오른쪽 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {/* 팀원 신청 카드 */}
          {isMember && (
            <div style={{ background: '#fff', border: '1px solid #EAEAEE', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ height: 46, display: 'flex', alignItems: 'center', padding: '0 18px', borderBottom: '1px solid #F1F1F4' }}>
                <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em' }}>휴무 신청</h2>
              </div>
              <div style={{ padding: '15px 18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#3C3C46' }}>고른 날짜</div>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.025em', marginTop: 6, color: '#17171B', fontVariantNumeric: 'tabular-nums' }}>
                    {pickedLabel}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#3C3C46', marginBottom: 7 }}>종류</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {KINDS.map((k) => {
                      const on = kind === k
                      return (
                        <div
                          key={k}
                          onClick={editable ? () => setKind(k) : undefined}
                          style={{
                            height: 32,
                            padding: '0 13px',
                            borderRadius: 8,
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            cursor: editable ? 'pointer' : 'default',
                            fontWeight: on ? 700 : 600,
                            background: on ? '#17171B' : '#F6F6F7',
                            color: on ? '#fff' : '#5C5C68',
                          }}
                        >
                          {k}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {editable && (
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#3C3C46' }}>
                      한 줄 사유 <span style={{ fontWeight: 600, color: '#B0B0BB' }}>선택</span>
                    </div>
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="예: 가족 여행"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        height: 44,
                        border: '1px solid #E2E2E8',
                        borderRadius: 10,
                        padding: '0 12px',
                        marginTop: 7,
                        fontSize: 12.5,
                        fontFamily: 'inherit',
                        color: '#17171B',
                        outline: 'none',
                      }}
                    />
                  </div>
                )}

                {hasClash && (
                  <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 13px' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#B45309' }}>이 기간에 걸린 일</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                      {clashItems.map((c, i) => (
                        <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'baseline' }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#B45309', width: 38, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            {c.at}
                          </span>
                          <span style={{ fontSize: 11.5, color: '#92400E', lineHeight: 1.55, minWidth: 0 }}>{c.what}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: '#B45309', lineHeight: 1.6, marginTop: 9 }}>
                      대표가 수락하면 대행자가 지정됩니다. 휴무 중에도 원하면 본인이 직접 처리할 수 있습니다.
                    </div>
                  </div>
                )}

                {/* 반려/답변 스레드 */}
                {myOpen && stage !== 'pending' && myOpen.notes.length > 0 && (
                  <div style={{ borderTop: '1px solid #F1F1F4', paddingTop: 14 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#3C3C46' }}>대표 메모</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      {myOpen.notes.map((t, i) => (
                        <Thread key={i} t={t} />
                      ))}
                    </div>
                    {stage === 'rejected' && (
                      <>
                        <input
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          placeholder="어떻게 할 계획인지 적어주세요"
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            height: 44,
                            border: '1px solid #E2E2E8',
                            borderRadius: 10,
                            padding: '0 12px',
                            marginTop: 10,
                            fontSize: 12.5,
                            fontFamily: 'inherit',
                            color: '#17171B',
                            outline: 'none',
                          }}
                        />
                        <div
                          onClick={reply.trim() && !busy ? sendReply : undefined}
                          style={{
                            minHeight: 44,
                            borderRadius: 11,
                            fontSize: 13,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: 10,
                            ...(reply.trim()
                              ? { background: '#17171B', color: '#fff', cursor: 'pointer' }
                              : { background: '#EAEAEE', color: '#B0B0BB' }),
                          }}
                        >
                          답하고 다시 올리기
                        </div>
                      </>
                    )}
                    {stage === 'replied' && (
                      <div style={{ fontSize: 11, color: '#9A9AA5', lineHeight: 1.6, marginTop: 9 }}>
                        답을 보냈어요. 대표가 다시 판단합니다.
                      </div>
                    )}
                  </div>
                )}

                {/* 신청 버튼 (신규/대기) */}
                {(stage === 'new' || stage === 'pending') && (
                  <div
                    onClick={stage === 'new' && !busy ? submit : undefined}
                    style={{
                      minHeight: 46,
                      borderRadius: 11,
                      fontSize: 13.5,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...(stage === 'new'
                        ? { background: '#F59E0B', color: '#17171B', cursor: 'pointer' }
                        : { background: '#F1F1F4', color: '#7C7C88' }),
                    }}
                  >
                    {stage === 'new' ? '휴무 신청' : '신청했어요 · 수락 대기'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 대표 수락 카드 */}
          {isOwner && pending.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #FDE68A', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ height: 46, display: 'flex', alignItems: 'center', padding: '0 18px', borderBottom: '1px solid #FDE68A', background: '#FFFBEB' }}>
                <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em', color: '#92400E' }}>
                  수락 대기 {pending.length}건
                </h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {pending.map((p) => {
                  const L = p.leave
                  const st = L.status
                  const selSub = subById[L.id] ?? null
                  const canOk = p.clashN === 0 || !!selSub
                  return (
                    <div key={L.id} style={{ padding: '15px 18px', borderBottom: '1px solid #F5F5F7' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#FEF3C7', color: '#B45309', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {initialOf(L.memberName)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{L.memberName}</div>
                          <div style={{ fontSize: 11, color: '#9A9AA5', marginTop: 2 }}>{whenLabel(L)}</div>
                        </div>
                        <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, background: '#F1F1F4', color: '#5C5C68', borderRadius: 4, padding: '2px 7px', flexShrink: 0 }}>
                          {L.kind}
                        </span>
                      </div>
                      {L.reason && (
                        <div style={{ fontSize: 11.5, color: '#7C7C88', lineHeight: 1.6, marginTop: 8 }}>{L.reason}</div>
                      )}

                      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 9, padding: '10px 12px', marginTop: 10 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: '#B45309' }}>이 기간에 걸린 일 {p.clashN}건</div>
                        <div style={{ fontSize: 11, color: '#92400E', lineHeight: 1.6, marginTop: 5 }}>
                          {p.clashText || '걸린 일이 없어요.'}
                        </div>
                      </div>

                      {/* 오간 메모 */}
                      {st !== 'pending' && L.notes.length > 0 && (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 11 }}>
                            {L.notes.map((t, i) => (
                              <Thread key={i} t={t} />
                            ))}
                          </div>
                          {st === 'rejected' && (
                            <div style={{ fontSize: 11, color: '#9A9AA5', lineHeight: 1.6, marginTop: 9 }}>
                              {L.memberName}님의 답을 기다리는 중이에요. 답이 오면 다시 판단할 수 있습니다.
                            </div>
                          )}
                        </>
                      )}

                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#3C3C46', marginBottom: 7 }}>
                          대행자 지정 <span style={{ color: '#DC2626' }}>필수</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {p.subs.map((s) => {
                            const on = selSub === s.id
                            return (
                              <div
                                key={s.id}
                                onClick={() => setSubById((m) => ({ ...m, [L.id]: s.id }))}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 9,
                                  height: 46,
                                  padding: '0 13px',
                                  borderRadius: 10,
                                  cursor: 'pointer',
                                  border: `1px solid ${on ? '#F59E0B' : '#E2E2E8'}`,
                                  background: on ? '#FFFBEB' : '#fff',
                                }}
                              >
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#17171B' }}>{s.name}</span>
                                <span
                                  style={{
                                    marginLeft: 'auto',
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    borderRadius: 4,
                                    padding: '2px 7px',
                                    flexShrink: 0,
                                    ...(s.heavy ? { background: '#FEF3C7', color: '#B45309' } : { background: '#F1F1F4', color: '#7C7C88' }),
                                  }}
                                >
                                  {s.load}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                        <div style={{ fontSize: 11, color: '#9A9AA5', lineHeight: 1.6, marginTop: 8 }}>
                          대행은 이관이 아니에요. 휴무 기간에만 그 대화에 들어가고 끝나면 자동으로 빠집니다.
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 7, marginTop: 13 }}>
                        <div
                          onClick={busy ? undefined : () => setReject({ leaveId: L.id, memo: '' })}
                          style={{ minWidth: 96, height: 42, borderRadius: 10, border: '1px solid #E2E2E8', color: '#5C5C68', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                        >
                          {st === 'pending' ? '반려하고 묻기' : '다시 묻기'}
                        </div>
                        <div
                          onClick={canOk && !busy ? () => run(() => approveLeave(L.id, selSub)) : undefined}
                          style={{
                            flex: 1,
                            height: 42,
                            borderRadius: 10,
                            fontSize: 12.5,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            ...(canOk ? { background: '#17171B', color: '#fff', cursor: 'pointer' } : { background: '#EAEAEE', color: '#B0B0BB' }),
                          }}
                        >
                          {canOk ? '수락하고 대행 시작' : '대행자를 골라주세요'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 목록 */}
          <div style={{ background: '#fff', border: '1px solid #EAEAEE', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ height: 46, display: 'flex', alignItems: 'center', padding: '0 18px', borderBottom: '1px solid #F1F1F4' }}>
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em' }}>
                {isOwner ? '수락된 휴무' : '팀 휴무 일정'}
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {approved.length === 0 && (
                <div style={{ padding: '18px', fontSize: 12, color: '#9A9AA5' }}>이번 달 수락된 휴무가 없어요.</div>
              )}
              {approved.map((x) => (
                <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderBottom: '1px solid #F5F5F7' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', flexShrink: 0, display: 'block' }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.memberName}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#DCFCE7', color: '#15803D', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>
                        수락됨
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#9A9AA5', marginTop: 3 }}>{whenLabel(x)} · {x.kind}</div>
                    {x.substituteName && (
                      <div style={{ fontSize: 11, color: '#B45309', marginTop: 3 }}>대행 {x.substituteName} — 기간이 끝나면 자동으로 빠져요</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '11px 18px', fontSize: 11, color: '#9A9AA5', lineHeight: 1.65, borderTop: '1px solid #F1F1F4' }}>
              {isOwner
                ? '휴무는 회사 캘린더와 대시보드에도 표시돼요. 일정을 잡을 때 누가 없는지 보입니다.'
                : '팀원 휴무도 함께 보여요. 겹치지 않게 고르면 대행자를 찾기 쉬워집니다.'}
            </div>
          </div>
        </div>
      </div>

      {/* 반려 모달 */}
      {reject && (
        <div
          onClick={() => setReject(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(23,23,27,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, zIndex: 60 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '100%', background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.22)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '17px 20px', borderBottom: '1px solid #F1F1F4' }}>
              <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, letterSpacing: '-0.025em' }}>무엇이 걸리는지 알려주세요</h2>
              <span style={{ marginLeft: 'auto', fontSize: 17, color: '#B0B0BB', cursor: 'pointer' }} onClick={() => setReject(null)}>
                ✕
              </span>
            </div>
            <div style={{ padding: '16px 20px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div style={{ background: '#FBFBFC', border: '1px solid #EFEFF2', borderRadius: 10, padding: '12px 13px', fontSize: 11.5, color: '#5C5C68', lineHeight: 1.65 }}>
                반려는 거절이 아니라 <strong style={{ fontWeight: 700, color: '#3C3C46' }}>질문</strong>이에요. 신청자가 답하면 다시 판단할 수 있습니다. 메모는 그대로 전달됩니다.
              </div>
              <textarea
                value={reject.memo}
                onChange={(e) => setReject({ ...reject, memo: e.target.value })}
                placeholder="예: 8/20 게재 마감 2건이 그 기간에 있어요. 그건 어떻게 할 계획인지 알려주세요."
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 96, border: '1px solid #E2E2E8', borderRadius: 10, padding: '11px 12px', fontSize: 12.5, fontFamily: 'inherit', color: '#17171B', lineHeight: 1.65, resize: 'none', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <div
                  onClick={() => setReject(null)}
                  style={{ minWidth: 92, minHeight: 44, borderRadius: 11, border: '1px solid #E2E2E8', color: '#5C5C68', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  취소
                </div>
                <div
                  onClick={
                    reject.memo.trim() && !busy
                      ? () => {
                          const { leaveId, memo } = reject
                          setReject(null)
                          run(() => rejectLeave(leaveId, memo))
                        }
                      : undefined
                  }
                  style={{
                    flex: 1.3,
                    minHeight: 44,
                    borderRadius: 11,
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...(reject.memo.trim() ? { background: '#DC2626', color: '#fff', cursor: 'pointer' } : { background: '#EAEAEE', color: '#B0B0BB' }),
                  }}
                >
                  보내기
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Thread({ t }: { t: LeaveNote }) {
  return (
    <div style={{ borderRadius: 10, padding: '11px 13px', ...(t.mine ? { background: '#F6F6F7' } : { background: '#FFFBEB', border: '1px solid #FDE68A' }) }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: t.mine ? '#5C5C68' : '#B45309' }}>{t.who}</span>
        <span style={{ fontSize: 10.5, color: '#B0B0BB', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{t.at}</span>
      </div>
      <div style={{ fontSize: 11.5, color: '#3C3C46', lineHeight: 1.6, marginTop: 5 }}>{t.text}</div>
    </div>
  )
}

function whenLabel(L: LeaveLite) {
  const f = L.fromDate.slice(5).split('-')
  const t = L.toDate.slice(5).split('-')
  const fm = Number(f[0]), fd = Number(f[1]), td = Number(t[1])
  if (L.fromDate === L.toDate) return `${fm}월 ${fd}일`
  const tm = Number(t[0])
  return tm === fm ? `${fm}월 ${fd}일 – ${td}일` : `${fm}월 ${fd}일 – ${tm}월 ${td}일`
}
