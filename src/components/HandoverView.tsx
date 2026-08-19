'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { transferCampaign, transferConversation } from '@/lib/team/transfers'

// 퇴사 · 이관 — D14 5절 「이관내역 보기」(5-6). 세 역할이 같은 레이아웃을 보고 버튼 라벨만 다르다.
//   leaver   = 퇴사자 본인 (계정 살아 있음, 메모를 남기며 이관)
//   receiver = 받는 사람   (자기에게 이관)
//   owner    = 대표        (퇴사일 이후 대신 이관)
// 값은 목업(work-transfer.dc.html)에서 그대로 잰다. 캠페인 딸린 대화는 캠페인을 따라가 목록에 없다.
export type Role = 'leaver' | 'receiver' | 'owner'
export type Candidate = { id: string; name: string; isOwner: boolean }
export type CampItem = {
  id: string
  title: string
  stLabel: string // '진행중' | '완료'
  meta: string // '대화 N건 포함' | ''
  people: string // '확정 / 전체'
  period: string
  pay: string
  handover: string // 시스템 요약(어디까지)
}
export type ConvItem = { id: string; name: string; initial: string; when: string }
export type LogItem = { at: string; what: string }

const GRID = 'minmax(0,1fr) 96px 92px 128px 108px 116px'
const ST_C: Record<string, [string, string]> = {
  진행중: ['#FEF3C7', '#B45309'],
  완료: ['#DCFCE7', '#15803D'],
}

