'use client'

import { useState, useMemo } from 'react'
import { requestTaxDocs, resolveSettlementDispute } from '@/lib/deals/settle'
import { kstDateString, dDay as kstDDay, dDayLabel, monthDayKo } from '@/lib/date'
import { settlementDateOf, isSettlementDateChanged } from '@/lib/deals/settlementDate'
import SettleConfirmModal from './SettleConfirmModal'
import SettlementDateModal from './messages/SettlementDateModal'
import { proposeSettlementDate } from '@/lib/deals/time'

type Proposal = {
  id: string
  campaign_id: string
  influencer_id: string
  budget: number | null
  advertiser_confirmed: boolean
  influencer_confirmed: boolean
  tax_doc_type: string | null
  tax_doc_received: boolean | null
  settlement_status: string | null
  settled_at: string | null
  paid_disputed_at: string | null
  settlement_date: string | null // D20 — 이 사람과 합의한 결제일. 비면 campaigns.settlement_date.
  profile: { name: string | null }
}

type Campaign = {
  id: string
  title: string
  campaign_type: string | null
  settlement_date: string | null
  tax_doc_requested_at: string | null
  status: string | null
  overdue_reminder_count?: number
}

type Tab = '예정' | '미수' | '완료'

const TAX_CHIP = (type: string | null, received: boolean | null) => {
  if (!type) return { label: '종류 미정', cls: 'bg-[#FEE2E2] text-[#DC2626]' }
  if (received) return { label: type, cls: 'bg-[#F1F1F4] text-[#5C5C68]' }
  return { label: `${type} 미수령`, cls: 'bg-[#FEE2E2] text-[#DC2626]' }
}

