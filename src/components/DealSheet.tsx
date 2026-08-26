'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ReviewModal from './ReviewModal'
import MatchScore from './MatchScore'
import SettleConfirmModal from './SettleConfirmModal'
import ReportModal from './ReportModal'
import CancelRequestModal from './CancelRequestModal'
import { initial } from '@/lib/initial'
import { reSettleCampaign } from '@/lib/deals/settle'
import { requestCancellation, acceptCancellation } from '@/lib/cancellations/actions'
// 상수는 'use server' 파일에서 못 가져온다 — ./reasons 주석 참고
import { CANCEL_REASONS, type CancelReason } from '@/lib/cancellations/reasons'
import { proposeConnection } from '@/lib/connections/actions'
import {
  ALL_STAGES,
  computeEnabledStages,
  reindexStage,
  stageHintLine,
  stageOwnerOf,
  stageWaitingLine,
  type Stage,
} from '@/lib/campaign-stages'
// D29 PROMPT-2 — 진행 기록 세 가지는 서버액션으로. 브라우저 update 는 RLS 에 막혀도 조용했다.
import { advanceStage as advanceStageAction, setTaxDocReceived, setSettlementStatus } from '@/lib/deals/progress'
// D32 2절 — 지원자 확정·반려·모집마감. 여기도 서버액션이다(브라우저 update 는 조용히 0행이 된다).
import { confirmApplicant, rejectApplicant, closeRecruiting } from '@/lib/deals/applicants'
import { CalendarDays, MapPin, AlertTriangle } from 'lucide-react'
import { dDayLabel, monthDayKo } from '@/lib/date'
import { isSettlementDateChanged, settlementDateOf } from '@/lib/deals/settlementDate'
import SettlementDateModal from './messages/SettlementDateModal'
import { proposeSettlementDate } from '@/lib/deals/time'

// 체크포인트가 있는 단계 → checkpoint kind (방문·수정/컨펌 제외)
const STAGE_TO_CP: Record<string, string> = {
  '가이드': 'guide',
  '원고':   'draft',
  '게재':   'publish',
  '정산':   'payment',
}

type DealCheckpoint = {
  id: string
  proposal_id: string
  kind: string
  due_original: string | null
  due_adjusted: string | null
  completed_at: string | null
  late_days: number
}

function formatMD(d: string) {
  const dt = new Date(d)
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

function DeadlineChip({ cp }: { cp: DealCheckpoint }) {
  const dateStr = cp.due_adjusted ?? cp.due_original
  if (!dateStr || cp.completed_at) return null
  const due = new Date(dateStr)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000)
  const isDelayed = cp.due_original && cp.due_adjusted && cp.due_original !== cp.due_adjusted
  const isOverdue = diff < 0 || cp.late_days > 0
  const isUrgent = !isOverdue && diff <= 3
  const bg = isOverdue ? '#FEE2E2' : isUrgent ? '#FEF3C7' : '#F1F1F4'
  const col = isOverdue ? '#DC2626' : isUrgent ? '#B45309' : '#7C7C88'
  const dDay = diff < 0 ? `D+${Math.abs(diff)}` : diff === 0 ? 'D-day' : `D-${diff}`
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded mt-1.5"
      style={{ background: bg, color: col }}>
      {isDelayed && <span className="opacity-60 mr-0.5">{formatMD(cp.due_original!)}→</span>}
      {formatMD(dateStr)} · {dDay}
    </span>
  )
}

// Channel group styles (Screen 3 spec)
const CH_GROUP: Record<string, { label: string; bg: string; text: string }> = {
  블로그:     { label: '블로그',    bg: '#DCFCE7', text: '#15803D' },
  유튜브:     { label: '유튜브',    bg: '#FEE2E2', text: '#DC2626' },
  인스타그램: { label: '인스타그램', bg: '#FCE7F3', text: '#BE185D' },
  틱톡:       { label: '틱톡',      bg: '#E8E8EC', text: '#17171B' },
}

const SETTLEMENT_STYLE: Record<string, string> = {
  미정산: 'bg-[#F1F1F4] text-[#7C7C88]',
  정산중: 'bg-[#FEF3C7] text-[#B45309]',
  완료:   'bg-[#DCFCE7] text-[#15803D]',
}

const INSPECTION_STYLE: Record<string, string> = {
  통과:   'bg-[#DCFCE7] text-[#15803D]',
  미통과: 'bg-[#FEE2E2] text-[#DC2626]',
  검토중: 'bg-[#F1F1F4] text-[#7C7C88]',
}

type Proposal = {
  id: string
  influencer_id: string
  campaign_id: string
  budget: number | null
  advertiser_confirmed: boolean
  influencer_confirmed: boolean
  // D32 2절 — 지원자 줄을 딜시트 표에서 갈라내는 데 쓰는 칸들
  initiated_by: string | null
  status: string | null
  message: string | null
  proposed_date: string | null
  created_at: string | null
  reject_reason: string | null
  // dealsheet fields (may be null if migration not yet applied)
  stage: string | null
  visit_at: string | null
  upload_url: string | null
  inspection_url: string | null
  inspection_at: string | null
  inspection_status: string | null
  tax_doc_type: string | null
  tax_doc_received: boolean | null
  settlement_status: string | null
  settlement_date: string | null // D20 — 이 사람과 합의한 결제일. 비면 campaigns.settlement_date.
  settled_at: string | null
  paid_confirmed_at: string | null
  paid_disputed_at: string | null
  // joined
  profile: { id: string; name: string | null; avatar_url: string | null } | null
  influencer_profile: { follower_count: number | null; platforms: string[] | null; match_score: number | null; review_count: number | null } | null
}

// 오픈 협업(campaign_id 없음)도 이 표를 쓴다 — lib/deals/openDeal.ts 가 이 모양으로 합성한다.
export type DealSheetCampaign = {
  id: string
  title: string
  campaign_type: string | null
  channels: string[] | null
  date: string | null
  location_city: string | null
  location_district: string | null
  budget_total: number | null
  recruit_target: number | null
  upload_deadline: string | null
  inspection_deadline: string | null
  settlement_date: string | null
  status: string | null
  stage_pre_confirm?: boolean
  stage_post_edit?: boolean
  // D32 2절 — 광고주가 모집을 닫은 시각. 인원이 차도 자동으로 채워지지 않는다.
  recruit_closed_at?: string | null
}

