'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

type Campaign = {
  id: string
  title: string
  date: string | null
  recruit_start: string | null
  recruit_end: string | null
  channels: string[] | null
  campaign_type: string | null
  budget_total: number | null
  recruit_target: number | null
  location_city: string | null
  location_district: string | null
  derivedStatus: '진행중' | '마감' | '캔슬' | '완료'
  stats: { total: number; confirmed: number; negotiating: number }
}

const STATUS_STYLE: Record<string, string> = {
  진행중: 'bg-[#FEF3C7] text-[#B45309]',
  완료:   'bg-[#DCFCE7] text-[#15803D]',
  마감:   'bg-[#F1F1F4] text-[#7C7C88]',
  캔슬:   'bg-[#FEE2E2] text-[#DC2626]',
}

// 캔슬 → 취소 (표시용)
const statusLabel = (s: string) => s === '캔슬' ? '취소' : s

// 채널 단축 이모지
const CH_ICON: Record<string, string> = { 블로그: '✍️', 유튜브: '▶️', 인스타그램: '📷', 틱톡: '🎵' }

type FilterTab = '전체' | '진행중' | '마감' | '완료' | '취소'
type SortKey = 'date_desc' | 'date_asc' | 'budget_desc' | 'budget_asc'
const SORT_LABELS: Record<SortKey, string> = {
  date_desc: '날짜 최신순',
  date_asc:  '날짜 오래된순',
  budget_desc: '예산 높은순',
  budget_asc:  '예산 낮은순',
}

