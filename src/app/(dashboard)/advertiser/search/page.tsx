'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { INFLUENCER_CATEGORIES } from '@/lib/categories'
import MatchScore from '@/components/MatchScore'
import { BlogAnalyticsCompact } from '@/components/BlogAnalyticsCard'
import DashSendButton from '@/components/DashSendButton'
import CancelBadge from '@/components/CancelBadge'
import { initial } from '@/lib/initial'
import { dateWithDow } from '@/lib/date'

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

  // Filter state — 날짜: 7열 달력 (특정일/기간)
  const [dateMode, setDateMode] = useState<'특정일' | '기간'>('특정일')
  const [sA, setSA] = useState('') // 'YYYY-MM-DD'
  const [sB, setSB] = useState('')
  const [half, setHalf] = useState(false) // 기간: 시작만 눌린 상태
  const now0 = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState<{ y: number; m: number }>(() => {
    const n = new Date()
    return { y: n.getFullYear(), m: n.getMonth() }
  })
  const [openDays, setOpenDays] = useState<Set<string>>(new Set())
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

  // 친구등록(Stage 3) — 본인이 등록한 인플루언서 + 등록 토글
  const [userId, setUserId] = useState<string | null>(null)
  const [friends, setFriends] = useState<{ influencerId: string; name: string; source: string | null; category: string | null; followers: number | null }[]>([])
  const [registeredIds, setRegisteredIds] = useState<Set<string>>(new Set())
  const [regBusy, setRegBusy] = useState<string | null>(null)

  // 내가 맺은 친구등록을 다시 읽어 카드/버튼 상태를 갱신한다.
  const loadFriends = async (uid: string) => {
    const { data: conns } = await supabase
      .from('connections')
      .select('id, a_id, b_id, source, created_at')
      .or(`a_id.eq.${uid},b_id.eq.${uid}`)
      .order('created_at', { ascending: false })
    const rows = conns ?? []
    const otherIds = rows.map((c: any) => (c.a_id === uid ? c.b_id : c.a_id))
    setRegisteredIds(new Set(otherIds))
    if (otherIds.length === 0) {
      setFriends([])
      return
    }
    const [{ data: profs }, { data: ips }] = await Promise.all([
      supabase.from('profiles').select('id, name').in('id', otherIds),
      supabase.from('influencer_profiles').select('user_id, categories, follower_count').in('user_id', otherIds),
    ])
    const nameOf = new Map((profs ?? []).map((p: any) => [p.id, p.name]))
    const ipOf = new Map((ips ?? []).map((p: any) => [p.user_id, p]))
    setFriends(
      rows.map((c: any) => {
        const other = c.a_id === uid ? c.b_id : c.a_id
        const ip = ipOf.get(other)
        return {
          influencerId: other,
          name: nameOf.get(other) ?? '인플루언서',
          source: c.source,
          category: ip?.categories?.[0] ?? null,
          followers: ip?.follower_count ?? null,
        }
      }),
    )
  }

  useEffect(() => {
    let alive = true
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!alive || !user) return
      setUserId(user.id)
      loadFriends(user.id)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  // 친구등록/해제 토글 — 모달 없이 즉시 반영(낙관적), 실패 시 되돌린다.
  const toggleFriend = async (influencerId: string) => {
    if (!userId || regBusy) return
    const isReg = registeredIds.has(influencerId)
    setRegBusy(influencerId)
    setRegisteredIds((prev) => {
      const n = new Set(prev)
      if (isReg) n.delete(influencerId)
      else n.add(influencerId)
      return n
    })
    try {
      const res = await fetch('/api/connections', {
        method: isReg ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ influencerId }),
      })
      if (!res.ok) throw new Error()
      await loadFriends(userId)
    } catch {
      setRegisteredIds((prev) => {
        const n = new Set(prev)
        if (isReg) n.add(influencerId)
        else n.delete(influencerId)
        return n
      })
    } finally {
      setRegBusy(null)
    }
  }

  const toggle = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, val: T) =>
    setter((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]))

  const resetFilters = () => {
    setSA('')
    setSB('')
    setHalf(false)
    setDateMode('특정일')
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

    let q = supabase
      .from('schedules')
      .select('id, influencer_id, date, channels, location_city, location_district, fee')
      .eq('is_public', true)
      .eq('status', 'open')

    const _lo = sA && sB ? (sA < sB ? sA : sB) : sA
    const _hi = sA && sB ? (sA > sB ? sA : sB) : sB
    if (dateMode === '특정일') {
      if (sA) q = q.eq('date', sA)
    } else if (_lo && _hi && !half) {
      q = q.gte('date', _lo).lte('date', _hi)
    }
    if (regions.length > 0) q = q.or(regions.map((r) => `location_city.ilike.%${r}%`).join(','))
    if (channels.length > 0) q = q.overlaps('channels', channels)
    if (categories.length > 0) q = q.overlaps('predefined_categories', categories)
    if (keyword) q = q.or(`title.ilike.%${keyword}%,free_tags.cs.{${keyword}}`)

    const { data } = await q.order('date', { ascending: true })

    const enriched = await Promise.all(
      (data ?? []).map(async (s) => {
        const [{ data: prof }, { data: ip }, { data: ba }] = await Promise.all([
          supabase.from('profiles').select('id, name, avatar_url, cancellation_count').eq('id', s.influencer_id).single(),
          supabase
            .from('influencer_profiles')
            .select('bio, platforms, categories, follower_count, match_score, review_count')
            .eq('user_id', s.influencer_id)
            .single(),
          supabase
            .from('blog_analytics')
            .select('blog_id, neighbor_count, post_count, top10_count, crawled_at')
            .eq('user_id', s.influencer_id)
            .single(),
        ])
        return { ...s, profiles: prof, influencer_profiles: ip, blog_analytics: ba }
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

  const fmtDate = (d: string) => dateWithDow(d)

  const fmtFee = (fee: string | null) => fee || '협의'

  // ── 7열 달력 (특정일/기간) ──
  const ymd = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const fmtKDate = (s: string) => {
    if (!s) return ''
    const [, mm, dd] = s.split('-')
    return `${Number(mm)}월 ${Number(dd)}일`
  }

  // 표시 중인 달의 실제 오픈 날짜만 집계 (schedules: is_public + status='open')
  useEffect(() => {
    const start = ymd(cursor.y, cursor.m, 1)
    const base = new Date(cursor.y, cursor.m + 1, 1)
    const end = ymd(base.getFullYear(), base.getMonth(), 1)
    let alive = true
    supabase
      .from('schedules')
      .select('date')
      .eq('is_public', true)
      .eq('status', 'open')
      .gte('date', start)
      .lt('date', end)
      .then(({ data }) => {
        if (alive) setOpenDays(new Set((data ?? []).map((r: any) => r.date as string)))
      })
    return () => {
      alive = false
    }
  }, [cursor, supabase])

  const lo = sA && sB ? (sA < sB ? sA : sB) : sA
  const hi = sA && sB ? (sA > sB ? sA : sB) : sB
  const firstDow = new Date(cursor.y, cursor.m, 1).getDay()
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()

  const pickDay = (d: number) => {
    const ds = ymd(cursor.y, cursor.m, d)
    if (dateMode === '특정일') {
      setSA(ds); setSB(ds); setHalf(false); return
    }
    if (half) { setSB(ds); setHalf(false) } // 둘째 클릭 → 완성
    else { setSA(ds); setSB(ds); setHalf(true) } // 첫 클릭(또는 완료 후 다시) → 처음부터
  }

  const moveMonth = (delta: number) => {
    setCursor((c) => {
      const b = new Date(c.y, c.m + delta, 1)
      return { y: b.getFullYear(), m: b.getMonth() }
    })
  }

  const setRange = (a: Date, b: Date) => {
    setSA(ymd(a.getFullYear(), a.getMonth(), a.getDate()))
    setSB(ymd(b.getFullYear(), b.getMonth(), b.getDate()))
    setHalf(false)
    setCursor({ y: a.getFullYear(), m: a.getMonth() })
  }
  const quickThisWeek = () => {
    const t = new Date(now0)
    const sun = new Date(t); sun.setDate(t.getDate() - t.getDay())
    const sat = new Date(sun); sat.setDate(sun.getDate() + 6)
    setRange(sun, sat)
  }
  const quickNextWeek = () => {
    const t = new Date(now0)
    const sun = new Date(t); sun.setDate(t.getDate() - t.getDay() + 7)
    const sat = new Date(sun); sat.setDate(sun.getDate() + 6)
    setRange(sun, sat)
  }
  const quickThisMonth = () => {
    setRange(
      new Date(now0.getFullYear(), now0.getMonth(), 1),
      new Date(now0.getFullYear(), now0.getMonth() + 1, 0),
    )
  }

  // 안내 문구 (모드/진행 상태에 따라 세 번 바뀜)
  const guide =
    dateMode === '특정일'
      ? { t: '하루를 눌러주세요', bg: '#F1F1F4', c: '#7C7C88' }
      : half
      ? { t: '끝나는 날을 눌러주세요', bg: '#FEF3C7', c: '#B45309' }
      : sA && sB
      ? { t: '기간 선택이 끝났어요', bg: '#DCFCE7', c: '#15803D' }
      : { t: '시작하는 날을 눌러주세요', bg: '#F1F1F4', c: '#7C7C88' }

  // ── Open slot card ──
  const openCard = (schedule: any) => (
    <div
      key={schedule.id}
      className="bg-white border border-[#EAEAEE] rounded-[14px] p-4 flex flex-col gap-3 hover:bg-[#FFFBEB] hover:border-[#FDE68A] transition"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-[#DBEAFE] text-[#1D4ED8] text-[13px] font-bold flex items-center justify-center shrink-0">
          {initial(schedule.profiles?.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-[13px] font-semibold text-[#17171B] truncate">
              {schedule.profiles?.name ?? '인플루언서'}
            </p>
            {/* 수락 전에 보여야 의미가 있다 — 확정 후엔 늦다 */}
            <CancelBadge role="influencer" count={schedule.profiles?.cancellation_count} />
          </div>
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

      {schedule.blog_analytics && (
        <div className="border-t border-[#F1F1F4] pt-2.5">
          <BlogAnalyticsCompact data={schedule.blog_analytics} />
        </div>
      )}

      {userId && userId !== schedule.influencer_id && (() => {
        const reg = registeredIds.has(schedule.influencer_id)
        return (
          <button
            type="button"
            onClick={() => toggleFriend(schedule.influencer_id)}
            disabled={regBusy === schedule.influencer_id}
            className="self-start text-[11.5px] font-semibold rounded-[7px] transition disabled:opacity-50"
            style={{
              padding: '6px 10px',
              background: reg ? '#FFFBEB' : '#fff',
              color: reg ? '#B45309' : '#5C5C68',
              border: `1px solid ${reg ? '#FDE68A' : '#E2E2E8'}`,
            }}
          >
            {reg ? '친구등록됨' : '＋ 친구등록'}
          </button>
        )
      })()}

      <DashSendButton
        influencerId={schedule.influencer_id}
        influencerName={schedule.profiles?.name ?? '인플루언서'}
        scheduleId={schedule.id}
        scheduleDate={schedule.date}
        className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-white text-[12.5px] font-bold py-2 rounded-lg transition shadow-[0_1px_2px_rgba(245,158,11,.25)]"
      >
        이 날짜로 대시 →
      </DashSendButton>
    </div>
  )

  // ── Filter card (top full-width on PC, stacked on mobile) ──
  const filterSidebar = (
    <div className="bg-white border border-[#EAEAEE] rounded-[14px] p-5 flex flex-col gap-4 [.adv-pc_&]:grid [.adv-pc_&]:grid-cols-4 [.adv-pc_&]:gap-x-5 [.adv-pc_&]:gap-y-[17px] [.adv-pc_&]:pt-4 [.adv-pc_&]:pb-[18px]">
      <div className="flex items-center justify-between [.adv-pc_&]:col-span-full">
        <h2 className="text-[13.5px] font-bold text-[#17171B]">필터</h2>
        <button
          onClick={resetFilters}
          className="text-[11.5px] text-[#9A9AA5] hover:text-[#5C5C68] transition"
        >
          초기화
        </button>
      </div>

      {/* 날짜 — 7열 달력 (특정일/기간) */}
      <div className="[.adv-pc_&]:col-span-full [.adv-pc_&]:pb-4 [.adv-pc_&]:border-b [.adv-pc_&]:border-[#F1F1F4]">
        <div className="text-[11px] font-bold text-[#9A9AA5] tracking-[0.04em] mb-2">날짜</div>
        <div className="flex flex-col gap-4 [.adv-pc_&]:grid [.adv-pc_&]:grid-cols-[388px_minmax(0,1fr)] [.adv-pc_&]:gap-[22px] [.adv-pc_&]:items-start">
          {/* 좌: 달력 */}
          <div className="w-full [.adv-pc_&]:w-[388px]">
            {/* 모드 토글 + 안내 문구 */}
            <div className="flex items-center gap-2 mb-2">
              <div className="flex gap-[3px] bg-[#F1F1F4] rounded-lg p-[3px]">
                {(['특정일', '기간'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setDateMode(m)
                      setSA('')
                      setSB('')
                      setHalf(false)
                    }}
                    className={`text-[11px] font-semibold px-2.5 py-[4px] rounded-md transition ${
                      dateMode === m
                        ? 'bg-white text-[#17171B] shadow-[0_1px_2px_rgba(0,0,0,.06)]'
                        : 'text-[#8A8A96] hover:text-[#5C5C68]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <span
                className="ml-auto text-[11px] font-bold rounded-[6px] px-2.5 py-[5px]"
                style={{ background: guide.bg, color: guide.c }}
              >
                {guide.t}
              </span>
            </div>

            {/* 월 이동 */}
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="w-7 h-7 rounded-md text-[#8A8A96] hover:bg-[#F1F1F4] flex items-center justify-center text-[15px]"
                aria-label="이전 달"
              >
                ‹
              </button>
              <span className="text-[12.5px] font-bold text-[#3C3C46]">
                {cursor.y}년 {cursor.m + 1}월
              </span>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="w-7 h-7 rounded-md text-[#8A8A96] hover:bg-[#F1F1F4] flex items-center justify-center text-[15px]"
                aria-label="다음 달"
              >
                ›
              </button>
            </div>

            {/* 요일 */}
            <div className="grid grid-cols-7 gap-[3px] mb-[3px]">
              {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
                <div key={w} className="text-center text-[10px] font-bold text-[#B0B0BB] py-[2px]">
                  {w}
                </div>
              ))}
            </div>

            {/* 날짜 격자 */}
            <div className="grid grid-cols-7 gap-[3px]">
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`pad-${i}`} className="aspect-square" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = i + 1
                const ds = ymd(cursor.y, cursor.m, d)
                const isSel =
                  (dateMode === '특정일' && ds === sA) ||
                  (dateMode === '기간' && !!sA && (ds === lo || ds === hi))
                const inRange = dateMode === '기간' && !!lo && !!hi && ds > lo && ds < hi
                const hasOpen = openDays.has(ds)
                let bg = 'transparent'
                let color = '#9A9AA5'
                let weight = 500
                if (isSel) {
                  bg = '#17171B'
                  color = '#fff'
                  weight = 800
                } else if (inRange) {
                  bg = '#FEF3C7'
                  color = '#B45309'
                  weight = 500
                } else if (hasOpen) {
                  bg = '#FFFBEB'
                  color = '#B45309'
                  weight = 700
                }
                return (
                  <button
                    key={ds}
                    type="button"
                    onClick={() => pickDay(d)}
                    className="aspect-square rounded-lg flex items-center justify-center text-[12px] tabular-nums cursor-pointer relative"
                    style={{ background: bg, color, fontWeight: weight }}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 우: 선택 요약 + 빠른 선택 */}
          <div className="flex flex-col gap-[9px]">
            <div
              className="rounded-[10px] px-[13px] py-3"
              style={{ background: '#FBFBFC', border: '1px solid #EFEFF2' }}
            >
              <div className="text-[11px] font-bold text-[#9A9AA5]">
                선택함 · {dateMode === '특정일' ? '진행일' : '진행 기간'}
              </div>
              <div className="text-[14.5px] font-extrabold tracking-[-0.025em] mt-1.5 tabular-nums leading-[1.4] text-[#17171B]">
                {dateMode === '특정일' ? (
                  sA ? (
                    fmtKDate(sA)
                  ) : (
                    <span className="text-[#C4C4CE] font-semibold">날짜를 선택하세요</span>
                  )
                ) : lo && hi && !half ? (
                  `${fmtKDate(lo)} → ${fmtKDate(hi)}`
                ) : (
                  <span className="text-[#C4C4CE] font-semibold">기간을 선택하세요</span>
                )}
              </div>
              <div className="text-[11px] text-[#9A9AA5] mt-1.5 leading-[1.55]">
                이 날짜에 열린 오픈만 검색돼요.
              </div>
            </div>
            {dateMode === '기간' && (
              <div className="flex gap-[5px]">
                {([['이번 주', quickThisWeek], ['다음 주', quickNextWeek], ['이번 달', quickThisMonth]] as const).map(
                  ([label, fn]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={fn}
                      className="text-[11px] font-semibold px-2.5 py-[6px] rounded-md bg-[#F1F1F4] text-[#5C5C68] hover:bg-[#E8E8EC] transition"
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
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
      <div className="[.adv-pc_&]:col-span-full">
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
        className="flex items-center justify-between opacity-40 cursor-not-allowed select-none [.adv-pc_&]:col-span-full"
        title="즐겨찾기 기능 준비 중"
      >
        <span className="text-[12.5px] font-semibold text-[#5C5C68]">☆ 친구등록만</span>
        <div className="w-[38px] h-[22px] rounded-full bg-[#E2E2E8] relative shrink-0">
          <span className="absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow" />
        </div>
      </div>

      <div className="[.adv-pc_&]:col-span-full [.adv-pc_&]:flex [.adv-pc_&]:justify-end">
        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-white font-bold py-2.5 rounded-[9px] text-[13.5px] transition disabled:opacity-50 shadow-[0_1px_2px_rgba(245,158,11,.35)] [.adv-pc_&]:w-auto [.adv-pc_&]:h-11 [.adv-pc_&]:px-7 [.adv-pc_&]:py-0 [.adv-pc_&]:rounded-[10px] [.adv-pc_&]:text-[#17171B] [.adv-pc_&]:font-extrabold"
        >
          {loading ? '검색 중...' : '검색하기'}
        </button>
      </div>
    </div>
  )

  // ── 친구등록 섹션 (필터 아래·결과 위, 4장, 없으면 미표시) ──
  const friendSection = friends.length > 0 && (
    <div className="bg-white border border-[#EAEAEE] rounded-[14px] p-5">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-[13.5px] font-bold text-[#17171B]">친구등록한 인플루언서</h2>
        <span className="text-[11.5px] text-[#B0B0BB]">{friends.length}명</span>
      </div>
      <div className="grid grid-cols-2 [.adv-pc_&]:grid-cols-4 gap-[11px]">
        {friends.slice(0, 4).map((f) => (
          <div
            key={f.influencerId}
            className="rounded-[12px]"
            style={{ background: '#FBFBFC', border: '1px solid #EFEFF2', padding: '14px 15px 15px' }}
          >
            {/* 1행 아바타 + 이름 */}
            <div className="flex items-center gap-2.5">
              <div className="w-[34px] h-[34px] rounded-full bg-[#FEF3C7] text-[#B45309] text-[13px] font-extrabold flex items-center justify-center shrink-0">
                {initial(f.name)}
              </div>
              <p className="text-[12.5px] font-bold text-[#17171B] truncate min-w-0 flex-1">{f.name}</p>
            </div>
            {/* 2행 분야 · 팔로워 */}
            <p className="text-[11px] text-[#9A9AA5] mt-[7px] truncate">
              {[f.category, f.followers != null ? `팔로워 ${f.followers.toLocaleString()}` : null]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
            {/* 3행 경로 배지 + 대시 보내기 */}
            <div className="flex items-center justify-between mt-[9px]">
              {f.source === 'collab' || f.source === 'manual' ? (
                <span
                  className="inline-block text-[10px] font-bold rounded px-1.5 py-[1px]"
                  style={{
                    background: f.source === 'collab' ? '#DCFCE7' : '#F1F1F4',
                    color: f.source === 'collab' ? '#15803D' : '#7C7C88',
                  }}
                >
                  {f.source === 'collab' ? '협업' : '직접'}
                </span>
              ) : (
                <span />
              )}
              <DashSendButton
                influencerId={f.influencerId}
                influencerName={f.name}
                className="text-[11px] font-semibold text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] hover:bg-[#FEF3C7] rounded-[6px] px-2 py-[4px] whitespace-nowrap"
              >
                대시 보내기
              </DashSendButton>
            </div>
          </div>
        ))}
      </div>
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
                <div className="flex-1 h-px bg-[#E4E4E8]" />
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
                <div className="flex-1 h-px bg-[#E4E4E8]" />
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

      {/* PC: 필터 카드(상단 전체폭) + 결과(하단 전체폭) / Mobile: stacked */}
      <div className="flex flex-col gap-[14px]">
        {filterSidebar}
        {friendSection}
        {resultsPanel}
      </div>
    </div>
  )
}
