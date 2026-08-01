'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { INFLUENCER_CATEGORIES } from '@/lib/categories'
import MatchScore from '@/components/MatchScore'

const REGIONS = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '강원', '충남', '충북', '전남', '전북', '경남', '경북', '제주']
const CHANNELS = ['블로그', '유튜브', '인스타그램', '틱톡']

type GroupMode = '날짜별' | '인플루언서별'
type SortKey = 'date_asc' | 'fee_asc' | 'follower_desc'

const SORT_LABELS: Record<SortKey, string> = {
  date_asc: '날짜 빠른순',
  fee_asc: '페이 낮은순',
  follower_desc: '팔로워 많은순',
}

// Channel badge colors (matching Screen 3 / dealsheet spec)
const CH_STYLE: Record<string, { bg: string; text: string }> = {
  블로그: { bg: '#DCFCE7', text: '#15803D' },
  유튜브: { bg: '#FEE2E2', text: '#DC2626' },
  인스타그램: { bg: '#FCE7F3', text: '#BE185D' },
  틱톡: { bg: '#E8E8EC', text: '#17171B' },
}

export default function AdvertiserSearchPage() {
  const supabase = createClient()
  const router = useRouter()

  // Filter state
  const [date, setDate] = useState('')
  const [regions, setRegions] = useState<string[]>([])
  const [channels, setChannels] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [feeMin, setFeeMin] = useState('')
  const [feeMax, setFeeMax] = useState('')
  const [keyword, setKeyword] = useState('')

  // Result state
  const [results, setResults] = useState<any[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)

  // Display state
  const [groupMode, setGroupMode] = useState<GroupMode>('날짜별')
  const [sort, setSort] = useState<SortKey>('date_asc')

  const toggle = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, val: T) =>
    setter((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]))

  const resetFilters = () => {
    setDate('')
    setRegions([])
    setChannels([])
    setCategories([])
    setFeeMin('')
    setFeeMax('')
    setKeyword('')
  }

  const handleSearch = async () => {
    setLoading(true)
    setSearched(true)

    let q = supabase.from('schedules').select('*').eq('is_public', true).eq('status', 'open')

    if (date) q = q.eq('date', date)
    if (regions.length > 0) q = q.or(regions.map((r) => `location_city.ilike.%${r}%`).join(','))
    if (channels.length > 0) q = q.overlaps('channels', channels)
    if (categories.length > 0) q = q.overlaps('predefined_categories', categories)
    if (keyword) q = q.or(`title.ilike.%${keyword}%,free_tags.cs.{${keyword}}`)

    const { data } = await q.order('date', { ascending: true })

    const enriched = await Promise.all(
      (data ?? []).map(async (s) => {
        const [{ data: prof }, { data: ip }] = await Promise.all([
          supabase.from('profiles').select('id, name, avatar_url').eq('id', s.influencer_id).single(),
          supabase
            .from('influencer_profiles')
            .select('bio, platforms, categories, follower_count, match_score, review_count')
            .eq('user_id', s.influencer_id)
            .single(),
        ])
        return { ...s, profiles: prof, influencer_profiles: ip }
      }),
    )

    let filtered = enriched
    // fee is stored as text (e.g. "30만원~") — numeric range filtering deferred to future migration
    void feeMin; void feeMax

    setResults(filtered)
    setLoading(false)
  }

  const sorted = useMemo(() => {
    return [...results].sort((a, b) => {
      if (sort === 'fee_asc') return (a.fee ?? 0) - (b.fee ?? 0)
      if (sort === 'follower_desc')
        return (
          (b.influencer_profiles?.follower_count ?? 0) - (a.influencer_profiles?.follower_count ?? 0)
        )
      return (a.date ?? '').localeCompare(b.date ?? '') // date_asc
    })
  }, [results, sort])

  const byDate = useMemo(() => {
    const g: Record<string, any[]> = {}
    for (const s of sorted) {
      const key = s.date ?? '날짜 미정'
      ;(g[key] ??= []).push(s)
    }
    return g
  }, [sorted])

  const byInfluencer = useMemo(() => {
    const g: Record<string, { name: string; items: any[] }> = {}
    for (const s of sorted) {
      const key = s.influencer_id as string
      if (!g[key]) g[key] = { name: s.profiles?.name ?? '인플루언서', items: [] }
      g[key].items.push(s)
    }
    return g
  }, [sorted])

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })

  const fmtFee = (fee: string | null) => fee || '협의'

  // ── Open slot card ──
  const openCard = (schedule: any) => (
    <div
      key={schedule.id}
      className="bg-white border border-[#EAEAEE] rounded-[14px] p-4 flex flex-col gap-3 hover:bg-[#FFFBEB] hover:border-[#FDE68A] transition"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-[#DBEAFE] text-[#1D4ED8] text-[13px] font-bold flex items-center justify-center shrink-0">
          {schedule.profiles?.name?.[0] ?? '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[#17171B] truncate">
            {schedule.profiles?.name ?? '인플루언서'}
          </p>
          <p className="text-[11px] text-[#9A9AA5]">
            팔로워 {schedule.influencer_profiles?.follower_count?.toLocaleString() ?? '—'}명
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {schedule.influencer_profiles?.categories?.[0] && (
            <span className="text-[10.5px] font-semibold bg-[#F1F1F4] text-[#5C5C68] rounded-full px-2 py-0.5">
              {schedule.influencer_profiles.categories[0]}
            </span>
          )}
          <MatchScore
            score={schedule.influencer_profiles?.match_score ?? null}
            reviewCount={schedule.influencer_profiles?.review_count ?? 0}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1 text-[12px]">
        <div className="flex items-center gap-2">
          <span className="text-[#B0B0BB] text-[11px] w-14 shrink-0">날짜</span>
          <span className="font-semibold text-[#3C3C46]">{fmtDate(schedule.date)}</span>
        </div>
        {schedule.channels?.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[#B0B0BB] text-[11px] w-14 shrink-0">채널</span>
            <div className="flex flex-wrap gap-1">
              {(schedule.channels as string[]).map((ch: string) => (
                <span
                  key={ch}
                  className="text-[10.5px] font-bold rounded px-2 py-[2px]"
                  style={{
                    background: CH_STYLE[ch]?.bg ?? '#F1F1F4',
                    color: CH_STYLE[ch]?.text ?? '#5C5C68',
                  }}
                >
                  {ch}
                </span>
              ))}
            </div>
          </div>
        )}
        {schedule.location_city && (
          <div className="flex items-center gap-2">
            <span className="text-[#B0B0BB] text-[11px] w-14 shrink-0">지역</span>
            <span className="text-[#5C5C68]">
              {schedule.location_city}
              {schedule.location_district ? ` ${schedule.location_district}` : ''}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[#B0B0BB] text-[11px] w-14 shrink-0">희망페이</span>
          <span className="font-semibold text-[#3C3C46]">{fmtFee(schedule.fee)}</span>
        </div>
      </div>

      <button
        onClick={() =>
          router.push(`/advertiser/messages?to=${schedule.influencer_id}&date=${schedule.date}`)
        }
        className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-white text-[12.5px] font-bold py-2 rounded-lg transition shadow-[0_1px_2px_rgba(245,158,11,.25)]"
      >
        이 날짜로 대시 →
      </button>
    </div>
  )

  // ── Filter sidebar (same markup used in PC sticky aside + mobile block) ──
  const filterSidebar = (
    <div className="bg-white border border-[#EAEAEE] rounded-[14px] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[13.5px] font-bold text-[#17171B]">필터</h2>
        <button
          onClick={resetFilters}
          className="text-[11.5px] text-[#9A9AA5] hover:text-[#5C5C68] transition"
        >
          초기화
        </button>
      </div>

      {/* 날짜 */}
      <div>
        <div className="text-[11px] font-bold text-[#9A9AA5] tracking-[0.04em] mb-1.5">날짜</div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border border-[#EAEAEE] rounded-lg px-3 py-2 text-[12.5px] text-[#3C3C46] focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
      </div>

      {/* 채널 */}
      <div>
        <div className="text-[11px] font-bold text-[#9A9AA5] tracking-[0.04em] mb-1.5">채널</div>
        <div className="flex flex-wrap gap-1.5">
          {CHANNELS.map((ch) => (
            <button
              key={ch}
              onClick={() => toggle(setChannels, ch)}
              className={`text-[11.5px] font-semibold px-2.5 py-[5px] rounded-md transition ${
                channels.includes(ch)
                  ? 'bg-[#FEF3C7] text-[#B45309]'
                  : 'bg-[#F1F1F4] text-[#5C5C68] hover:bg-[#E8E8EC]'
              }`}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      {/* 지역 */}
      <div>
        <div className="text-[11px] font-bold text-[#9A9AA5] tracking-[0.04em] mb-1.5">지역</div>
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => toggle(setRegions, r)}
              className={`text-[11.5px] font-semibold px-2.5 py-[5px] rounded-md transition ${
                regions.includes(r)
                  ? 'bg-[#FEF3C7] text-[#B45309]'
                  : 'bg-[#F1F1F4] text-[#5C5C68] hover:bg-[#E8E8EC]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* 분야 */}
      <div>
        <div className="text-[11px] font-bold text-[#9A9AA5] tracking-[0.04em] mb-1.5">
          분야 <span className="font-normal opacity-60">({INFLUENCER_CATEGORIES.length})</span>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-[108px] overflow-y-auto pr-0.5">
          {INFLUENCER_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggle(setCategories, cat)}
              className={`text-[11.5px] font-semibold px-2.5 py-[5px] rounded-md transition ${
                categories.includes(cat)
                  ? 'bg-[#FEF3C7] text-[#B45309]'
                  : 'bg-[#F1F1F4] text-[#5C5C68] hover:bg-[#E8E8EC]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 희망페이 */}
      <div>
        <div className="text-[11px] font-bold text-[#9A9AA5] tracking-[0.04em] mb-1.5">희망페이 (만원)</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={feeMin}
            onChange={(e) => setFeeMin(e.target.value)}
            placeholder="최소"
            className="flex-1 min-w-0 border border-[#EAEAEE] rounded-lg px-3 py-2 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          <span className="text-[#C4C4CE] text-sm shrink-0">~</span>
          <input
            type="number"
            min={0}
            value={feeMax}
            onChange={(e) => setFeeMax(e.target.value)}
            placeholder="최대"
            className="flex-1 min-w-0 border border-[#EAEAEE] rounded-lg px-3 py-2 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>
      </div>

      {/* 키워드 */}
      <div>
        <div className="text-[11px] font-bold text-[#9A9AA5] tracking-[0.04em] mb-1.5">키워드</div>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="예: 팝업스토어, 신제품"
          className="w-full border border-[#EAEAEE] rounded-lg px-3 py-2 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
      </div>

      {/* 친구등록만 (비활성 — favorites 미구현) */}
      <div
        className="flex items-center justify-between opacity-40 cursor-not-allowed select-none"
        title="즐겨찾기 기능 준비 중"
      >
        <span className="text-[12.5px] font-semibold text-[#5C5C68]">☆ 친구등록만</span>
        <div className="w-[38px] h-[22px] rounded-full bg-[#E2E2E8] relative shrink-0">
          <span className="absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow" />
        </div>
      </div>

      <button
        onClick={handleSearch}
        disabled={loading}
        className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-white font-bold py-2.5 rounded-[9px] text-[13.5px] transition disabled:opacity-50 shadow-[0_1px_2px_rgba(245,158,11,.35)]"
      >
        {loading ? '검색 중...' : '검색하기'}
      </button>
    </div>
  )

  // ── Results panel ──
  const resultsPanel = (
    <div className="min-w-0">
      {/* Controls bar */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        {/* Group mode tabs */}
        <div className="flex gap-[3px] bg-[#F1F1F4] rounded-lg p-[3px]">
          {(['날짜별', '인플루언서별'] as GroupMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setGroupMode(m)}
              className={`text-[11.5px] font-semibold px-3 py-[5px] rounded-md transition flex items-center gap-1.5 ${
                groupMode === m
                  ? 'bg-white text-[#17171B] shadow-[0_1px_2px_rgba(0,0,0,.06)]'
                  : 'text-[#8A8A96] hover:text-[#5C5C68]'
              }`}
            >
              <span
                className="w-[7px] h-[7px] rounded-full inline-block shrink-0"
                style={{ background: m === '날짜별' ? '#3B82F6' : '#F59E0B' }}
              />
              {m}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="border border-[#EAEAEE] rounded-lg px-3 py-[7px] text-[12.5px] bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 cursor-pointer"
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABELS[k]}
            </option>
          ))}
        </select>

        {searched && (
          <span className="ml-auto text-[12.5px] text-[#7C7C88]">
            {sorted.length > 0 ? `${sorted.length}건` : '결과 없음'}
          </span>
        )}
      </div>

      {!searched ? (
        <div className="bg-white border border-[#EAEAEE] rounded-[14px] py-16 text-center">
          <p className="text-[14px] text-[#B0B0BB]">필터를 설정하고 검색하세요.</p>
          <p className="text-[12px] text-[#C4C4CE] mt-1.5">
            날짜·채널·지역·분야로 인플루언서를 찾을 수 있어요.
          </p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white border border-[#EAEAEE] rounded-[14px] py-16 text-center">
          <p className="text-[14px] text-[#B0B0BB]">조건에 맞는 인플루언서가 없어요.</p>
          <p className="text-[12px] text-[#C4C4CE] mt-1.5">날짜나 지역 조건을 바꿔보세요.</p>
        </div>
      ) : groupMode === '날짜별' ? (
        <div className="flex flex-col gap-6">
          {Object.entries(byDate).map(([d, items]) => (
            <div key={d}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-[#3B82F6] shrink-0" />
                <h3 className="text-[13px] font-bold text-[#3C3C46]">
                  {d === '날짜 미정' ? d : fmtDate(d)}
                </h3>
                <span className="text-[11.5px] text-[#B0B0BB]">{items.length}명</span>
              </div>
              <div className="grid grid-cols-1 [.adv-pc_&]:grid-cols-2 gap-[11px]">
                {items.map((s) => openCard(s))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(byInfluencer).map(([infId, { name, items }]) => (
            <div key={infId}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-[#F59E0B] shrink-0" />
                <h3 className="text-[13px] font-bold text-[#3C3C46]">{name}</h3>
                <span className="text-[11.5px] text-[#B0B0BB]">{items.length}개 날짜</span>
              </div>
              <div className="grid grid-cols-1 [.adv-pc_&]:grid-cols-2 gap-[11px]">
                {items.map((s) => openCard(s))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div>
      {/* Page title — mobile only */}
      <h1 className="text-xl font-bold text-[#17171B] mb-5 [.adv-pc_&]:hidden">인플루언서 찾기</h1>

      {/* PC: 2-col grid (284px sidebar + content) / Mobile: stacked */}
      <div className="flex flex-col gap-4 [.adv-pc_&]:grid [.adv-pc_&]:grid-cols-[284px_minmax(0,1fr)] [.adv-pc_&]:gap-5 [.adv-pc_&]:items-start">
        <aside className="[.adv-pc_&]:sticky [.adv-pc_&]:top-[84px]">{filterSidebar}</aside>
        {resultsPanel}
      </div>
    </div>
  )
}