export default function SettlementsView({
  campaigns,
  proposals,
  recorderName,
}: {
  campaigns: Campaign[]
  proposals: Proposal[]
  recorderName?: string // D14 6절 — 로그인한 기록자 이름. 정산 기록 모달 배지·확인문구에 노출.
}) {
  const [tab, setTab] = useState<Tab>('예정')
  const [openId, setOpenId] = useState<string | null>(null)
  const [settleModalFor, setSettleModalFor] = useState<Campaign | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set())
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set())
  const [resolveNote, setResolveNote] = useState('')
  const [resolvingFor, setResolvingFor] = useState<string | null>(null)
  // 정산 완료 처리는 아래에서 handleSettled로 흡수하지만, 화면 리렌더를 위해
  // settlement_status를 로컬에서도 낙관적으로 갱신한다.
  const [localProposals, setLocalProposals] = useState(proposals)
  const [dateModal, setDateModal] = useState<{ proposalId: string; currentLabel: string | null } | null>(null)

  // D6 C1 — 미수 = 지급 예정일이 지났는데 기록되지 않은 건. C7 — "오늘" 기준은 kstDateString 하나뿐.
  const today = kstDateString()

  const rows = useMemo(() => {
    const byCampaign: Record<string, Proposal[]> = {}
    for (const p of localProposals) (byCampaign[p.campaign_id] ??= []).push(p)

    return campaigns
      .map((c) => {
        const targets = (byCampaign[c.id] ?? []).filter(
          (p) => p.advertiser_confirmed && p.influencer_confirmed,
        )
        if (targets.length === 0) return null
        const disputed = targets.some((p) => p.settled_at && p.paid_disputed_at)
        const allSettled = targets.every((p) => p.settlement_status === '완료')
        // D20 §2 — 미수 판정은 사람별 합의 결제일(settlementDateOf)로. 캠페인 기본값을 직접 읽지 않는다.
        // 한 캠페인 안에서도 합의한 사람은 지연이 아니고, 안 한 사람만 미수로 잡힌다.
        const targetOverdue = (p: Proposal) => {
          if (p.settlement_status === '완료') return false
          const d = settlementDateOf(p, c)
          return !!d && d < today
        }
        const overdue = !allSettled && targets.some(targetOverdue)
        const overdueOldest =
          targets.filter(targetOverdue).map((p) => settlementDateOf(p, c)).filter((d): d is string => !!d).sort()[0] ?? null
        // C4 — 진행바 분모는 정산 대상 인원(보류자 제외)
        const settleableTargets = disputed ? targets.filter((p) => !(p.settled_at && p.paid_disputed_at)) : targets
        const bucket: Tab = allSettled ? '완료' : overdue ? '미수' : '예정'
        const totalAmount = targets.reduce((s, p) => s + (p.budget ?? 0), 0)
        const readyAmount = targets
          .filter((p) => p.tax_doc_received)
          .reduce((s, p) => s + (p.budget ?? 0), 0)
        const taxReceived = targets.filter((p) => p.tax_doc_received).length
        return { campaign: c, targets, settleableTargets, bucket, totalAmount, readyAmount, taxReceived, disputed, overdue, overdueOldest }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
  }, [campaigns, localProposals, today])

  const tabCounts = useMemo(() => {
    const c: Record<Tab, number> = { 예정: 0, 미수: 0, 완료: 0 }
    for (const r of rows) c[r.bucket]++
    return c
  }, [rows])

  const kpis = useMemo(() => {
    const pending = rows.filter((r) => r.bucket === '예정')
    const pendingTotal = pending.reduce((s, r) => s + r.totalAmount, 0)
    const overdueRows = rows.filter((r) => r.bucket === '미수')
    const overdueTotal = overdueRows.reduce((s, r) => s + r.totalAmount, 0)
    const oldestOverdue = overdueRows
      .map((r) => r.overdueOldest)
      .filter((d): d is string => !!d)
      .sort()[0]
    const taxMissing = rows
      .filter((r) => r.bucket !== '완료')
      .reduce((s, r) => s + (r.targets.length - r.taxReceived), 0)
    const doneTotal = rows.filter((r) => r.bucket === '완료').reduce((s, r) => s + r.totalAmount, 0)
    return { pendingTotal, pendingCount: pending.length, overdueTotal, overdueCount: overdueRows.length, oldestOverdue, taxMissing, doneTotal }
  }, [rows])

  const filtered = rows.filter((r) => r.bucket === tab)

  const handleRequestTaxDocs = async (campaignId: string) => {
    setBusyId(campaignId)
    const res = await requestTaxDocs(campaignId)
    setBusyId(null)
    if (res.ok) setRequestedIds((prev) => new Set(prev).add(campaignId))
  }

  const handleResolveDispute = async (campaignId: string) => {
    setBusyId(campaignId)
    const res = await resolveSettlementDispute(campaignId, resolveNote)
    setBusyId(null)
    if (res.ok) {
      setResolvedIds((prev) => new Set(prev).add(campaignId))
      setResolvingFor(null)
      setResolveNote('')
    }
  }

  const handleSettled = (settledIds: string[]) => {
    setLocalProposals((prev) =>
      prev.map((p) => (settledIds.includes(p.id) ? { ...p, settlement_status: '완료', settled_at: new Date().toISOString() } : p)),
    )
    setSettleModalFor(null)
  }

  const card = 'bg-white border border-[#EAEAEE] rounded-[14px]'
  const fmt = (n: number) => n.toLocaleString()

  return (
    <div className="flex flex-col gap-[14px] [.adv-pc_&]:grid [.adv-pc_&]:grid-cols-[minmax(0,1fr)_300px] [.adv-pc_&]:gap-[14px] [.adv-pc_&]:items-start">
      <div className="flex flex-col gap-5 [.adv-pc_&]:gap-[14px] min-w-0">
        <h1 className="text-[23px] font-extrabold tracking-[-0.03em] text-[#17171B]">정산</h1>

        {/* 요약 4칸 */}
        <div className="grid grid-cols-2 [.adv-pc_&]:grid-cols-4 gap-3.5">
          <div className="bg-white border border-[#EAEAEE] rounded-xl px-[18px] py-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-[2px] bg-[#F59E0B]" />
              <span className="text-xs font-semibold text-[#7C7C88]">정산 예정</span>
            </div>
            <div className="text-[22px] font-extrabold tracking-[-0.03em]">{fmt(kpis.pendingTotal)}원</div>
            <div className="text-[11.5px] text-[#9A9AA5]">{kpis.pendingCount}개 캠페인</div>
          </div>
          <div className={`border rounded-xl px-[18px] py-4 flex flex-col gap-1.5 ${kpis.overdueCount > 0 ? 'bg-[#FEF2F2] border-[#FECACA]' : 'bg-white border-[#EAEAEE]'}`}>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-[2px] bg-[#DC2626]" />
              <span className="text-xs font-semibold text-[#7C7C88]">미수</span>
            </div>
            <div className={`text-[22px] font-extrabold tracking-[-0.03em] ${kpis.overdueCount > 0 ? 'text-[#DC2626]' : ''}`}>
              {kpis.overdueCount > 0 ? fmt(kpis.overdueTotal) + '원' : '없음'}
            </div>
            <div className="text-[11.5px] text-[#9A9AA5]">
              {kpis.overdueCount > 0 ? `${kpis.overdueCount}건 · 가장 오래 ${dDayLabel(kpis.oldestOverdue)}` : '예정일을 지킨 상태예요'}
            </div>
          </div>
          <div className="bg-white border border-[#EAEAEE] rounded-xl px-[18px] py-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-[2px] bg-[#EF4444]" />
              <span className="text-xs font-semibold text-[#7C7C88]">세무자료 미비</span>
            </div>
            <div className="text-[22px] font-extrabold tracking-[-0.03em] text-[#DC2626]">{kpis.taxMissing}명</div>
            <div className="text-[11.5px] text-[#9A9AA5]">전원 수령해야 정산 기록 가능</div>
          </div>
          <div className="bg-white border border-[#EAEAEE] rounded-xl px-[18px] py-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-[2px] bg-[#22C55E]" />
              <span className="text-xs font-semibold text-[#7C7C88]">정산 완료 (누적)</span>
            </div>
            <div className="text-[22px] font-extrabold tracking-[-0.03em]">{fmt(kpis.doneTotal)}원</div>
          </div>
        </div>

        {/* 탭 — 미수가 0건이 아니면 탭 자체를 빨강으로(C1) */}
        <div className="flex gap-[3px] bg-[#F1F1F4] rounded-lg p-[3px] w-fit">
          {(['예정', '미수', '완료'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-[12.5px] font-semibold px-3.5 py-[7px] rounded-md transition ${
                t === '미수' && tabCounts['미수'] > 0
                  ? tab === t ? 'bg-[#FEF2F2] text-[#DC2626] shadow-[0_1px_2px_rgba(0,0,0,.06)]' : 'text-[#DC2626] hover:bg-[#FEF2F2]'
                  : tab === t ? 'bg-white text-[#17171B] shadow-[0_1px_2px_rgba(0,0,0,.06)]' : 'text-[#8A8A96] hover:text-[#5C5C68]'
              }`}
            >
              {t} {tabCounts[t]}
            </button>
          ))}
        </div>

        {/* 캠페인 카드 */}
        <div className="flex flex-col gap-3">
          {filtered.length === 0 && (
            <div className={card + ' py-16 text-center'}>
              <p className="text-[14px] text-[#B0B0BB]">{tab} 상태인 캠페인이 없어요.</p>
            </div>
          )}
          {filtered.map((r) => {
            // C4 — 분모는 정산 대상 인원(보류자 제외)
            const taxReceivedAmongSettleable = r.settleableTargets.filter((p) => p.tax_doc_received).length
            const pct = r.settleableTargets.length ? Math.round((taxReceivedAmongSettleable / r.settleableTargets.length) * 100) : 0
            const isOpen = openId === r.campaign.id
            const requested = requestedIds.has(r.campaign.id) || !!r.campaign.tax_doc_requested_at
            const resolved = resolvedIds.has(r.campaign.id)
            const dday = kstDDay(r.campaign.settlement_date)
            return (
              <div key={r.campaign.id} className={card + ' p-4 flex flex-col gap-[13px]'}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14.5px] font-extrabold truncate">{r.campaign.title}</span>
                      <span
                        className={`text-[10.5px] font-bold px-2 py-0.5 rounded-[5px] ${
                          r.bucket === '완료'
                            ? 'bg-[#DCFCE7] text-[#15803D]'
                            : r.bucket === '미수'
                            ? 'bg-[#FEE2E2] text-[#DC2626]'
                            : 'bg-[#FEF3C7] text-[#B45309]'
                        }`}
                      >
                        {r.bucket}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-[#8A8A96] mt-[3px]">
                      {r.campaign.campaign_type ?? '캠페인'} ·{' '}
                      {r.campaign.settlement_date ? (
                        <>
                          정산일 {r.campaign.settlement_date.slice(5).replace('-', '/')}(
                          <span className={dday !== null && dday < 0 ? 'text-[#DC2626]' : 'text-[#B45309]'}>
                            {dday !== null ? (dday >= 0 ? `D-${dday}` : `D+${Math.abs(dday)}`) : '-'}
                          </span>
                          )
                        </>
                      ) : (
                        '정산일 미정'
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[18px] font-extrabold">{fmt(r.totalAmount)}원</div>
                    <div className="text-[11px] text-[#9A9AA5]">지급 준비 {fmt(r.readyAmount)}원</div>
                  </div>
                </div>

                {/* C1 — 미수 카드 안내: 지연 자동 알림·누적 근거·예정일 변경 경로를 그 자리에서 알려준다 */}
                {r.bucket === '미수' && (
                  <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2 text-[12px] text-[#B91C1C] leading-relaxed">
                    예정일 {r.campaign.settlement_date?.slice(5).replace('-', '/')}에서 {Math.abs(dday ?? 0)}일 지났어요.
                    매일 1회 지연 알림이 발송되고 있고(누적 {r.campaign.overdue_reminder_count ?? 0}회), 이 기록이 이용 제한 판정에 쓰입니다.
                    결제 예정일을 미뤄야 하면 아래 「대상 인원 보기」에서 그 인플루언서에게 변경을 제안하세요. 상대가 수락하면 매출 시점도 함께 옮겨집니다.
                  </div>
                )}

                {r.disputed && (
                  <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2 text-[12px] text-[#B91C1C]">
                    인플루언서가 입금을 확인하지 못했다고 표시했어요. 사유를 확인하고 딜시트에서 재정산해주세요.
                    {resolved ? (
                      <span className="ml-1 font-semibold">— 해결 기록됨 · 오늘</span>
                    ) : resolvingFor === r.campaign.id ? (
                      <span className="mt-2 flex flex-col gap-1.5">
                        <textarea
                          value={resolveNote}
                          onChange={(e) => setResolveNote(e.target.value)}
                          rows={2}
                          placeholder="확인한 내용을 남겨주세요 (선택)"
                          className="w-full mt-1.5 px-2 py-1.5 text-[11.5px] rounded-lg border border-[#FECACA] bg-white resize-none"
                        />
                        <button
                          onClick={() => handleResolveDispute(r.campaign.id)}
                          disabled={busyId === r.campaign.id}
                          className="self-start text-[11.5px] font-semibold bg-[#B91C1C] text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                        >
                          {busyId === r.campaign.id ? '기록 중...' : '해결 기록하기'}
                        </button>
                      </span>
                    ) : null}
                  </div>
                )}

                {/* 세무자료 수집 바 */}
                <div>
                  <div className="h-1.5 rounded-full bg-[#F1F1F4] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct === 100 ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-[#9A9AA5] mt-1">
                    세무자료 {r.taxReceived} / {r.targets.length}명
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOpenId(isOpen ? null : r.campaign.id)}
                    className="text-[12px] font-semibold text-[#5C5C68] hover:text-[#17171B]"
                  >
                    대상 인원 보기 {isOpen ? '^' : 'v'}
                  </button>
                  <div className="ml-auto">
                    {r.bucket === '완료' ? (
                      r.disputed && !resolved && resolvingFor !== r.campaign.id ? (
                        <button
                          onClick={() => setResolvingFor(r.campaign.id)}
                          className="text-[12px] font-semibold text-[#5C5C68] border border-[#E2E2E8] rounded-lg px-3 py-1.5 hover:bg-[#F6F6F7]"
                        >
                          보류 사유 해결하기
                        </button>
                      ) : (
                        <span className="text-[12px] font-semibold text-[#15803D]">정산 내역 보기</span>
                      )
                    ) : pct === 100 ? (
                      <button
                        onClick={() => setSettleModalFor(r.campaign)}
                        className="text-[12.5px] font-bold bg-[#F59E0B] hover:bg-[#D97706] text-white px-4 py-2 rounded-lg"
                      >
                        정산 완료로 기록
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRequestTaxDocs(r.campaign.id)}
                        disabled={busyId === r.campaign.id || requested}
                        className="text-[12.5px] font-bold bg-[#F59E0B] hover:bg-[#D97706] text-white px-4 py-2 rounded-lg disabled:opacity-50"
                      >
                        {requested ? '요청 보냄 · 대기' : busyId === r.campaign.id ? '요청 중...' : `세무자료 ${r.targets.length - r.taxReceived}명 요청하기`}
                      </button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-[#F1F1F4] pt-2.5 -mx-4 px-4 overflow-x-auto">
                    <div className="min-w-[480px]">
                      <div className="grid grid-cols-[minmax(0,1fr)_130px_130px_100px] gap-2 px-1 pb-2 text-[10.5px] font-bold text-[#9A9AA5]">
                        <span>인플루언서</span>
                        <span className="text-right">페이</span>
                        <span className="text-right">세무자료</span>
                        <span className="text-right">상태</span>
                      </div>
                      {r.targets.map((p) => {
                        const chip = TAX_CHIP(p.tax_doc_type, p.tax_doc_received)
                        return (
                          <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_130px_130px_100px] gap-2 px-1 py-2 border-t border-[#F5F5F7] items-center text-[12.5px]">
                            <div className="min-w-0">
                              <span className="block truncate font-medium">{p.profile.name ?? '인플루언서'}</span>
                              {isSettlementDateChanged(p) && (
                                <span className="block text-[10px] font-semibold text-[#5C5C68] mt-0.5">
                                  {p.settlement_date!.slice(5).replace('-', '/')} · {dDayLabel(p.settlement_date)}{' '}
                                  <span className="text-[#1D4ED8]">(변경)</span>
                                </span>
                              )}
                              {p.settlement_status !== '완료' && (
                                <button
                                  onClick={() =>
                                    setDateModal({
                                      proposalId: p.id,
                                      currentLabel: monthDayKo(settlementDateOf(p, r.campaign)) || null,
                                    })
                                  }
                                  className="mt-1.5 text-[11.5px] font-semibold text-[#5C5C68] border border-[#E2E2E8] bg-white hover:bg-[#FAFAFB] rounded-[7px]"
                                  style={{ padding: '6px 10px' }}
                                >
                                  {isSettlementDateChanged(p) ? '결제일 다시 제안' : '결제일 변경 제안'}
                                </button>
                              )}
                            </div>
                            <span className="text-right">{fmt(p.budget ?? 0)}원</span>
                            <span className="text-right">
                              <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${chip.cls}`}>{chip.label}</span>
                            </span>
                            <span className="text-right">
                              {p.settlement_status === '완료' ? (
                                <span className="text-[11px] font-semibold text-[#15803D]">지급 완료</span>
                              ) : p.paid_disputed_at ? (
                                <span className="text-[11px] font-semibold text-[#DC2626]">보류</span>
                              ) : (
                                <span className="text-[11px] font-semibold text-[#9A9AA5]">대기</span>
                              )}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 우측 레일 */}
      <div className="flex flex-col gap-3.5">
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] px-4 py-3.5">
          <p className="text-[12.5px] font-bold text-[#92400E] mb-1">매치포스트는 송금을 대행하지 않아요</p>
          <p className="text-[11.5px] text-[#B45309] leading-relaxed">
            실제 지급은 광고주가 직접 합니다. 여기 버튼은 지급 여부를 확인하고 기록만 남겨요.
          </p>
        </div>
        <div className={card + ' px-4 py-3.5'}>
          <p className="text-[12.5px] font-bold text-[#17171B] mb-2">세무자료 안내</p>
          <ul className="flex flex-col gap-1.5 text-[11.5px] text-[#7C7C88] leading-relaxed">
            <li>· 세금계산서 — 사업자등록증(발행 주체)</li>
            <li>· 3.3% — 주민번호 대신 전화번호·국세청 ID</li>
            <li>· 대시에서 받고 딜시트에 즉시 체크. 체크가 없으면 정산 대상에서 빠져요.</li>
          </ul>
        </div>
      </div>

      {settleModalFor && (
        <SettleConfirmModal
          proposals={rows.find((r) => r.campaign.id === settleModalFor.id)?.targets ?? []}
          campaign={settleModalFor}
          recorderName={recorderName}
          onClose={() => setSettleModalFor(null)}
          onDone={handleSettled}
        />
      )}

      {dateModal && (
        <SettlementDateModal
          currentDateLabel={dateModal.currentLabel}
          onClose={() => setDateModal(null)}
          onSubmit={async (date, reason) => proposeSettlementDate(dateModal.proposalId, date, reason)}
        />
      )}
    </div>
  )
}