export default function HandoverView({
  role,
  myId,
  leaverName,
  leaveOn,
  dueLabel,
  ownerId,
  candidates,
  camps,
  convos,
  log,
}: {
  role: Role
  myId: string
  leaverName: string
  leaveOn: string | null
  dueLabel: string | null
  ownerId: string
  candidates: Candidate[]
  camps: CampItem[]
  convos: ConvItem[]
  log: LogItem[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [logOpen, setLogOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null) // 열려 있는 캠페인 받는사람 선택 패널
  const [pick, setPick] = useState<Record<string, string>>({}) // campId → 받는사람 id
  const [memo, setMemo] = useState<Record<string, string>>({}) // campId → 인수인계 메모
  const firstCand = candidates[0]?.id ?? ''
  const [allPick, setAllPick] = useState<string>(firstCand) // 한 번에 이관 시 받는사람

  const isLeaver = role === 'leaver'
  const isOwner = role === 'owner'
  const remaining = camps.length + convos.length
  const leaveOnLabel = leaveOn ? `${Number(leaveOn.slice(5, 7))}월 ${Number(leaveOn.slice(8, 10))}일` : ''

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError('')
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) setError(r.error)
      else router.refresh()
    })
  }

  // 캠페인 이관 — receiver 는 자기에게, leaver/owner 는 고른 사람에게(메모 포함).
  const takeCampaign = (c: CampItem) => {
    if (role === 'receiver') {
      run(() => transferCampaign(c.id, myId))
      return
    }
    const toId = pick[c.id] || firstCand
    if (!toId) { setError('받는 사람을 고를 팀원이 없어요.'); return }
    run(() => transferCampaign(c.id, toId, memo[c.id]))
    setOpenId(null)
  }

  // 개인 대화 → 항상 대표 보관.
  const takeConversation = (id: string) => run(() => transferConversation(id))

  // 남은 것 전부 — 캠페인은 receiver=자기 / leaver·owner=선택한 사람, 대화는 대표.
  const takeAll = () => {
    const toId = role === 'receiver' ? myId : allPick || firstCand
    if (!toId) { setError('받는 사람을 고를 팀원이 없어요.'); return }
    setError('')
    startTransition(async () => {
      for (const c of camps) {
        const r = await transferCampaign(c.id, toId)
        if (!r.ok) { setError(r.error); router.refresh(); return }
      }
      for (const v of convos) {
        const r = await transferConversation(v.id)
        if (!r.ok) { setError(r.error); router.refresh(); return }
      }
      router.refresh()
    })
  }

  const takeLabel = isLeaver ? '이관하기' : isOwner ? '대신 이관' : '나에게 이관'

  return (
    <main style={{ padding: '26px 28px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.03em' }}>
              {isLeaver ? '내 담당 인수인계' : `${leaverName}님 페이지`}
            </h1>
            {leaveOn && (
              <span style={{ fontSize: 11, fontWeight: 800, background: '#FEF3C7', color: '#B45309', borderRadius: 5, padding: '3px 8px' }}>
                퇴사 예정 {leaveOnLabel}
                {dueLabel ? ` (${dueLabel})` : ''}
              </span>
            )}
          </div>
          <p style={{ margin: '5px 0 0', fontSize: 13, color: '#7C7C88' }}>
            {remaining === 0
              ? '넘겨야 할 담당 건이 모두 정리됐어요.'
              : isLeaver
                ? '퇴사로 넘겨야 할 담당 건이에요. 넘길 건만 이관해주세요.'
                : `${leaverName}님 담당이 ${remaining}건 남아 있어요.`}
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link
            href="/advertiser/dashboard"
            style={{ height: 40, padding: '0 16px', borderRadius: 10, border: '1px solid #D4D4DC', background: '#fff', fontSize: 13, fontWeight: 700, color: '#3C3C46', display: 'flex', alignItems: 'center' }}
          >
            ← 대시보드
          </Link>
          {remaining > 0 && role !== 'receiver' && candidates.length > 0 && (
            <select
              value={allPick}
              onChange={(e) => setAllPick(e.target.value)}
              style={{ height: 40, borderRadius: 10, border: '1px solid #D4D4DC', background: '#fff', fontSize: 12.5, color: '#3C3C46', padding: '0 10px' }}
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {remaining > 0 && (
            <button
              onClick={takeAll}
              disabled={pending}
              style={{ height: 40, padding: '0 16px', borderRadius: 10, background: '#F59E0B', color: '#17171B', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.6 : 1 }}
            >
              {isLeaver ? `남은 ${remaining}건 한 사람에게` : `남은 ${remaining}건 전부 이관`}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: 12.5, borderRadius: 10, padding: '10px 14px' }}>{error}</div>
      )}

      {/* 배너 */}
      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 2px rgba(180,83,9,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.03em', background: '#F59E0B', color: '#17171B', borderRadius: 5, padding: '3px 8px', flexShrink: 0 }}>
            {isLeaver && leaveOn ? `퇴사 예정 · ${leaveOnLabel}${dueLabel ? ` (${dueLabel})` : ''}` : '이관'}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.02em', color: '#92400E' }}>
              {isLeaver ? `내가 담당한 ${remaining}건을 넘겨야 해요` : `${leaverName}님이 담당했던 것 ${remaining}건`}
            </div>
            <div style={{ fontSize: 12, color: '#B45309', lineHeight: 1.65, marginTop: 5 }}>
              {isLeaver
                ? `${leaveOnLabel || '퇴사일'}까지는 평소처럼 일하고, 넘길 건만 이관해주세요. 건마다 받는 분을 고르고, 남긴 메모는 그분에게 그대로 전달됩니다.`
                : isOwner
                  ? '퇴사 예정일 즈음이면 대표가 대신 이관할 수 있어요. 사람이 쓴 메모가 없는 건은 시스템 요약만 남습니다.'
                  : '딜시트와 대화를 열어 확인한 뒤 옮겨주세요. 옮긴 건에는 「이관」 꼬리표가 남습니다.'}
            </div>
          </div>
          <span
            onClick={() => setLogOpen((v) => !v)}
            style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: '#B45309', cursor: 'pointer', borderBottom: '1px solid rgba(180,83,9,0.28)', paddingBottom: 1 }}
          >
            {logOpen ? '기록 접기' : '이관 기록'}
          </span>
        </div>

        {logOpen && (
          <div style={{ background: '#fff', border: '1px solid #FDE68A', borderRadius: 10, padding: '13px 15px', marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#B45309', letterSpacing: '0.02em' }}>이관 기록 — 회사 대표도 같은 기록을 봅니다</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 10 }}>
              {log.length === 0 ? (
                <span style={{ fontSize: 12, color: '#9A9AA5' }}>아직 이관 기록이 없어요.</span>
              ) : (
                log.map((l, i) => (
                  <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 11, color: '#B0B0BB', width: 76, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{l.at}</span>
                    <span style={{ fontSize: 12, color: '#3C3C46', lineHeight: 1.6, minWidth: 0 }}>{l.what}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2단: 캠페인 / 개인 대화 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.55fr) minmax(0,1fr)', gap: 14, alignItems: 'stretch' }}>
        {/* 캠페인 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={{ background: '#fff', border: '1px solid #EAEAEE', borderRadius: 14, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid #F1F1F4', flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em' }}>{leaverName}님 담당 캠페인 {camps.length}건</h2>
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#9A9AA5' }}>한 건씩 살펴보고 옮기거나, 위에서 한 번에 옮기세요</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '10px 20px', background: '#FAFAFB', borderBottom: '1px solid #F1F1F4', flexShrink: 0 }}>
              {['캠페인', '상태', '모집', '기간', '예산', ''].map((c, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 700, color: '#9A9AA5' }}>{c}</span>
              ))}
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {camps.length === 0 ? (
                <div style={{ padding: '28px 20px', fontSize: 12.5, color: '#9A9AA5', textAlign: 'center' }}>남은 담당 캠페인이 없어요.</div>
              ) : (
                camps.map((r) => {
                  const st = ST_C[r.stLabel] ?? ST_C['완료']
                  const open = openId === r.id
                  return (
                    <div key={r.id} style={{ display: 'grid', gridTemplateColumns: GRID, padding: '14px 20px', borderBottom: '1px solid #F5F5F7', alignItems: 'center' }}>
                      <div style={{ minWidth: 0, paddingRight: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>
                        </div>
                        {r.meta && <div style={{ fontSize: 11, color: '#9A9AA5', marginTop: 3 }}>{r.meta}</div>}
                        {r.handover && (
                          <div style={{ display: 'flex', gap: 7, background: '#FBFBFC', border: '1px solid #EFEFF2', borderRadius: 8, padding: '9px 11px', marginTop: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#9A9AA5', flexShrink: 0, paddingTop: 1 }}>어디까지</span>
                            <span style={{ fontSize: 11, color: '#5C5C68', lineHeight: 1.6, minWidth: 0 }}>{r.handover}</span>
                          </div>
                        )}
                        {open && role !== 'receiver' && (
                          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 11px', marginTop: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#92400E', flexShrink: 0 }}>받는 사람</span>
                              <select
                                value={pick[r.id] ?? firstCand}
                                onChange={(e) => setPick((p) => ({ ...p, [r.id]: e.target.value }))}
                                style={{ flex: 1, height: 32, borderRadius: 7, border: '1px solid #E2E2E8', background: '#fff', fontSize: 12, color: '#3C3C46', padding: '0 9px' }}
                              >
                                {candidates.map((c) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>
                            <textarea
                              value={memo[r.id] ?? ''}
                              onChange={(e) => setMemo((m) => ({ ...m, [r.id]: e.target.value }))}
                              placeholder="인수인계 메모 (선택) — 받는 분에게 그대로 전달돼요"
                              rows={2}
                              style={{ width: '100%', marginTop: 8, borderRadius: 7, border: '1px solid #E2E2E8', background: '#fff', fontSize: 11.5, color: '#3C3C46', padding: '8px 9px', lineHeight: 1.55, resize: 'vertical' }}
                            />
                            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                              <button
                                onClick={() => takeCampaign(r)}
                                disabled={pending}
                                style={{ height: 30, padding: '0 12px', borderRadius: 7, background: '#17171B', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.6 : 1 }}
                              >
                                이관 확인
                              </button>
                              <button
                                onClick={() => setOpenId(null)}
                                style={{ height: 30, padding: '0 12px', borderRadius: 7, background: '#F1F1F4', color: '#5C5C68', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 5, padding: '3px 8px', justifySelf: 'start', background: st[0], color: st[1] }}>{r.stLabel}</span>
                      <span style={{ fontSize: 12, color: '#3C3C46', fontVariantNumeric: 'tabular-nums' }}>{r.people}</span>
                      <span style={{ fontSize: 12, color: '#5C5C68' }}>{r.period}</span>
                      <span style={{ fontSize: 12, color: '#3C3C46', fontVariantNumeric: 'tabular-nums' }}>{r.pay}</span>
                      <button
                        onClick={() => (role === 'receiver' ? takeCampaign(r) : setOpenId(open ? null : r.id))}
                        disabled={pending}
                        style={{ justifySelf: 'start', height: 30, padding: '0 11px', borderRadius: 8, background: '#17171B', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', cursor: pending ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: pending ? 0.6 : 1 }}
                      >
                        {takeLabel}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* 개인 대화 → 대표 보관 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={{ background: '#fff', border: '1px solid #EAEAEE', borderRadius: 14, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 46, display: 'flex', alignItems: 'center', padding: '0 18px', borderBottom: '1px solid #F1F1F4', flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em' }}>{leaverName}님 개인 대화 {convos.length}건</h2>
              <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 800, borderRadius: 5, padding: '2px 7px', background: '#F1F1F4', color: '#7C7C88' }}>대표 보관</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {convos.length === 0 ? (
                <div style={{ padding: '24px 18px', fontSize: 12.5, color: '#9A9AA5', textAlign: 'center' }}>대표가 보관할 개인 대화가 없어요.</div>
              ) : (
                convos.map((c) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderBottom: '1px solid #F5F5F7' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#FEF3C7', color: '#B45309', fontSize: 12.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c.initial}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                        <span style={{ fontSize: 10.5, color: '#B0B0BB', marginLeft: 'auto', flexShrink: 0 }}>{c.when}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                        <button
                          onClick={() => takeConversation(c.id)}
                          disabled={pending}
                          style={{ height: 26, padding: '0 9px', borderRadius: 7, background: '#17171B', color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', cursor: pending ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: pending ? 0.6 : 1 }}
                        >
                          {isOwner ? '내가 보관' : '대표에게 이관'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div style={{ padding: '11px 18px', fontSize: 11, color: '#9A9AA5', lineHeight: 1.65, flexShrink: 0, borderTop: '1px solid #F1F1F4' }}>
              캠페인에 엮인 대화는 여기 없어요 — 캠페인과 함께 따라갑니다. 여기는 캠페인과 무관한 개인 대화이고, 회사 자산이라 대표가 보관합니다.
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
