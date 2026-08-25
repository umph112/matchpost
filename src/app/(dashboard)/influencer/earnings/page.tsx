'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Download, Phone } from 'lucide-react'
import PaidConfirmModal from '@/components/PaidConfirmModal'
import InfluencerPaidReceivedModal from '@/components/InfluencerPaidReceivedModal'
import { kstDateString, dDayLabel, listDateLabel } from '@/lib/date'
import { settlementDateOf } from '@/lib/deals/settlementDate'
import { SkelBar } from '@/components/Skeleton'

type OverdueRow = {
  campaignId: string
  title: string
  advertiserId: string
  proposalId: string
  settlementDate: string
  budget: number | null
  reminderCount: number
  companyName: string | null
  managerName: string | null
  phone: string | null
}

type EarningStatus = '예정' | '미수' | '확인 대기' | '완료'

type EarningRow = {
  id: string
  budget: number | null
  brandName: string | null
  companyName: string | null
  campaignTitle: string | null
  settlementDate: string | null
  status: EarningStatus
  advertiserId: string
}

const STATUS_FILTERS = ['전체', '예정', '미수', '확인 대기', '완료']

type PendingProposal = {
  id: string
  budget: number | null
  settled_at: string | null
  advertiser_id: string
  campaign: { title: string; manager_phone: string | null; company_phone: string | null } | null
  advertiser_profile: { name: string | null; manager_phone: string | null; company_phone: string | null } | null
  company_name?: string | null
}