// D6 B3 — 인덱스는 항상 그 캠페인의 활성 단계 목록(stages) 기준으로만 계산한다.
// 예전엔 ALL_STAGES 기준 인덱스를 필터링된 목록에 그대로 꽂아 써서(같은 공간이 아님)
// 방문 없는 캠페인에서 다음 단계를 건너뛰는 버그가 있었다.
function stageIndex(stage: string | null, stages: readonly Stage[]): number {
  const idx = stages.indexOf(reindexStage(stage, stages as Stage[]))
  return idx >= 0 ? idx : 0
}

function stageColor(stage: string | null, stages: readonly Stage[]): string {
  const idx = stageIndex(stage, stages)
  if (idx >= stages.length - 1) return '#22C55E'
  if (idx >= 2) return '#F59E0B'
  return '#C4C4CE'
}

export default function DealSheet({
  campaign,
  proposals,
  userId,
  recorderName,
  viewerRole = 'advertiser',
  dealKind = 'campaign',
  backHref,
  backLabel,
}: {
  campaign: DealSheetCampaign
  proposals: Proposal[]
  userId: string
  recorderName?: string // D14 6절 — 로그인한 기록자 이름. 정산 기록 모달 배지·확인문구에 노출.
  // D29 1번 — 같은 표를 인플루언서도 본다. 기록·정산은 광고주 몫이라 조작만 감추고 내용은 그대로 보여준다.
  viewerRole?: 'advertiser' | 'influencer'
  dealKind?: 'campaign' | 'open'
  backHref?: string
  backLabel?: string
}) {
  const isAdv = viewerRole === 'advertiser'
  const supabase = createClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [proposals_, setProposals] = useState<Proposal[]>(proposals)
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set())
  const [checkpoints, setCheckpoints] = useState<Record<string, Record<string, DealCheckpoint>>>({})
  const [reviewModal, setReviewModal] = useState<{
    proposalId: string; revieweeId: string; revieweeName: string
  } | null>(null)
  const [settleModal, setSettleModal] = useState(false)
  const [dateModal, setDateModal] = useState<{ proposalId: string; currentLabel: string | null } | null>(null)
  const [reportModal, setReportModal] = useState<string | null>(null)
  const [cancelModal, setCancelModal] = useState<string | null>(null)
  const [pendingCancellations, setPendingCancellations] = useState<
    Record<string, { id: string; by_id: string; reason: string }>
  >({})
  // D6 A8 — 취소가 수락된 건. 행은 지우지 않고 배지+사유로 남긴다(확정 플래그는 이미 서버에서 내려감)
  const [resolvedCancellations, setResolvedCancellations] = useState<Record<string, { reason: string }>>({})
  const [cancelError, setCancelError] = useState('')
  const [connections, setConnections] = useState<
    Record<string, { id: string; a_id: string; a_ok: boolean; b_ok: boolean }>
  >({})
  const [connectionBusy, setConnectionBusy] = useState<string | null>(null)
  const [connectionError, setConnectionError] = useState('')
  // 진행 기록(단계·세무자료·정산상태)이 서버에서 거절당하면 여기 담아 화면에 띄운다 — 조용히 넘어가지 않는다.
  const [progressError, setProgressError] = useState('')
  // D32 2절 — 지원자 카드
  const [applicantBusy, setApplicantBusy] = useState<string | null>(null)
  const [applicantError, setApplicantError] = useState('')
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [closedAt, setClosedAt] = useState<string | null>(campaign.recruit_closed_at ?? null)

  const loadConnections = () => {
    supabase
      .from('connections')
      .select('id, a_id, b_id, a_ok, b_ok')
      .or(`a_id.eq.${userId},b_id.eq.${userId}`)
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, { id: string; a_id: string; a_ok: boolean; b_ok: boolean }> = {}
        for (const c of data) {
          const otherId = c.a_id === userId ? c.b_id : c.a_id
          map[otherId] = { id: c.id, a_id: c.a_id, a_ok: c.a_ok, b_ok: c.b_ok }
        }
        setConnections(map)
      })
  }

  const handleProposeConnection = async (influencerId: string) => {
    setConnectionBusy(influencerId)
    setConnectionError('')
    const res = await proposeConnection(influencerId)
    setConnectionBusy(null)
    if (!res.ok) { setConnectionError(res.error); return }
    loadConnections()
  }

  const loadCancellations = () => {
    const ids = proposals_.map((p) => p.id)
    if (ids.length === 0) return
    supabase
      .from('cancellations')
      .select('id, deal_id, by_id, reason')
      .in('deal_id', ids)
      .is('agreed', null)
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, { id: string; by_id: string; reason: string }> = {}
        for (const c of data) map[c.deal_id] = { id: c.id, by_id: c.by_id, reason: c.reason }
        setPendingCancellations(map)
      })
    supabase
      .from('cancellations')
      .select('deal_id, reason')
      .in('deal_id', ids)
      .eq('agreed', true)
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, { reason: string }> = {}
        for (const c of data) map[c.deal_id] = { reason: c.reason }
        setResolvedCancellations(map)
      })
  }

  useEffect(() => {
    const ids = proposals_.map((p) => p.id)
    supabase
      .from('reviews')
      .select('proposal_id')
      .eq('rater_id', userId)
      .then(({ data }) => {
        if (data) setReviewedIds(new Set(data.map((r) => r.proposal_id)))
      })
    if (ids.length > 0) {
      supabase
        .from('deal_checkpoints')
        .select('*')
        .in('proposal_id', ids)
        .then(({ data }) => {
          if (!data) return
          const map: Record<string, Record<string, DealCheckpoint>> = {}
          for (const cp of data) {
            if (!map[cp.proposal_id]) map[cp.proposal_id] = {}
            map[cp.proposal_id][cp.kind] = cp
          }
          setCheckpoints(map)
        })
    }
    loadCancellations()
    loadConnections()

    // 체크포인트는 대화창에서 파일을 "가이드/원고/게재로 등록"하면 트리거가 자동 완료 처리한다(0056) —
    // 딜시트를 열어둔 채로도 바로 보이도록 실시간 구독
    const channel = supabase
      .channel(`deal-checkpoints-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deal_checkpoints' },
        (payload) => {
          const cp = (payload.new ?? payload.old) as DealCheckpoint
          if (!ids.includes(cp.proposal_id)) return
          setCheckpoints((prev) => ({
            ...prev,
            [cp.proposal_id]: { ...prev[cp.proposal_id], [cp.kind]: payload.new as DealCheckpoint },
          }))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const handleAcceptCancellation = async (cancellationId: string) => {
    setCancelError('')
    const res = await acceptCancellation(cancellationId)
    if (!res.ok) { setCancelError(res.error); return }
    loadCancellations()
  }

  const isLocation = campaign.campaign_type === '지역'
  // 오픈 협업엔 켜고 끌 캠페인 설정이 없다 — 기본 9단계(가이드 포함)를 그대로 쓴다(D29 PROMPT-2 정정).
  const stages: Stage[] = dealKind === 'open'
    ? [...ALL_STAGES]
    : computeEnabledStages({
        campaignType: campaign.campaign_type,
        preConfirm: campaign.stage_pre_confirm ?? true,
        postEdit: campaign.stage_post_edit ?? false,
      })

  const confirmedCount = proposals_.filter((p) => p.advertiser_confirmed && p.influencer_confirmed).length
  const selectedProposals = proposals_.filter((p) => selected.has(p.id))
  const selectedBudget = selectedProposals.reduce((sum, p) => sum + (p.budget ?? 0), 0)

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selected.size === sheetRows.length) setSelected(new Set())
    else setSelected(new Set(sheetRows.map((p) => p.id)))
  }

  // D29 PROMPT-4 — 넘길 단계가 남아 있나 / 지금 내 차례인가.
  // 담당자 표는 campaign-stages 의 STAGE_OWNER 하나뿐이다. 서버액션도 같은 표를 읽는다.
  const stageMovable = (p: Proposal) =>
    p.advertiser_confirmed && p.influencer_confirmed && !p.settled_at &&
    stageIndex(p.stage, stages) < stages.length - 1
  const myTurn = (p: Proposal) => stageOwnerOf(stages[stageIndex(p.stage, stages)]) === viewerRole

  // advance stage — 서버가 실제로 바뀐 행을 세고, 0이면 에러를 돌려준다(화면만 넘기지 않는다).
  const advanceStage = async (proposalId: string) => {
    const p = proposals_.find((x) => x.id === proposalId)
    if (!p) return
    const cur = stageIndex(p.stage, stages)
    if (cur >= stages.length - 1) return
    const nextStage = stages[cur + 1]
    setProgressError('')
    const res = await advanceStageAction(proposalId, nextStage)
    if (!res.ok) { setProgressError(`단계 이동 실패 — ${res.error}`); return }
    setProposals((prev) => prev.map((x) => (x.id === proposalId ? { ...x, stage: nextStage } : x)))
  }

  // tax doc toggle
  const toggleTaxDoc = async (proposalId: string, current: boolean | null) => {
    setProgressError('')
    const res = await setTaxDocReceived(proposalId, !current)
    if (!res.ok) { setProgressError(`세무자료 기록 실패 — ${res.error}`); return }
    setProposals((prev) =>
      prev.map((x) => (x.id === proposalId ? { ...x, tax_doc_received: !current } : x)),
    )
  }

  // update settlement status
  const setSettlement = async (proposalId: string, status: string) => {
    setProgressError('')
    const res = await setSettlementStatus(proposalId, status)
    if (!res.ok) { setProgressError(`정산 상태 변경 실패 — ${res.error}`); return }
    setProposals((prev) =>
      prev.map((x) => (x.id === proposalId ? { ...x, settlement_status: status } : x)),
    )
  }

  // D32 2절 — 지원자와 딜시트를 가른다.
  // 지원자 = 인플루언서가 걸어온 줄인데 광고주가 아직 답을 안 한 것.
  // 광고주가 보낸 대시는 여기 들어오지 않는다(그건 인플루언서가 답할 차례라 성격이 다르다).
  // 반려한 줄도 빠진다 — 표에도, 지원자 목록에도 남기지 않는다(사유는 줄에 남아 있다).
  const isApplicant = (p: Proposal) =>
    p.initiated_by === 'influencer' && !p.advertiser_confirmed && p.status !== 'rejected'
  const applicants = proposals_.filter(isApplicant)
  // 표에 그릴 줄. 반려한 줄은 확정도 진행도 없으므로 표에서도 뺀다.
  const sheetRows = proposals_.filter((p) => !isApplicant(p) && p.status !== 'rejected')

  // 확정 — 광고주 칸만 켠다(인플루언서 칸은 지원할 때 이미 켜져 있다).
  // 화면에서는 이 줄이 지원자 목록에서 빠지고 딜시트 표로 내려간다. 같은 배열을 나눠 보는 것이라
  // 플래그만 바꾸면 두 곳이 함께 움직인다 — 다시 불러오지 않는다.
  const onConfirmApplicant = async (proposalId: string) => {
    setApplicantError('')
    setApplicantBusy(proposalId)
    const res = await confirmApplicant(proposalId)
    setApplicantBusy(null)
    if (!res.ok) { setApplicantError(`확정 실패 — ${res.error}`); return }
    setProposals((prev) =>
      prev.map((x) =>
        x.id === proposalId ? { ...x, advertiser_confirmed: true, status: 'accepted' } : x,
      ),
    )
  }

  // 반려. 사유는 선택이라 비워도 그대로 보낸다.
  const onRejectApplicant = async (proposalId: string) => {
    setApplicantError('')
    setApplicantBusy(proposalId)
    const reason = rejectReason.trim()
    const res = await rejectApplicant(proposalId, reason)
    setApplicantBusy(null)
    if (!res.ok) { setApplicantError(`반려 실패 — ${res.error}`); return }
    setRejecting(null)
    setRejectReason('')
    setProposals((prev) =>
      prev.map((x) =>
        x.id === proposalId ? { ...x, status: 'rejected', reject_reason: reason || null } : x,
      ),
    )
  }

  // 모집 마감. 인원이 차도 자동으로 부르지 않는다 — 광고주가 눌러야 여기 온다.
  const onCloseRecruiting = async () => {
    setApplicantError('')
    setApplicantBusy('__close__')
    const res = await closeRecruiting(campaign.id)
    setApplicantBusy(null)
    if (!res.ok) { setApplicantError(`모집 마감 실패 — ${res.error}`); return }
    setClosedAt(new Date().toISOString())
  }

  // 모집 인원에 닿았나. 닿아도 닫지 않고 알리기만 한다.
  const reachedTarget =
    campaign.recruit_target != null && confirmedCount >= campaign.recruit_target

  // group proposals by channel (platforms[0] or '기타')
  const byChannel: Record<string, Proposal[]> = {}
  const channelOrder = Object.keys(CH_GROUP)
  for (const p of sheetRows) {
    const ch = p.influencer_profile?.platforms?.[0] ?? '기타'
    ;(byChannel[ch] ??= []).push(p)
  }
  // separate 기타 from defined channels
  const orderedChannels = [
    ...channelOrder.filter((ch) => (byChannel[ch]?.length ?? 0) > 0),
    ...(byChannel['기타']?.length ? ['기타'] : []),
  ]

  // gap warnings
  const taxGap = proposals_.filter(
    (p) =>
      (p.stage === '정산' || p.settlement_status !== '미정산') &&
      !p.tax_doc_received &&
      p.advertiser_confirmed &&
      p.influencer_confirmed,
  )
  const uploadDeadlineWarning =
    campaign.upload_deadline
      ? new Date(campaign.upload_deadline) <= new Date(Date.now() + 2 * 86400000)
      : false

  const COL = '36px 224px 112px minmax(0,1fr) 160px 112px 116px 92px'

  const tableHeader = (
    <div
      className="grid text-[11px] font-bold text-[#9A9AA5] bg-[#FAFAFB] border-b border-[#F1F1F4] px-4 py-[9px] items-center gap-2"
      style={{ gridTemplateColumns: COL }}
    >
      {/* 선택은 정산 기록으로 이어진다 — 광고주만 */}
      {isAdv ? (
        <input
          type="checkbox"
          checked={selected.size === sheetRows.length && sheetRows.length > 0}
          onChange={toggleAll}
          className="w-[14px] h-[14px] cursor-pointer accent-amber-500"
        />
      ) : (
        <span />
      )}
      <span>인플루언서</span>
      <span>단계</span>
      <span>진행 상황</span>
      <span>업로드 URL</span>
      <span>검사일</span>
      <span>세무자료</span>
      <span className="text-right">정산</span>
    </div>
  )

  const settleTargets = selectedProposals.filter(
    (p) => p.advertiser_confirmed && p.influencer_confirmed && !p.settled_at,
  )
  const reSettleTargets = selectedProposals.filter(
    (p) => !!p.settled_at && !!p.paid_disputed_at,
  )

  const [resettleError, setResettleError] = useState('')

  const handleReSettle = async () => {
    setResettleError('')
    const done: string[] = []
    for (const p of reSettleTargets) {
      const res = await reSettleCampaign(p.id)
      if (res.ok) {
        done.push(p.id)
      } else {
        setResettleError(res.error)
      }
    }
    if (done.length > 0) {
      setProposals((prev) =>
        prev.map((p) =>
          done.includes(p.id) ? { ...p, paid_disputed_at: null, paid_confirmed_at: null } : p,
        ),
      )
    }
    setSelected(new Set())
  }

  const proposalRow = (p: Proposal) => {
    const sidx = stageIndex(p.stage, stages)
    const pct = Math.round(((sidx + 1) / stages.length) * 100)
    const color = stageColor(p.stage, stages)
    const isConfirmed = p.advertiser_confirmed && p.influencer_confirmed
    const cpKind = p.stage ? STAGE_TO_CP[p.stage] : null
    const cp = cpKind ? checkpoints[p.id]?.[cpKind] : null
    const isSettled = !!p.settled_at

    const pendingCancel = pendingCancellations[p.id]
    const cancelled = resolvedCancellations[p.id]

    // D6 A8 — 취소가 수락된 행은 지우지 않고 남기되, 배지+사유로 바꾸고 나머지 칸은 비운다.
    // 확정 플래그는 서버에서 이미 내려가 있어(0067) 모집확정·집행예정액 등 다른 파생값에서는
    // 저절로 빠진다 — 여기서는 이 행 자체의 표시만 다룬다.
    if (cancelled) {
      return (
        <div key={p.id} className="border-b border-[#F5F5F7] last:border-b-0 bg-[#FEF2F2]">
          <div className="grid items-center px-4 py-3 gap-2" style={{ gridTemplateColumns: COL }}>
            <input type="checkbox" checked={false} disabled className="w-[14px] h-[14px] opacity-30" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[#FEE2E2] text-[#B91C1C] text-[11px] font-bold flex items-center justify-center shrink-0">
                {initial(p.profile?.name)}
              </div>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-[#7C7C88] truncate line-through">
                  {p.profile?.name ?? '인플루언서'}
                </p>
                <span className="text-[10px] font-bold bg-[#FEE2E2] text-[#DC2626] rounded px-1.5 py-0.5 whitespace-nowrap">
                  취소 · {cancelled.reason}
                </span>
              </div>
            </div>
            <div className="text-[11.5px] text-[#B0B0BB]">진행 없음</div>
            <div className="text-[11.5px] text-[#C4C4CE]">—</div>
            <div className="text-[11.5px] text-[#C4C4CE]">—</div>
            <div className="text-[11.5px] text-[#C4C4CE]">—</div>
            <div className="text-[11px] text-[#C4C4CE]">—</div>
            <div className="text-right text-[11px] text-[#C4C4CE]">해당 없음</div>
          </div>
        </div>
      )
    }

    return (
      <div key={p.id} className="border-b border-[#F5F5F7] last:border-b-0">
      <div
        className="grid items-center px-4 py-3 hover:bg-[#FAFAFB] transition gap-2"
        style={{ gridTemplateColumns: COL }}
      >
        {/* checkbox */}
        {isAdv ? (
          <input
            type="checkbox"
            checked={selected.has(p.id)}
            onChange={() => toggleSelect(p.id)}
            className="w-[14px] h-[14px] cursor-pointer accent-amber-500"
          />
        ) : (
          <span />
        )}

        {/* 인플루언서 */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-[#FEF3C7] text-[#B45309] text-[11px] font-bold flex items-center justify-center shrink-0">
            {initial(p.profile?.name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[12.5px] font-semibold text-[#17171B] truncate">
                {p.profile?.name ?? '인플루언서'}
              </p>
              <MatchScore
                score={p.influencer_profile?.match_score ?? null}
                reviewCount={p.influencer_profile?.review_count ?? 0}
              />
            </div>
            <p className="text-[11px] text-[#9A9AA5]">
              {p.influencer_profile?.follower_count?.toLocaleString() ?? '—'}명
              {p.budget ? ` · ${(p.budget / 10000).toLocaleString()}만원` : ''}
            </p>
          </div>
          {!isConfirmed && (
            <span className="ml-auto shrink-0 text-[10px] font-bold bg-[#F1F1F4] text-[#9A9AA5] rounded px-1.5 py-0.5 whitespace-nowrap">
              협의중
            </span>
          )}
        </div>

        {/* 단계 — 넘기는 사람은 단계마다 다르다(STAGE_OWNER). 내 차례가 아니면
            버튼 대신 무엇을 기다리는지 한 줄로 보여준다. 버튼만 없으면 멈춘 것처럼 보인다. */}
        <div>
          <span className="text-[11.5px] font-semibold text-[#3C3C46] whitespace-nowrap">
            {stages[sidx]}
          </span>
          {stageMovable(p) && myTurn(p) && (
            <button
              onClick={() => advanceStage(p.id)}
              className="ml-1 text-[10px] text-[#B45309] hover:text-[#D97706] font-bold whitespace-nowrap"
            >
              →
            </button>
          )}
          {stageMovable(p) && !myTurn(p) && (
            <span className="block mt-0.5 text-[10px] leading-[1.3] text-[#9A9AA5]">
              {stageWaitingLine(stageOwnerOf(stages[stageIndex(p.stage, stages)]))}
            </span>
          )}
        </div>

        {/* 진행바 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[#9A9AA5]">{sidx + 1}/{stages.length}</span>
            <span className="text-[10px] text-[#9A9AA5]">{pct}%</span>
          </div>
          <div className="h-[4px] rounded-full bg-[#F1F1F4] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: color }}
            />
          </div>
          <div className="flex gap-[2px] mt-1">
            {stages.map((s, i) => (
              <div
                key={s}
                className="h-[3px] flex-1 rounded-sm"
                style={{ background: i <= sidx ? color : '#F1F1F4' }}
                title={s}
              />
            ))}
          </div>
          {cp && <DeadlineChip cp={cp} />}
        </div>

        {/* 업로드 URL */}
        <div className="min-w-0">
          {p.upload_url ? (
            <a
              href={p.upload_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11.5px] text-[#B45309] underline truncate block"
            >
              {p.upload_url.replace(/^https?:\/\//, '')}
            </a>
          ) : (
            <span className="text-[11.5px] text-[#C4C4CE]">—</span>
          )}
        </div>

        {/* 검사일 */}
        <div className="text-[11.5px]">
          {p.inspection_at ? (
            <span>{p.inspection_at}</span>
          ) : (
            <span className="text-[#C4C4CE]">—</span>
          )}
          {p.inspection_status && p.inspection_status !== '검토중' && (
            <span
              className={`ml-1 text-[10px] font-bold rounded px-1.5 py-0.5 ${
                INSPECTION_STYLE[p.inspection_status] ?? ''
              }`}
            >
              {p.inspection_status}
            </span>
          )}
        </div>

        {/* 세무자료 */}
        <div>
          {p.tax_doc_type ? (
            // D29 PROMPT-4 — 내는 쪽(인플루언서)·받는 쪽(광고주) 둘 다 기록할 수 있다.
            <button
              onClick={() => toggleTaxDoc(p.id, p.tax_doc_received)}
              className={`text-[11px] font-semibold rounded px-2 py-0.5 transition whitespace-nowrap ${
                p.tax_doc_received
                  ? 'bg-[#DCFCE7] text-[#15803D]'
                  : 'bg-[#FEE2E2] text-[#DC2626]'
              }`}
            >
              {p.tax_doc_type} {p.tax_doc_received ? '✓' : '미수령'}
            </button>
          ) : (
            <span className="text-[11px] text-[#C4C4CE]">미설정</span>
          )}
        </div>

        {/* 정산 */}
        <div className="text-right flex flex-col items-end gap-1">
          {isSettled && p.paid_disputed_at ? (
            <span className="text-[11px] font-bold bg-[#FEE2E2] text-[#DC2626] rounded px-2 py-0.5 whitespace-nowrap">
              재정산 필요
            </span>
          ) : isSettled ? (
            <span className="text-[11px] font-bold bg-[#DCFCE7] text-[#15803D] rounded px-2 py-0.5 whitespace-nowrap">
              정산완료
            </span>
          ) : isAdv ? (
            <select
              value={p.settlement_status ?? '미정산'}
              onChange={(e) => setSettlement(p.id, e.target.value)}
              className={`text-[11px] font-bold rounded px-2 py-0.5 border-0 cursor-pointer focus:outline-none ${
                SETTLEMENT_STYLE[p.settlement_status ?? '미정산'] ?? ''
              }`}
            >
              <option value="미정산">미정산</option>
              <option value="정산중">정산중</option>
              <option value="완료">완료</option>
            </select>
          ) : (
            <span
              className={`text-[11px] font-bold rounded px-2 py-0.5 ${
                SETTLEMENT_STYLE[p.settlement_status ?? '미정산'] ?? ''
              }`}
            >
              {p.settlement_status ?? '미정산'}
            </span>
          )}
          {isSettlementDateChanged(p) && (
            <span className="text-[10px] font-semibold text-[#5C5C68]">
              {formatMD(p.settlement_date!)} · {dDayLabel(p.settlement_date)}{' '}
              <span className="text-[#1D4ED8]">(변경)</span>
            </span>
          )}
          {isAdv && !isSettled && (
            <button
              onClick={() =>
                setDateModal({
                  proposalId: p.id,
                  currentLabel: monthDayKo(settlementDateOf(p, campaign)) || null,
                })
              }
              // D29 PROMPT-3 — 「제안」이 빠지면 바로 바뀌는 것처럼 읽혀 줄일 수 없다.
              // 두 줄로 두되 모양을 맞춘다: 좁은 행간 · 위아래 같은 padding · 가운데 정렬 ·
              // 줄바꿈은 「결제일 변경」 / 「제안」 사이에서만(어절을 nowrap 으로 묶어 끊는다).
              className="text-[11.5px] font-semibold text-[#5C5C68] border border-[#E2E2E8] bg-white hover:bg-[#FAFAFB] rounded-[7px] text-center leading-[1.3] px-2.5 py-2"
            >
              <span className="whitespace-nowrap">{isSettlementDateChanged(p) ? '결제일 다시' : '결제일 변경'}</span>{' '}
              <span className="whitespace-nowrap">제안</span>
            </button>
          )}
          {isAdv && p.stage === stages[stages.length - 1] && isConfirmed && !reviewedIds.has(p.id) && (
            <button
              onClick={() =>
                setReviewModal({
                  proposalId: p.id,
                  revieweeId: p.influencer_id,
                  revieweeName: p.profile?.name ?? '인플루언서',
                })
              }
              className="text-[10px] font-bold text-[#F59E0B] hover:text-[#D97706] underline"
            >
              평가하기
            </button>
          )}
          {reviewedIds.has(p.id) && (
            <span className="text-[10px] text-[#9A9AA5]">평가완료</span>
          )}
        </div>
      </div>

      {/* 취소 요청 / 신고 — 진행 중인 요청이 있으면 상태를, 없으면 액션 링크를 보여줌 */}
      <div className="flex items-center gap-3 px-4 pb-2 -mt-1">
        {pendingCancel ? (
          pendingCancel.by_id === userId ? (
            <span className="text-[10px] text-[#9A9AA5]">
              취소 요청함({pendingCancel.reason}) — 상대 수락 대기 중
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#DC2626] font-semibold">
                상대가 취소를 요청했어요({pendingCancel.reason})
              </span>
              <button
                onClick={() => handleAcceptCancellation(pendingCancel.id)}
                className="text-[10px] font-bold text-[#B45309] hover:underline whitespace-nowrap"
              >
                취소 요청 수락
              </button>
            </div>
          )
        ) : (
          !isSettled && (
            <button
              onClick={() => setCancelModal(p.id)}
              className="text-[10px] text-[#9A9AA5] hover:text-[#7C7C88] hover:underline whitespace-nowrap"
            >
              협업 취소 요청
            </button>
          )
        )}
        <button
          onClick={() => setReportModal(p.id)}
          className="text-[10px] text-[#9A9AA5] hover:text-red-600 hover:underline whitespace-nowrap"
        >
          운영팀에 알리기
        </button>
        {/* 상대(= p.influencer_id)에게 거는 제안이라 광고주 쪽에서만 뜬다 */}
        {isAdv && isSettled && (() => {
          const conn = connections[p.influencer_id]
          const active = conn && conn.a_ok && conn.b_ok
          const proposedByMe = conn && !active && ((conn.a_id === userId && conn.a_ok) || (conn.a_id !== userId && conn.b_ok))
          if (active) return <span className="text-[10px] text-[#15803D]">친구등록됨 — 새 캠페인 소식이 먼저 간다</span>
          if (proposedByMe) return <span className="text-[10px] text-[#9A9AA5]">상호 등록 제안함 — 상대 수락 대기</span>
          return (
            <button
              onClick={() => handleProposeConnection(p.influencer_id)}
              disabled={connectionBusy === p.influencer_id}
              className="text-[10px] text-[#9A9AA5] hover:text-[#B45309] hover:underline whitespace-nowrap"
            >
              {connectionBusy === p.influencer_id ? '제안 중...' : '서로 등록 제안'}
            </button>
          )
        })()}
      </div>
      </div>
    )
  }

  return (
    <div className="pb-20">
      {cancelError && (
        <p className="px-4 py-2 text-[12px] text-red-500">{cancelError}</p>
      )}
      {connectionError && (
        <p className="px-4 py-2 text-[12px] text-red-500">{connectionError}</p>
      )}
      {/* 표가 길어 위쪽 배너는 못 볼 수 있다 — 실패는 화면에 붙여 띄운다 */}
      {progressError && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-[#FEE2E2] border border-[#FCA5A5] text-[#B91C1C] text-[12.5px] font-semibold rounded-[10px] px-4 py-2.5 shadow-lg flex items-center gap-3">
          <AlertTriangle size={14} strokeWidth={2} className="shrink-0" />
          <span>{progressError}</span>
          <button onClick={() => setProgressError('')} className="text-[#B91C1C]/60 hover:text-[#B91C1C]">✕</button>
        </div>
      )}
      {reviewModal && (
        <ReviewModal
          proposalId={reviewModal.proposalId}
          reviewerId={userId}
          revieweeId={reviewModal.revieweeId}
          reviewerRole="advertiser"
          revieweeName={reviewModal.revieweeName}
          onClose={() => setReviewModal(null)}
          onDone={() => {
            setReviewedIds((prev) => new Set([...prev, reviewModal.proposalId]))
            setReviewModal(null)
          }}
        />
      )}

      {reportModal && (
        <ReportModal
          proposalId={reportModal}
          role={viewerRole}
          onClose={() => setReportModal(null)}
          onDone={() => setReportModal(null)}
        />
      )}

      {cancelModal && (
        <CancelRequestModal
          proposalId={cancelModal}
          onClose={() => setCancelModal(null)}
          onDone={() => {
            setCancelModal(null)
            loadCancellations()
          }}
        />
      )}

      {settleModal && settleTargets.length > 0 && (
        <SettleConfirmModal
          proposals={settleTargets}
          campaign={campaign}
          recorderName={recorderName}
          onClose={() => setSettleModal(false)}
          onDone={(settledIds) => {
            setProposals((prev) =>
              prev.map((p) =>
                settledIds.includes(p.id)
                  ? { ...p, settled_at: new Date().toISOString(), settlement_status: '완료' }
                  : p,
              ),
            )
            setSelected(new Set())
            setSettleModal(false)
          }}
        />
      )}

      {dateModal && (
        <SettlementDateModal
          currentDateLabel={dateModal.currentLabel}
          onClose={() => setDateModal(null)}
          onSubmit={async (date, reason) => proposeSettlementDate(dateModal.proposalId, date, reason)}
        />
      )}

      {/* ── 헤더 ── */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={backHref ?? (isAdv ? '/advertiser/campaigns' : '/influencer/dashboard')}
              className="text-[13px] text-[#9A9AA5] hover:text-[#5C5C68]"
            >
              {backLabel ?? (isAdv ? '← 캠페인' : '← 뒤로')}
            </Link>
          </div>
          <h1 className="text-[20px] font-extrabold tracking-[-0.02em] text-[#17171B] leading-tight">
            {campaign.title}
          </h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {campaign.campaign_type && (
              <span className="text-[11.5px] font-semibold bg-[#F1F1F4] text-[#5C5C68] rounded px-2 py-0.5">
                {campaign.campaign_type}
              </span>
            )}
            {(campaign.channels ?? []).map((ch) => (
              <span
                key={ch}
                className="text-[11.5px] font-semibold rounded px-2 py-0.5"
                style={{
                  background: CH_GROUP[ch]?.bg ?? '#F1F1F4',
                  color: CH_GROUP[ch]?.text ?? '#5C5C68',
                }}
              >
                {ch}
              </span>
            ))}
            <span className="text-[12px] text-[#7C7C88] inline-flex items-center gap-2.5">
              {campaign.date && (
                <span className="inline-flex items-center gap-1"><CalendarDays size={12} strokeWidth={1.75} />{campaign.date}</span>
              )}
              {campaign.location_city && (
                <span className="inline-flex items-center gap-1"><MapPin size={12} strokeWidth={1.75} />{campaign.location_city} {campaign.location_district ?? ''}</span>
              )}
            </span>
          </div>
        </div>

        {/* Summary stats */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="text-[11px] text-[#9A9AA5]">확정</div>
            <div className="text-[18px] font-extrabold text-[#22C55E] leading-tight">
              {confirmedCount}
              <span className="text-[13px] font-semibold text-[#B0B0BB]">/{campaign.recruit_target ?? '—'}</span>
            </div>
          </div>
          {campaign.budget_total && (
            <div className="text-right">
              <div className="text-[11px] text-[#9A9AA5]">총 예산</div>
              <div className="text-[18px] font-extrabold text-[#17171B] leading-tight tabular-nums">
                {(campaign.budget_total / 10000).toLocaleString()}
                <span className="text-[12px] font-semibold text-[#7C7C88]">만원</span>
              </div>
            </div>
          )}
          {/* 오픈 협업엔 복사할 캠페인 원본이 없다(campaign.id 가 오픈 id) — 광고주 + 캠페인 건에서만 */}
          {isAdv && dealKind === 'campaign' && (
            <Link
              href={`/advertiser/campaigns/new?copy=${campaign.id}`}
              className="text-[12px] font-semibold text-[#7C7C88] border border-[#E2E2E8] rounded-lg px-3 py-2 hover:bg-[#F6F6F7] transition whitespace-nowrap"
            >
              복사 재등록
            </Link>
          )}
        </div>
      </div>

      {/* ── 일정 배너 ── */}
      {(campaign.upload_deadline || campaign.inspection_deadline || campaign.settlement_date) && (
        <div className="flex items-center gap-4 bg-white border border-[#EAEAEE] rounded-[12px] px-4 py-3 mb-4 flex-wrap">
          {campaign.upload_deadline && (
            <div className="text-[12px]">
              <span className="text-[#9A9AA5] mr-1.5">업로드 마감</span>
              <span className={`font-semibold inline-flex items-center gap-1 ${uploadDeadlineWarning ? 'text-[#DC2626]' : 'text-[#3C3C46]'}`}>
                {campaign.upload_deadline}
                {uploadDeadlineWarning && <AlertTriangle size={12} strokeWidth={1.75} />}
              </span>
            </div>
          )}
          {campaign.inspection_deadline && (
            <div className="text-[12px]">
              <span className="text-[#9A9AA5] mr-1.5">검사 마감</span>
              <span className="font-semibold text-[#3C3C46]">{campaign.inspection_deadline}</span>
            </div>
          )}
          {campaign.settlement_date && (
            <div className="text-[12px]">
              <span className="text-[#9A9AA5] mr-1.5">정산 예정일</span>
              <span className="font-semibold text-[#3C3C46]">{campaign.settlement_date}</span>
            </div>
          )}
        </div>
      )}

      {/* ── 갭 경고 배너 ── */}
      {taxGap.length > 0 && (
        <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded-[10px] px-4 py-3 mb-4 flex items-center gap-2">
          <AlertTriangle size={15} strokeWidth={1.75} className="text-[#B45309] shrink-0" />
          <p className="text-[12.5px] text-[#B45309] font-semibold">
            세무자료 미수령 {taxGap.length}명 — 정산 전 수령 여부를 확인하세요.
          </p>
        </div>
      )}

      {/* ── 지원자 (D32 2절) ──
          딜시트 위에 따로 둔다. 아래 표는 「같이 하기로 한 사람들의 진행」이고
          여기는 「아직 답을 안 한 사람들」이라, 한 표에 섞이면 확정 전후가 구분되지 않았다.
          인플루언서에게는 보이지 않는다 — 남의 지원 여부를 볼 자리가 아니다. */}
      {isAdv && dealKind === 'campaign' && (applicants.length > 0 || (reachedTarget && !closedAt)) && (
        <div className="bg-white border border-[#EAEAEE] rounded-[14px] overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-[#F1F1F4] flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-extrabold text-[#17171B]">
              지원자 {applicants.length}명
            </span>
            <span className="text-[12px] font-semibold text-[#9A9AA5]">
              {confirmedCount} / {campaign.recruit_target ?? '—'}명
            </span>
            {closedAt && (
              <span className="text-[10.5px] font-bold bg-[#F1F1F4] text-[#7C7C88] rounded px-2 py-0.5">
                모집 마감
              </span>
            )}
          </div>

          {/* 인원이 찼다고 자동으로 닫지 않는다 — 한 명 더 받고 싶은 경우가 있어서
              알리기만 하고 닫는 것은 광고주가 고른다. */}
          {reachedTarget && !closedAt && (
            <div className="px-4 py-3 bg-[#FFFBEB] border-b border-[#FCD34D] flex items-center gap-2 flex-wrap">
              <AlertTriangle size={15} strokeWidth={1.75} className="text-[#B45309] shrink-0" />
              <p className="text-[12.5px] text-[#B45309] font-semibold">
                {confirmedCount}명 확정 · 모집 인원 도달
              </p>
              <button
                onClick={onCloseRecruiting}
                disabled={applicantBusy !== null}
                className="ml-auto text-[12px] font-bold bg-[#17171B] hover:bg-[#000] disabled:opacity-40 text-white rounded-lg px-3 py-1.5 transition whitespace-nowrap"
              >
                {applicantBusy === '__close__' ? '마감 중…' : '모집 마감'}
              </button>
            </div>
          )}

          {applicantError && (
            <p className="px-4 py-2.5 text-[12px] font-semibold text-[#DC2626] bg-[#FEF2F2] border-b border-[#FEE2E2]">
              {applicantError}
            </p>
          )}

          {applicants.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12.5px] text-[#B0B0BB]">
              아직 답을 기다리는 지원자가 없어요.
            </p>
          ) : (
            applicants.map((p) => {
              const ch = p.influencer_profile?.platforms?.[0] ?? null
              const chStyle = ch ? CH_GROUP[ch] : null
              const busy = applicantBusy === p.id
              return (
                <div key={p.id} className="px-4 py-3 border-b border-[#F5F5F7] last:border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#FEF3C7] text-[#B45309] text-[13px] font-bold flex items-center justify-center shrink-0">
                      {initial(p.profile?.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-[13px] font-bold text-[#17171B] truncate">
                          {p.profile?.name ?? '인플루언서'}
                        </p>
                        {ch && (
                          <span
                            className="text-[10.5px] font-semibold rounded px-1.5 py-0.5 whitespace-nowrap"
                            style={{
                              background: chStyle?.bg ?? '#F1F1F4',
                              color: chStyle?.text ?? '#5C5C68',
                            }}
                          >
                            {ch}
                          </span>
                        )}
                        <span className="text-[11.5px] text-[#7C7C88] whitespace-nowrap">
                          팔로워 {p.influencer_profile?.follower_count?.toLocaleString() ?? '—'}명
                        </span>
                        <MatchScore
                          score={p.influencer_profile?.match_score ?? null}
                          reviewCount={p.influencer_profile?.review_count ?? 0}
                        />
                      </div>
                      <p className="text-[11.5px] text-[#9A9AA5] mt-0.5 truncate">
                        {p.created_at ? `${formatMD(p.created_at)} 지원` : '지원'}
                        {p.message ? ` · ${p.message}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setApplicantError('')
                          setRejectReason('')
                          setRejecting(rejecting === p.id ? null : p.id)
                        }}
                        disabled={busy}
                        className="text-[12px] font-semibold text-[#9A9AA5] hover:text-[#DC2626] disabled:opacity-40 px-2 py-2 transition whitespace-nowrap"
                      >
                        반려
                      </button>
                      <Link
                        href={`/influencer/${p.influencer_id}`}
                        className="text-[12px] font-semibold text-[#5C5C68] border border-[#E2E2E8] rounded-lg px-3 py-2 hover:bg-[#F6F6F7] transition whitespace-nowrap"
                      >
                        프로필
                      </Link>
                      <button
                        onClick={() => onConfirmApplicant(p.id)}
                        disabled={busy}
                        className="text-[12px] font-bold bg-[#17171B] hover:bg-[#000] disabled:opacity-40 text-white rounded-lg px-3 py-2 transition whitespace-nowrap"
                      >
                        {busy ? '처리 중…' : '확정'}
                      </button>
                    </div>
                  </div>

                  {/* 반려 사유는 선택이다. 안 적고 눌러도 반려된다. */}
                  {rejecting === p.id && (
                    <div className="flex items-center gap-2 mt-2.5">
                      <input
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="반려 사유 (선택) — 안 적어도 됩니다"
                        className="flex-1 min-w-0 text-[12.5px] border border-[#E2E2E8] rounded-lg px-3 py-2 outline-none focus:border-[#B0B0BB]"
                      />
                      <button
                        onClick={() => onRejectApplicant(p.id)}
                        disabled={busy}
                        className="text-[12px] font-bold bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-40 text-white rounded-lg px-3 py-2 transition whitespace-nowrap"
                      >
                        반려하기
                      </button>
                      <button
                        onClick={() => { setRejecting(null); setRejectReason('') }}
                        className="text-[12px] font-semibold text-[#9A9AA5] px-2 py-2 whitespace-nowrap"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── 참여자 없음 ── */}
      {sheetRows.length === 0 ? (
        <div className="bg-white border border-[#EAEAEE] rounded-[14px] py-16 text-center">
          <p className="text-[14px] text-[#B0B0BB]">아직 참여한 인플루언서가 없어요.</p>
          <p className="text-[12px] text-[#C4C4CE] mt-1.5">
            인플루언서 찾기에서 대시를 보내거나 신청을 기다려요.
          </p>
          {isAdv && (
            <Link
              href="/advertiser/search"
              className="inline-block mt-4 bg-[#F59E0B] hover:bg-[#D97706] text-white text-[13px] font-bold px-4 py-2 rounded-lg transition whitespace-nowrap"
            >
              인플루언서 찾기 →
            </Link>
          )}
        </div>
      ) : (
        /* ── 채널별 그룹 표 ── */
        <div className="flex flex-col gap-4">
          {orderedChannels.map((ch) => {
            const groupStyle = CH_GROUP[ch] ?? { label: ch, bg: '#F1F1F4', text: '#5C5C68' }
            const rows = byChannel[ch] ?? []
            return (
              <div key={ch} className="bg-white border border-[#EAEAEE] rounded-[14px] overflow-hidden">
                {/* Channel group header */}
                <div
                  className="px-4 py-2.5 flex items-center gap-2"
                  style={{ background: groupStyle.bg }}
                >
                  <span
                    className="text-[12px] font-bold"
                    style={{ color: groupStyle.text }}
                  >
                    {groupStyle.label}
                  </span>
                  <span
                    className="text-[11px] font-semibold opacity-70"
                    style={{ color: groupStyle.text }}
                  >
                    {rows.length}명
                  </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <div className="min-w-[900px]">
                    {tableHeader}
                    {rows.map((p) => proposalRow(p))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 하단 정산 바 ── (기록은 광고주만) */}
      {isAdv && selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#17171B] text-white px-6 py-4 flex items-center gap-4 shadow-[0_-4px_24px_rgba(0,0,0,.35)]">
          <span className="text-[13px] font-semibold">{selected.size}명 선택</span>
          <span className="text-[#9A9AA5] text-[12px]">
            합계 {(selectedBudget / 10000).toLocaleString()}만원
          </span>
          {resettleError && (
            <span className="text-[#FCA5A5] text-[12px]">{resettleError}</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {reSettleTargets.length > 0 && (
              <button
                onClick={handleReSettle}
                className="bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[13px] font-bold px-4 py-2 rounded-lg transition whitespace-nowrap"
              >
                재정산 완료로 기록
              </button>
            )}
            {settleTargets.length > 0 && (
              <button
                onClick={() => setSettleModal(true)}
                className="bg-[#F59E0B] hover:bg-[#D97706] text-white text-[13px] font-bold px-4 py-2 rounded-lg transition whitespace-nowrap"
              >
                정산 완료로 기록
              </button>
            )}
            <button
              onClick={() => setSelected(new Set())}
              className="text-[#9A9AA5] hover:text-white text-[12px] px-3"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