export default function MyCampaignsList({ campaigns }: { campaigns: Campaign[] }) {
  const [tab, setTab]     = useState<FilterTab>('전체')
  const [search, setSearch] = useState('')
  const [sort, setSort]   = useState<SortKey>('date_desc')

  const tabs: FilterTab[] = ['전체', '진행중', '마감', '완료', '취소']

  const filtered = useMemo(() => {
    let list = campaigns
    if (tab !== '전체') {
      list = list.filter((c) => statusLabel(c.derivedStatus) === tab)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((c) => c.title.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      if (sort === 'date_desc')   return (b.date ?? '').localeCompare(a.date ?? '')
      if (sort === 'date_asc')    return (a.date ?? '').localeCompare(b.date ?? '')
      if (sort === 'budget_desc') return (b.budget_total ?? 0) - (a.budget_total ?? 0)
      return (a.budget_total ?? 0) - (b.budget_total ?? 0)
    })
  }, [campaigns, tab, search, sort])

  const tabCount = (t: FilterTab) => {
    if (t === '전체') return campaigns.length
    return campaigns.filter((c) => statusLabel(c.derivedStatus) === t).length
  }

  return (
    <div>
      {/* ── 상단 컨트롤 바 ── */}
      <div className="flex flex-col gap-3 mb-4 [.adv-pc_&]:flex-row [.adv-pc_&]:items-center [.adv-pc_&]:gap-4">
        {/* 필터 탭 */}
        <div className="flex gap-0 border-b border-[#EAEAEE] [.adv-pc_&]:border-b-0 [.adv-pc_&]:gap-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-[12.5px] font-semibold transition relative
                [.adv-pc_&]:rounded-md [.adv-pc_&]:px-3 [.adv-pc_&]:py-1.5
                ${tab === t
                  ? '[.adv-pc_&]:bg-[#FEF3C7] [.adv-pc_&]:text-[#B45309] text-[#B45309] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-amber-600 [.adv-pc_&]:after:hidden'
                  : 'text-[#7C7C88] hover:text-[#3C3C46] [.adv-pc_&]:hover:bg-[#F6F6F7]'
                }`}
            >
              {t}
              <span className={`ml-1 text-[11px] font-bold ${tab === t ? 'text-[#D97706]' : 'text-[#B0B0BB]'}`}>
                {tabCount(t)}
              </span>
            </button>
          ))}
        </div>

        {/* 검색 + 정렬 (PC only) */}
        <div className="hidden [.adv-pc_&]:flex items-center gap-2 ml-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="캠페인 검색..."
            className="border border-[#EAEAEE] rounded-lg px-3 py-[7px] text-[13px] w-52 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="border border-[#EAEAEE] rounded-lg px-3 py-[7px] text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>{SORT_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── PC: 7열 표 ── */}
      <div className="hidden [.adv-pc_&]:block bg-white rounded-2xl border border-[#EAEAEE] overflow-hidden">
        {/* 표 헤더 */}
        <div
          className="grid text-[11px] font-bold text-[#9A9AA5] bg-[#FAFAFB] border-b border-[#F1F1F4] px-5 py-[9px]"
          style={{ gridTemplateColumns: 'minmax(0,1fr) 92px 150px 122px 158px 128px 108px' }}
        >
          <span>캠페인</span>
          <span className="text-center">상태</span>
          <span>유형·채널</span>
          <span>진행일</span>
          <span>모집현황</span>
          <span className="text-right">확정예산</span>
          <span className="text-right">액션</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-[#C4C4CE]">
            {search ? `"${search}" 검색 결과가 없어요.` : '해당 상태의 캠페인이 없어요.'}
          </div>
        ) : (
          filtered.map((c, i) => {
            const confirmed = c.stats.confirmed
            const target    = c.recruit_target ?? 0
            const pct       = target > 0 ? Math.min(100, Math.round((confirmed / target) * 100)) : 0
            const barColor  = c.derivedStatus === '진행중' ? '#22C55E'
                            : c.derivedStatus === '완료'   ? '#3B82F6'
                            : '#C4C4CE'
            return (
              <div
                key={c.id}
                className="grid items-center px-5 py-[13px] border-b border-[#F5F5F7] last:border-b-0 hover:bg-[#FAFAFB] transition cursor-pointer group"
                style={{ gridTemplateColumns: 'minmax(0,1fr) 92px 150px 122px 158px 128px 108px' }}
              >
                {/* 캠페인 */}
                <Link href={`/advertiser/campaigns/${c.id}`} className="min-w-0 block">
                  <p className="text-[13.5px] font-semibold text-[#17171B] truncate">{c.title}</p>
                  <p className="text-[11.5px] text-[#9A9AA5] mt-0.5 truncate">
                    {[c.campaign_type, c.channels?.join('·'), c.location_city].filter(Boolean).join(' · ')}
                  </p>
                </Link>

                {/* 상태 */}
                <div className="flex justify-center">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_STYLE[c.derivedStatus]}`}>
                    {statusLabel(c.derivedStatus)}
                  </span>
                </div>

                {/* 유형·채널 */}
                <div className="min-w-0">
                  {c.campaign_type && (
                    <span className="text-[11px] font-semibold bg-[#F1F1F4] text-[#5C5C68] rounded px-2 py-0.5 mr-1">{c.campaign_type}</span>
                  )}
                  <span className="text-[12px] text-[#7C7C88]">
                    {(c.channels ?? []).map((ch) => CH_ICON[ch] ?? ch).join(' ')}
                  </span>
                </div>

                {/* 진행일 */}
                <div className="text-[12.5px] text-[#5C5C68]">
                  {c.date ?? <span className="text-[#C4C4CE]">—</span>}
                </div>

                {/* 모집현황 */}
                <div>
                  <p className="text-[12.5px] font-semibold text-[#3C3C46]">
                    확정 {confirmed}<span className="text-[#B0B0BB] font-normal">/{target || '—'}</span>
                  </p>
                  {target > 0 && (
                    <div className="mt-1 w-[78px] h-[4px] rounded-full bg-[#F1F1F4] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                  )}
                </div>

                {/* 확정예산 */}
                <div className="text-right">
                  {c.budget_total
                    ? <span className="text-[12.5px] font-semibold text-[#3C3C46] tabular-nums">{(c.budget_total / 10000).toLocaleString()}만원</span>
                    : <span className="text-[#C4C4CE]">—</span>
                  }
                </div>

                {/* 액션 */}
                <div className="flex items-center justify-end gap-1.5">
                  <Link
                    href={`/advertiser/campaigns/${c.id}`}
                    className="text-[11.5px] font-semibold text-[#B45309] border border-[#FDE68A] rounded-md px-2.5 py-1 hover:bg-[#FEF3C7] transition"
                    onClick={(e) => e.stopPropagation()}
                  >
                    딜시트
                  </Link>
                  <Link
                    href={`/advertiser/campaigns/new?copy=${c.id}`}
                    className="text-[11.5px] font-semibold text-[#7C7C88] border border-[#E2E2E8] rounded-md px-2.5 py-1 hover:bg-[#F6F6F7] transition"
                    onClick={(e) => e.stopPropagation()}
                    title="복사 재등록"
                  >
                    복사
                  </Link>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── 모바일: 카드 목록 ── */}
      <div className="space-y-2 [.adv-pc_&]:hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 bg-white rounded-2xl p-4 shadow-sm">
            {search || tab !== '전체' ? '해당 캠페인이 없어요.' : '아직 등록한 캠페인이 없어요.'}
          </p>
        ) : (
          filtered.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-amber-400">
              <Link href={`/advertiser/campaigns/${c.id}`} className="block hover:opacity-70 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{c.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {c.date && `📅 ${c.date}`}{c.location_city && `　📍 ${c.location_city} ${c.location_district ?? ''}`}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE[c.derivedStatus]}`}>
                    {statusLabel(c.derivedStatus)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="text-gray-600">👥 참여 {c.stats.total}</span>
                  <span className="text-green-600">확정 {c.stats.confirmed}</span>
                  <span className="text-amber-600">협의중 {c.stats.negotiating}</span>
                </div>
              </Link>
              <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-gray-50">
                <Link href={`/advertiser/campaigns/${c.id}`} className="text-xs text-amber-600 font-medium">
                  딜시트 →
                </Link>
                <Link
                  href={`/advertiser/campaigns/new?copy=${c.id}`}
                  className="ml-auto text-xs text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200"
                >
                  📋 복사 재등록
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