export default function EarningsPage() {
  const [earnRows, setEarnRows] = useState<EarningRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('전체')
  const [period, setPeriod] = useState('이번달')
  const [pendingConfirm, setPendingConfirm] = useState<PendingProposal[]>([])
  const [confirmModal, setConfirmModal] = useState(false)
  const [overdue, setOverdue] = useState<OverdueRow[]>([])
  const [paidModal, setPaidModal] = useState<OverdueRow | null>(null)
  const [showMovedOnly, setShowMovedOnly] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // ── 정산 목록/요약 원본: 양쪽 확정된 proposals (합의된 건) ──
    // 귀속 기준 = settlementDateOf(proposal, campaign). 사람별 합의(proposals.settlement_date)가
    // 있으면 그 날짜, 없으면 campaigns.settlement_date. D20 §2.
    const { data: props } = await supabase
      .from('proposals')
      .select('id, budget, settled_at, paid_confirmed_at, paid_disputed_at, settlement_status, advertiser_id, campaign_id, settlement_date')
      .eq('influencer_id', user.id)
      .eq('advertiser_confirmed', true)
      .eq('influencer_confirmed', true)

    const propRows = props ?? []
    const cIds = [...new Set(propRows.map((p) => p.campaign_id).filter(Boolean))]
    const aIds = [...new Set(propRows.map((p) => p.advertiser_id).filter(Boolean))]

    const campById: Record<string, { title: string; brand_name: string | null; settlement_date: string | null }> = {}
    if (cIds.length > 0) {
      const { data: camps } = await supabase
        .from('campaigns')
        .select('id, title, brand_name, settlement_date')
        .in('id', cIds)
      ;(camps ?? []).forEach((c) => { campById[c.id] = c })
    }
    const companyByAdv: Record<string, string | null> = {}
    if (aIds.length > 0) {
      // 남의 회사명이라 advertiser_public 뷰로 읽는다(0095)
      const { data: aps } = await supabase
        .from('advertiser_public')
        .select('user_id, company_name')
        .in('user_id', aIds)
      ;(aps ?? []).forEach((a) => { companyByAdv[a.user_id] = a.company_name })
    }

    const today = kstDateString()
    const list: EarningRow[] = propRows.map((p) => {
      const c = p.campaign_id ? campById[p.campaign_id] : null
      const settlementDate = settlementDateOf(p, c)
      let status: EarningStatus
      if (p.paid_confirmed_at || p.settlement_status === '완료') status = '완료'
      else if (p.settled_at && !p.paid_confirmed_at && !p.paid_disputed_at) status = '확인 대기'
      else if (settlementDate && settlementDate < today) status = '미수'
      else status = '예정'
      return {
        id: p.id,
        budget: p.budget,
        brandName: c?.brand_name ?? null,
        companyName: companyByAdv[p.advertiser_id] ?? null,
        campaignTitle: c?.title ?? null,
        settlementDate,
        status,
        advertiserId: p.advertiser_id,
      }
    })
    setEarnRows(list)

    // ── 수금 확인 대기 (배너+모달): 항상 전체. [기존 로직 그대로] ──
    const { data: pending } = await supabase
      .from('proposals')
      .select(`
        id, budget, settled_at, advertiser_id,
        campaign:campaigns(title, manager_phone, company_phone),
        advertiser_profile:profiles!proposals_advertiser_id_fkey(name, manager_phone, company_phone)
      `)
      .eq('influencer_id', user.id)
      .not('settled_at', 'is', null)
      .is('paid_confirmed_at', null)
      .is('paid_disputed_at', null)

    const rows = (pending as unknown as PendingProposal[]) ?? []
    const advIds = [...new Set(rows.map((r) => r.advertiser_id))]
    if (advIds.length > 0) {
      // 남의 회사명이라 advertiser_public 뷰로 읽는다(0095)
      const { data: advProfiles } = await supabase
        .from('advertiser_public')
        .select('user_id, company_name')
        .in('user_id', advIds)
      const companyByAdv = Object.fromEntries((advProfiles ?? []).map((a) => [a.user_id, a.company_name]))
      rows.forEach((r) => { r.company_name = companyByAdv[r.advertiser_id] ?? null })
    }

    setPendingConfirm(rows)

    // ── 미수 카드: 항상 전체. 판정 = settlementDateOf(proposal, campaign) < 오늘. D20 §2 ──
    const { data: myProps } = await supabase
      .from('proposals')
      .select('id, campaign_id, advertiser_id, budget, settlement_status, advertiser_confirmed, influencer_confirmed, settlement_date, overdue_reminder_count')
      .eq('influencer_id', user.id)
      .eq('advertiser_confirmed', true)
      .eq('influencer_confirmed', true)
      .neq('settlement_status', '완료')
    const campIds = [...new Set((myProps ?? []).map((p) => p.campaign_id).filter(Boolean))]
    if (campIds.length > 0) {
      const today = kstDateString()
      // 사람별 합의 날짜(proposals.settlement_date)가 캠페인 기본값을 덮으므로 날짜 컷은 JS 에서 한다.
      // campaigns.overdue_reminder_count 는 더 이상 증가하지 않으므로 조회 대상에서 뺀다(카운터는 proposal 로 이동).
      const { data: camps } = await supabase
        .from('campaigns')
        .select('id, title, settlement_date, manager_phone, company_phone')
        .in('id', campIds)
      const campById = Object.fromEntries((camps ?? []).map((c) => [c.id, c]))
      const baseRows = (myProps ?? []).filter((p) => {
        const camp = p.campaign_id ? campById[p.campaign_id] : null
        const d = settlementDateOf(p, camp)
        return !!d && d < today
      })

      // 미수 카드 표기용 — 광고주 회사명(advertiser_profiles) · 담당자명(profiles) 배치 조회
      const advIds = [...new Set(baseRows.map((p) => p.advertiser_id))]
      const companyByAdv: Record<string, string | null> = {}
      const nameByAdv: Record<string, string | null> = {}
      const profManagerByAdv: Record<string, string | null> = {}
      const profCompanyByAdv: Record<string, string | null> = {}
      if (advIds.length > 0) {
        // 남의 회사명이라 advertiser_public 뷰로 읽는다(0095)
        const { data: aps } = await supabase
          .from('advertiser_public')
          .select('user_id, company_name')
          .in('user_id', advIds)
        ;(aps ?? []).forEach((a) => { companyByAdv[a.user_id] = a.company_name })
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, name, manager_phone, company_phone')
          .in('id', advIds)
        ;(profs ?? []).forEach((p) => {
          nameByAdv[p.id] = p.name
          profManagerByAdv[p.id] = p.manager_phone
          profCompanyByAdv[p.id] = p.company_phone
        })
      }

      // 연락처 우선순위 = PaidConfirmModal과 동일: 캠페인 담당자 › 광고주 담당자 › 캠페인 대표 › 광고주 대표
      const overdueRows: OverdueRow[] = baseRows
        .map((p) => {
          const camp = campById[p.campaign_id as string]
          return {
            campaignId: p.campaign_id as string,
            title: camp.title,
            advertiserId: p.advertiser_id,
            proposalId: p.id,
            settlementDate: settlementDateOf(p, camp) as string,
            budget: p.budget,
            reminderCount: p.overdue_reminder_count ?? 0,
            companyName: companyByAdv[p.advertiser_id] ?? null,
            managerName: nameByAdv[p.advertiser_id] ?? null,
            phone:
              camp.manager_phone ??
              profManagerByAdv[p.advertiser_id] ??
              camp.company_phone ??
              profCompanyByAdv[p.advertiser_id] ??
              null,
          }
        })
      setOverdue(overdueRows)
    } else {
      setOverdue([])
    }

    setLoading(false)
  }

  // A9 — 캠페인 맥락 알림은 새 대화를 만들지 않고 기존 대화로 들어간다.
  // 인플루언서는 항상 1:1이므로(A1) 그 광고주와의 개인 대화로 이동한다.
  const inquireInChat = async (r: OverdueRow) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: convId } = await supabase.rpc('get_or_create_conversation', {
      p_advertiser_id: r.advertiserId, p_kind: 'personal', p_campaign_id: null, p_other_id: user.id,
    })
    if (convId) router.push(`/influencer/messages/${convId}`)
  }

  const now = new Date()
  const thisMonth = now.getMonth() + 1
  const thisYear = now.getFullYear()

  // 기간 스코프 — settlement_date(결제 예정일) 기준
  const inPeriod = earnRows.filter((r) => {
    if (!r.settlementDate) return period === '전체'
    const y = Number(r.settlementDate.slice(0, 4))
    const m = Number(r.settlementDate.slice(5, 7))
    if (period === '이번달') return y === thisYear && m === thisMonth
    if (period === '올해') return y === thisYear
    return true
  })

  // PROMPT-5 ④ 예정일이 밀려 다음 달로 넘어간 건 — 자리만 잡아둔다.
  // 현재 스키마엔 원래 예정일(변경 이력)이 없어 감지 불가 → 항상 0건(정상).
  // 결제일 변경 경로(원래 예정일 vs 새 예정일 기록)가 생기면 여기서 채운다.
  const movedOut: EarningRow[] = []
  const movedOutTotal = movedOut.reduce((s, r) => s + (r.budget ?? 0), 0)
  const movedOutIds = new Set(movedOut.map((r) => r.id))

  const listRows = inPeriod
    .filter((r) => (showMovedOnly ? movedOutIds.has(r.id) : filter === '전체' || r.status === filter))
    .sort((a, b) => (b.settlementDate ?? '').localeCompare(a.settlementDate ?? ''))

  // 요약 — 총매출·예정·확인대기는 기간 스코프
  const totalAmount = inPeriod.reduce((s, r) => s + (r.budget ?? 0), 0)
  const pendingAmount = inPeriod.filter((r) => r.status === '예정').reduce((s, r) => s + (r.budget ?? 0), 0)
  const awaitingAmount = inPeriod.filter((r) => r.status === '확인 대기').reduce((s, r) => s + (r.budget ?? 0), 0)

  // 미수 요약칸 — 항상 전체(기간 무관). 미수 카드 합과 동일하게 overdue에서 계산.
  const overdueTotal = overdue.reduce((s, r) => s + (r.budget ?? 0), 0)

  // 수금 확인 대기 배너 — 항상 전체
  const pendingConfirmTotal = pendingConfirm.reduce((s, p) => s + (p.budget ?? 0), 0)

  // 버튼은 헤더에 있어서 목록보다 먼저 살아난다(실측 300ms). 그때 누르면 머리글만 있는
  // 빈 CSV 가 조용히 받아지고, 사람은 「매출이 0건이구나」로 읽는다. 그래서 막는다.
  const csvDisabled = loading || listRows.length === 0

  const handleDownloadCSV = () => {
    if (csvDisabled) return
    const headers = ['날짜', '브랜드', '캠페인', '금액', '상태']
    const rows = listRows.map((r) => [
      r.settlementDate ?? '',
      r.brandName ?? r.companyName ?? '',
      r.campaignTitle ?? '',
      r.budget ?? 0,
      r.status,
    ])
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `매출내역_${period}.csv`
    a.click()
  }

  const statusBadge = (status: EarningStatus): { bg: string; fg: string } => {
    if (status === '예정') return { bg: '#F1F1F4', fg: '#5C5C68' }
    if (status === '미수') return { bg: '#FEE2E2', fg: '#DC2626' }
    if (status === '확인 대기') return { bg: '#FEF3C7', fg: '#B45309' }
    return { bg: '#DCFCE7', fg: '#15803D' } // 완료
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 [.inf-pc_&]:max-w-none [.inf-pc_&]:px-0 [.inf-pc_&]:py-0">
      {confirmModal && pendingConfirm.length > 0 && (
        <PaidConfirmModal
          proposals={pendingConfirm}
          onClose={() => setConfirmModal(false)}
          onDone={() => {
            setConfirmModal(false)
            fetchAll()
          }}
        />
      )}

      {paidModal && (
        <InfluencerPaidReceivedModal
          proposalId={paidModal.proposalId}
          campaignTitle={paidModal.title}
          budget={paidModal.budget}
          settlementDate={paidModal.settlementDate}
          onClose={() => setPaidModal(null)}
          onDone={() => {
            setPaidModal(null)
            fetchAll()
          }}
        />
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href="/influencer/dashboard" className="hidden [.inf-pc_&]:inline-block mr-4 text-gray-400 hover:text-gray-600">
            ← 뒤로
          </Link>
          <h1 className="text-xl font-bold text-gray-900">매출 관리</h1>
        </div>
        <button
          onClick={handleDownloadCSV}
          disabled={csvDisabled}
          title={loading ? '매출을 불러오는 중이에요' : listRows.length === 0 ? '받을 매출 내역이 없어요' : undefined}
          className="flex items-center gap-1.5 text-sm text-[#B45309] border border-[#FCD34D] px-3 py-1.5 rounded-lg hover:bg-[#FEF3C7] transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <Download size={14} strokeWidth={1.75} /> CSV 다운로드
        </button>
      </div>

      {/* 수금 확인 대기 배너 — 항상 전체 */}
      {pendingConfirm.length > 0 && (
        <button
          onClick={() => setConfirmModal(true)}
          className="w-full mb-5 flex items-center justify-between bg-[#FEF3C7] border border-[#FCD34D] rounded-2xl px-4 py-3 hover:bg-[#FDE68A] transition"
        >
          <div className="text-left">
            <p className="text-xs font-semibold text-[#B45309]">수금 확인 대기</p>
            <p className="text-sm font-bold text-[#17171B]">
              {pendingConfirmTotal.toLocaleString()}원 · {pendingConfirm.length}건
            </p>
          </div>
          <span className="text-[#B45309] font-bold text-sm">확인 →</span>
        </button>
      )}

      {/* D6 A9/C1 — 미수 카드: 신고가 아니라 대시에서 문의하기. 항상 전체 */}
      {overdue.length > 0 && (
        <div className="mb-5 space-y-2">
          {overdue.map((r) => (
            <div key={r.proposalId} className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#DC2626] flex items-center gap-1.5">
                  미수 · {r.title}
                  <span className="bg-[#DC2626] text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold">{dDayLabel(r.settlementDate)}</span>
                </p>
                <p className="text-[11px] text-[#B91C1C] mt-0.5">
                  <Link href={`/advertiser/${r.advertiserId}`} className="font-semibold hover:underline">
                    {r.companyName ?? '광고주'}
                  </Link>
                  {r.managerName && <span className="text-[#17171B]"> / {r.managerName}</span>}
                </p>
                {r.phone && (
                  <a
                    href={`tel:${r.phone}`}
                    className="inline-flex items-center gap-1 min-h-[44px] text-[12px] font-semibold text-[#DC2626] hover:underline"
                  >
                    <Phone size={13} strokeWidth={1.75} className="shrink-0" /> {r.phone}
                  </a>
                )}
                <p className="text-[11px] text-[#B91C1C] mt-0.5">
                  정산 예정일 {listDateLabel(r.settlementDate + 'T00:00:00')}
                  {r.budget != null && ` · ${r.budget.toLocaleString()}원`}
                  {r.reminderCount > 0 && ` · 지연 알림 ${r.reminderCount}회 발송 (매일 1회)`}
                </p>
              </div>
              <div className="shrink-0 flex flex-col gap-1.5">
                <button
                  onClick={() => inquireInChat(r)}
                  className="text-xs font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] px-3 py-1.5 rounded-lg whitespace-nowrap"
                >
                  대시에서 문의하기
                </button>
                <button
                  onClick={() => setPaidModal(r)}
                  className="text-[11.5px] font-bold text-[#DC2626] bg-white border border-[#FECACA] px-3 py-1.5 rounded-lg hover:bg-[#FEF2F2] whitespace-nowrap"
                >
                  입금 받았어요
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 기간 선택 */}
      <div className="flex gap-2 mb-6">
        {['이번달', '올해', '전체'].map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              period === p
                ? 'bg-[#F59E0B] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* 요약 카드 — 4칸 (PC 4열 / 모바일 2×2) */}
      <div className="grid grid-cols-2 [.inf-pc_&]:grid-cols-4 gap-4 mb-3">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">총 매출</p>
          <p className="text-xl font-bold text-[#B45309]">{totalAmount.toLocaleString()}원</p>
          <p className="mt-0.5 text-[10.5px] text-[#9A9AA5]">이 기간에 잡힌 전체</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">예정 매출</p>
          <p className="text-xl font-bold text-orange-500">{pendingAmount.toLocaleString()}원</p>
          <p className="mt-0.5 text-[10.5px] text-[#9A9AA5]">예정일이 아직 안 지난 건</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">미수</p>
          <p className={`text-xl font-bold ${overdueTotal > 0 ? 'text-[#DC2626]' : 'text-gray-400'}`}>{overdueTotal.toLocaleString()}원</p>
          <p className="mt-0.5 text-[10.5px] text-[#9A9AA5]">기간 무관 · 받아야 할 전액</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">확인 대기</p>
          <p className="text-xl font-bold text-[#B45309]">{awaitingAmount.toLocaleString()}원</p>
          <p className="mt-0.5 text-[10.5px] text-[#9A9AA5]">입금 확인을 기다리는 중</p>
        </div>
      </div>

      {/* 기준선 */}
      <p className="text-[11px] text-[#9A9AA5] leading-relaxed mb-6">
        매출은 합의된 결제 예정일을 기준으로 잡힙니다. 입금이 늦으면 미수로 표시되고, 확인되면 원래 예정일의 매출로 확정됩니다.
      </p>

      {/* PROMPT-5 ④ 예정일이 밀려 다음 달로 넘어간 건 — 0건이면 렌더하지 않음 */}
      {movedOut.length > 0 && (
        <button
          onClick={() => { setFilter('전체'); setShowMovedOnly(true) }}
          className="mb-4 text-left text-[11.5px] text-[#B45309] hover:underline"
        >
          예정일이 밀려 다음 달로 넘어간 건 {movedOut.length}건 · {movedOutTotal.toLocaleString()}원
        </button>
      )}

      {/* 상태 필터 */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => { setFilter(s); setShowMovedOnly(false) }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
              filter === s
                ? 'bg-[#F59E0B] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* 매출 목록 — 기간 스코프 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {/* D31 2절 — loading.tsx 골격에서 이어지도록 여기도 골격으로 둔다.
            글자로 바꾸면 「골격 → 글자 → 값」으로 두 번 깜빡인다. */}
        {loading && (
          <div className="p-4 space-y-3">
            <SkelBar w="100%" h={44} />
            <SkelBar w="100%" h={44} />
            <SkelBar w="72%" h={44} />
          </div>
        )}

        {!loading && listRows.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">매출 내역이 없어요</p>
          </div>
        )}

        {listRows.map((r, index) => {
          const badge = statusBadge(r.status)
          return (
            <div
              key={r.id}
              className={`flex items-center justify-between p-4 ${
                index !== listRows.length - 1 ? 'border-b border-gray-50' : ''
              }`}
            >
              <div className="min-w-0">
                {/* PROMPT-5 ⑤ 출처 배지 — 지금은 전부 매치포스트 고정. 직접 등록 건이 생기면 「직접 등록」으로 분기 */}
                <span className="inline-block mb-1 text-[9.5px] font-bold text-[#5C5C68] bg-[#F1F1F4] rounded px-1.5 py-0.5">매치포스트</span>
                <p className="text-[12.5px] font-bold text-gray-800 truncate">{r.brandName ?? r.companyName ?? '광고주'}</p>
                {r.campaignTitle && <p className="text-[11px] text-[#9A9AA5] mt-0.5 truncate">{r.campaignTitle}</p>}
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {r.settlementDate ? listDateLabel(r.settlementDate + 'T00:00:00') : '예정일 미정'}
                  {r.status === '미수' && r.settlementDate && ` · ${dDayLabel(r.settlementDate)}`}
                </p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-[13px] font-bold text-gray-800 tabular-nums">{(r.budget ?? 0).toLocaleString()}원</p>
                <span
                  className="inline-block mt-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: badge.bg, color: badge.fg }}
                >
                  {r.status}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
