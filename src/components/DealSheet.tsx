'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// 8-stage pipeline (지역=8단계, 제품/기자단=방문 제외 7단계)
const ALL_STAGES = ['신청', '확정', '가이드', '방문', '업로드', '수정/컴프', '검사', '정산'] as const
type Stage = (typeof ALL_STAGES)[number]

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
  // joined
  profile: { id: string; name: string | null; avatar_url: string | null } | null
  influencer_profile: { follower_count: number | null; platforms: string[] | null } | null
}

type Campaign = {
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
}

function stageIndex(stage: string | null): number {
  const idx = ALL_STAGES.indexOf((stage ?? '신청') as Stage)
  return idx >= 0 ? idx : 0
}

function stageColor(stage: string | null): string {
  const idx = stageIndex(stage)
  if (idx >= 7) return '#22C55E'
  if (idx >= 5) return '#3B82F6'
  if (idx >= 2) return '#F59E0B'
  return '#C4C4CE'
}

export default function DealSheet({
  campaign,
  proposals,
  userId,
}: {
  campaign: Campaign
  proposals: Proposal[]
  userId: string
}) {
  const supabase = createClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [proposals_, setProposals] = useState<Proposal[]>(proposals)

  const isLocation = campaign.campaign_type === '지역'
  const stages = isLocation ? ALL_STAGES : ALL_STAGES.filter((s) => s !== '방문')

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
    if (selected.size === proposals_.length) setSelected(new Set())
    else setSelected(new Set(proposals_.map((p) => p.id)))
  }

  // advance stage
  const advanceStage = async (proposalId: string) => {
    const p = proposals_.find((x) => x.id === proposalId)
    if (!p) return
    const cur = stageIndex(p.stage)
    if (cur >= stages.length - 1) return
    const nextStage = stages[cur + 1]
    const { error } = await supabase.from('proposals').update({ stage: nextStage }).eq('id', proposalId)
    if (!error) {
      setProposals((prev) => prev.map((x) => (x.id === proposalId ? { ...x, stage: nextStage } : x)))
    }
  }

  // tax doc toggle
  const toggleTaxDoc = async (proposalId: string, current: boolean | null) => {
    const { error } = await supabase
      .from('proposals')
      .update({ tax_doc_received: !current })
      .eq('id', proposalId)
    if (!error) {
      setProposals((prev) =>
        prev.map((x) => (x.id === proposalId ? { ...x, tax_doc_received: !current } : x)),
      )
    }
  }

  // update settlement status
  const setSettlement = async (proposalId: string, status: string) => {
    const { error } = await supabase
      .from('proposals')
      .update({ settlement_status: status })
      .eq('id', proposalId)
    if (!error) {
      setProposals((prev) =>
        prev.map((x) => (x.id === proposalId ? { ...x, settlement_status: status } : x)),
      )
    }
  }

  // group proposals by channel (platforms[0] or '기타')
  const byChannel: Record<string, Proposal[]> = {}
  const channelOrder = Object.keys(CH_GROUP)
  for (const p of proposals_) {
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
      <input
        type="checkbox"
        checked={selected.size === proposals_.length && proposals_.length > 0}
        onChange={toggleAll}
        className="w-[14px] h-[14px] cursor-pointer accent-amber-500"
      />
      <span>인플루언서</span>
      <span>단계</span>
      <span>진행 상황</span>
      <span>업로드 URL</span>
      <span>검사일</span>
      <span>세무자료</span>
      <span className="text-right">정산</span>
    </div>
  )

  const proposalRow = (p: Proposal) => {
    const sidx = stageIndex(p.stage)
    const pct = Math.round(((sidx + 1) / stages.length) * 100)
    const color = stageColor(p.stage)
    const isConfirmed = p.advertiser_confirmed && p.influencer_confirmed

    return (
      <div
        key={p.id}
        className="grid items-center px-4 py-3 border-b border-[#F5F5F7] last:border-b-0 hover:bg-[#FAFAFB] transition gap-2"
        style={{ gridTemplateColumns: COL }}
      >
        {/* checkbox */}
        <input
          type="checkbox"
          checked={selected.has(p.id)}
          onChange={() => toggleSelect(p.id)}
          className="w-[14px] h-[14px] cursor-pointer accent-amber-500"
        />

        {/* 인플루언서 */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-[#FEF3C7] text-[#B45309] text-[11px] font-bold flex items-center justify-center shrink-0">
            {p.profile?.name?.[0] ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-[#17171B] truncate">
              {p.profile?.name ?? '인플루언서'}
            </p>
            <p className="text-[11px] text-[#9A9AA5]">
              {p.influencer_profile?.follower_count?.toLocaleString() ?? '—'}명
              {p.budget ? ` · ${(p.budget / 10000).toLocaleString()}만원` : ''}
            </p>
          </div>
          {!isConfirmed && (
            <span className="ml-auto shrink-0 text-[10px] font-bold bg-[#F1F1F4] text-[#9A9AA5] rounded px-1.5 py-0.5">
              협의중
            </span>
          )}
        </div>

        {/* 단계 */}
        <div>
          <span className="text-[11.5px] font-semibold text-[#3C3C46]">
            {p.stage ?? '신청'}
          </span>
          {isConfirmed && sidx < stages.length - 1 && (
            <button
              onClick={() => advanceStage(p.id)}
              className="ml-1 text-[10px] text-[#B45309] hover:text-[#D97706] font-bold"
            >
              →
            </button>
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
        </div>

        {/* 업로드 URL */}
        <div className="min-w-0">
          {p.upload_url ? (
            <a
              href={p.upload_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11.5px] text-[#3B82F6] underline truncate block"
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
            <button
              onClick={() => toggleTaxDoc(p.id, p.tax_doc_received)}
              className={`text-[11px] font-semibold rounded px-2 py-0.5 transition ${
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
        <div className="text-right">
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
        </div>
      </div>
    )
  }

  return (
    <div className="pb-20">
      {/* ── 헤더 ── */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/advertiser/campaigns" className="text-[13px] text-[#9A9AA5] hover:text-[#5C5C68]">
              ← 캠페인
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
            <span className="text-[12px] text-[#7C7C88]">
              {campaign.date && `📅 ${campaign.date}`}
              {campaign.location_city && `　📍 ${campaign.location_city} ${campaign.location_district ?? ''}`}
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
          <Link
            href={`/advertiser/campaigns/new?copy=${campaign.id}`}
            className="text-[12px] font-semibold text-[#7C7C88] border border-[#E2E2E8] rounded-lg px-3 py-2 hover:bg-[#F6F6F7] transition"
          >
            복사 재등록
          </Link>
        </div>
      </div>

      {/* ── 일정 배너 ── */}
      {(campaign.upload_deadline || campaign.inspection_deadline || campaign.settlement_date) && (
        <div className="flex items-center gap-4 bg-white border border-[#EAEAEE] rounded-[12px] px-4 py-3 mb-4 flex-wrap">
          {campaign.upload_deadline && (
            <div className="text-[12px]">
              <span className="text-[#9A9AA5] mr-1.5">업로드 마감</span>
              <span className={`font-semibold ${uploadDeadlineWarning ? 'text-[#DC2626]' : 'text-[#3C3C46]'}`}>
                {campaign.upload_deadline}
                {uploadDeadlineWarning && ' ⚠️'}
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
          <span className="text-[#B45309] text-sm">⚠️</span>
          <p className="text-[12.5px] text-[#B45309] font-semibold">
            세무자료 미수령 {taxGap.length}명 — 정산 전 수령 여부를 확인하세요.
          </p>
        </div>
      )}

      {/* ── 참여자 없음 ── */}
      {proposals_.length === 0 ? (
        <div className="bg-white border border-[#EAEAEE] rounded-[14px] py-16 text-center">
          <p className="text-[14px] text-[#B0B0BB]">아직 참여한 인플루언서가 없어요.</p>
          <p className="text-[12px] text-[#C4C4CE] mt-1.5">
            인플루언서 찾기에서 대시를 보내거나 신청을 기다려요.
          </p>
          <Link
            href="/advertiser/search"
            className="inline-block mt-4 bg-[#F59E0B] hover:bg-[#D97706] text-white text-[13px] font-bold px-4 py-2 rounded-lg transition"
          >
            인플루언서 찾기 →
          </Link>
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

      {/* ── 하단 정산 바 (선택된 인플루언서 있을 때) ── */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#17171B] text-white px-6 py-4 flex items-center gap-4 shadow-[0_-4px_24px_rgba(0,0,0,.35)]">
          <span className="text-[13px] font-semibold">{selected.size}명 선택</span>
          <span className="text-[#9A9AA5] text-[12px]">
            합계 {(selectedBudget / 10000).toLocaleString()}만원
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => {
                if (confirm(`선택한 ${selected.size}명의 정산을 '완료'로 처리할까요?`)) {
                  selectedProposals.forEach((p) => setSettlement(p.id, '완료'))
                  setSelected(new Set())
                }
              }}
              className="bg-[#F59E0B] hover:bg-[#D97706] text-white text-[13px] font-bold px-4 py-2 rounded-lg transition shadow-[0_1px_2px_rgba(245,158,11,.35)]"
            >
              정산 처리
            </button>
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
