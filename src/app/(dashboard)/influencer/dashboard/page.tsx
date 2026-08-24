import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HomeCalendar from '@/components/HomeCalendar'
import MyOpensList from '@/components/MyOpensList'
import NotificationsRealtime from '@/components/NotificationsRealtime'
import CancelNoticeCard from '@/components/CancelNoticeCard'
import { BlogAnalyticsSummaryCard } from '@/components/BlogAnalyticsCard'
import { initial } from '@/lib/initial'
import { settlementDateOf } from '@/lib/deals/settlementDate'
import { eachDay } from '@/lib/date'
import {
  CalendarDays, Search, Hourglass, Inbox, Handshake, BarChart3, Wallet, Bell,
  MessageSquare, Plus, Megaphone, Pencil, CheckCircle2, Ban, CalendarPlus, CheckSquare,
  type LucideIcon,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const NOTIF_ICON: Record<string, LucideIcon> = {
  campaign_created: Megaphone, campaign_updated: Pencil, campaign_completed: CheckCircle2, campaign_cancelled: Ban,
  open_created: CalendarPlus, open_completed: CheckCircle2, open_cancelled: Ban,
  deal_made: Handshake, dash_received: MessageSquare, settlement_due: Wallet,
  deal_confirm_request: Hourglass, deal_confirm_self: CheckSquare,
}

// 딜시트와 같은 9단계(D6 B1) — "다음 할 일" 라벨 파생용
const NEXT_STEP: Record<string, string> = {
  협의: '광고주 확정 대기',
  수락: '가이드 수령 대기',
  가이드: '방문/제작 준비',
  방문: '콘텐츠 업로드',
  원고: '컨펌 대기',
  '수정/컨펌': '수정 반영',
  게재: '정산 대기',
  게재뒤수정: '수정 반영',
  정산: '완료',
}

export default async function InfluencerMyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, status, cancellation_count')
    .eq('id', user.id)
    .single()

  if (profile?.status === 'pending') redirect('/pending')
  if (profile?.role === 'advertiser') redirect('/advertiser/dashboard')
  if (profile?.role !== 'influencer') redirect('/login')

  const { data: ip } = await supabase
    .from('influencer_profiles')
    .select('categories, match_score, review_count')
    .eq('user_id', user.id)
    .single()
  const myCats: string[] = ip?.categories ?? []

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const start = `${year}-${pad(month)}-01`
  const end = `${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`
  const todayStr = ymd(now)

  // 이번 주(오늘부터 6일) 스트립 범위
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() + i)
    return ymd(d)
  })

  // 내 오픈 (전체)
  const { data: opens } = await supabase
    .from('schedules')
    .select('*')
    .eq('influencer_id', user.id)
    .order('created_at', { ascending: false })

  // 매칭 캠페인 (이달 · 내 분야 겹침)
  const { data: campsRaw } = await supabase
    .from('campaigns')
    .select('date, predefined_categories')
    .eq('is_public', true)
    .eq('status', 'open')
    .gte('date', start)
    .lte('date', end)
  const camps = (campsRaw ?? []).filter(
    (c) => myCats.length === 0 || (c.predefined_categories ?? []).some((x: string) => myCats.includes(x))
  )

  // 제안(대시) — 받은 제안(답 대기) + 진행중 협업(성사) 판정용, 상대 이름/제목까지 붙인다
  const { data: proposalsRaw } = await supabase
    .from('proposals')
    .select('id, campaign_id, schedule_id, advertiser_id, budget, stage, advertiser_confirmed, influencer_confirmed, created_at')
    .eq('influencer_id', user.id)
    .order('created_at', { ascending: false })

  const advIds = [...new Set((proposalsRaw ?? []).map((p) => p.advertiser_id))]
  const campIds = [...new Set((proposalsRaw ?? []).filter((p) => p.campaign_id).map((p) => p.campaign_id as string))]
  const schedIds = [...new Set((proposalsRaw ?? []).filter((p) => p.schedule_id).map((p) => p.schedule_id as string))]
  const [{ data: advProfiles }, { data: propCamps }, { data: propScheds }] = await Promise.all([
    advIds.length ? supabase.from('profiles').select('id, name').in('id', advIds) : Promise.resolve({ data: [] }),
    campIds.length ? supabase.from('campaigns').select('id, title').in('id', campIds) : Promise.resolve({ data: [] }),
    schedIds.length ? supabase.from('schedules').select('id, title').in('id', schedIds) : Promise.resolve({ data: [] }),
  ])
  const advNameById = Object.fromEntries((advProfiles ?? []).map((p) => [p.id, p.name]))
  const campTitleById = Object.fromEntries((propCamps ?? []).map((c) => [c.id, c.title]))
  const schedTitleById = Object.fromEntries((propScheds ?? []).map((s) => [s.id, s.title]))

  // 정산 성실도 — 확정을 누르기 직전에 가장 중요한 정보라 받은 제안 카드에 바로 노출
  const { data: paymentScores } = advIds.length
    ? await supabase.from('advertiser_payment_score').select('advertiser_id, on_time_rate').in('advertiser_id', advIds)
    : { data: [] }
  const scoreByAdv = Object.fromEntries((paymentScores ?? []).map((s) => [s.advertiser_id, s.on_time_rate]))

  const proposals = (proposalsRaw ?? []).map((p) => ({
    ...p,
    advertiserName: advNameById[p.advertiser_id] ?? '광고주',
    title: (p.campaign_id ? campTitleById[p.campaign_id] : schedTitleById[p.schedule_id ?? '']) ?? '협업',
    onTimeRate: scoreByAdv[p.advertiser_id] ?? null,
  }))

  const awaitingProposals = proposals.filter((p) => !p.influencer_confirmed)
  const inProgress = proposals.filter((p) => p.advertiser_confirmed && p.influencer_confirmed && p.stage !== '정산')

  const madeSchedules = new Set(
    proposals.filter((p) => p.advertiser_confirmed && p.influencer_confirmed).map((p) => p.schedule_id)
  )

  // 오픈 목록 행 → 대시가 온 오픈만 대화로 연결(C4). schedule_id별 가장 최근 대시의 상대를 쓴다.
  const dashBySchedule: Record<string, { advertiserId: string; proposalId: string }> = {}
  for (const p of proposals) {
    if (p.schedule_id && !dashBySchedule[p.schedule_id]) {
      dashBySchedule[p.schedule_id] = { advertiserId: p.advertiser_id, proposalId: p.id }
    }
  }

  // 달력 카운트 (이달) — 7일 스트립도 여기서 파생
  const countsByDate: Record<string, { open: number; campaign: number }> = {}
  for (const o of opens ?? []) {
    // 기간 오픈은 걸친 날 전부에 센다 — 시작일에만 세면 내 달력에서도 중간 날이 비어 보인다.
    for (const d of eachDay(o.date, o.date_end, start, end)) (countsByDate[d] ??= { open: 0, campaign: 0 }).open++
  }
  for (const c of camps) {
    ;(countsByDate[(c as { date: string }).date] ??= { open: 0, campaign: 0 }).campaign++
  }
  const weekStrip = weekDates.map((d) => ({
    date: d,
    dow: '일월화수목금토'[new Date(d).getDay()],
    day: Number(d.slice(8, 10)),
    isToday: d === todayStr,
    counts: countsByDate[d] ?? { open: 0, campaign: 0 },
  }))

  // 메시지 미리보기 + 미응답 — 대화를 열면(is_read=true) 사라지는 단일 값에서 파생(A1)
  const { data: msgs } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(60)
  const convMap: Record<string, { otherId: string; last: any; unread: boolean }> = {}
  for (const m of msgs ?? []) {
    const other = m.sender_id === user.id ? m.receiver_id : m.sender_id
    if (!convMap[other]) convMap[other] = { otherId: other, last: m, unread: false }
    if (m.receiver_id === user.id && !m.is_read) convMap[other].unread = true
  }
  const convs = Object.values(convMap)
  const convPreview = convs.slice(0, 3)
  const otherIds = convPreview.map((c) => c.otherId)
  const { data: names } = otherIds.length
    ? await supabase.from('profiles').select('id, name').in('id', otherIds)
    : { data: [] }
  const nameById = Object.fromEntries((names ?? []).map((p) => [p.id, p.name]))

  // 매출 (이달) — proposals 기반. 귀속 기준 = settlementDateOf(proposal, campaign). D20 §2
  const { data: earnProps } = await supabase
    .from('proposals')
    .select('id, budget, settled_at, paid_confirmed_at, paid_disputed_at, settlement_status, campaign_id, settlement_date')
    .eq('influencer_id', user.id)
    .eq('advertiser_confirmed', true)
    .eq('influencer_confirmed', true)
  const earnCampIds = [...new Set((earnProps ?? []).map((p) => p.campaign_id).filter(Boolean))]
  const settleDateById: Record<string, string | null> = {}
  if (earnCampIds.length > 0) {
    const { data: earnCamps } = await supabase
      .from('campaigns')
      .select('id, settlement_date')
      .in('id', earnCampIds)
    ;(earnCamps ?? []).forEach((c) => { settleDateById[c.id] = c.settlement_date })
  }
  const earnRows = (earnProps ?? []).map((p) => {
    const sd = settlementDateOf(p, p.campaign_id ? { settlement_date: settleDateById[p.campaign_id] ?? null } : null)
    let status: '예정' | '미수' | '확인 대기' | '완료'
    if (p.paid_confirmed_at || p.settlement_status === '완료') status = '완료'
    else if (p.settled_at && !p.paid_confirmed_at && !p.paid_disputed_at) status = '확인 대기'
    else if (sd && sd < todayStr) status = '미수'
    else status = '예정'
    return { budget: p.budget ?? 0, settlementDate: sd, status }
  })
  // 이번 달 매출: 결제 예정일이 이번 달인 모든 건(완료·미수·확인대기·예정)
  const monthEarn = earnRows.filter((e) =>
    e.settlementDate != null &&
    Number(e.settlementDate.slice(0, 4)) === year &&
    Number(e.settlementDate.slice(5, 7)) === month
  )
  const monthTotal = monthEarn.reduce((s, e) => s + e.budget, 0)
  const pendingTotal = monthEarn.filter((e) => e.status === '예정').reduce((s, e) => s + e.budget, 0)
  // 미수: 기간 무관(항상 전체)
  const overdueCount = earnRows.filter((e) => e.status === '미수').length

  // 채널 분석
  const { data: blogAnalytics } = await supabase
    .from('blog_analytics')
    .select('blog_id,neighbor_count,visitor_today,post_count,post_keyword_rankings,blog_grade,crawled_at')
    .eq('user_id', user.id)
    .order('crawled_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 알림
  const { data: notifs } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
  const unreadNotif = (notifs ?? []).filter((n) => !n.is_read).length
  const notifPreview = (notifs ?? []).slice(0, 3)

  // 정산 당일 — 결제 예정일이 오늘인 건
  const settlementDue = earnRows.filter((e) => e.settlementDate === todayStr).length

  // 오픈 상태 파생
  const opensWithStatus = (opens ?? []).map((o) => {
    let st: '진행중' | '메이드' | '마감' | '캔슬' = '진행중'
    if (o.status === 'cancelled') st = '캔슬'
    else if (madeSchedules.has(o.id)) st = '메이드'
    // 기간 오픈은 끝나야 마감이다 — 시작일로 보면 진행 중인 기간이 마감으로 뜬다
    else if ((o.date_end || o.date) < todayStr) st = '마감'
    const dash = dashBySchedule[o.id]
    return {
      id: o.id,
      title: o.title,
      date: o.date,
      date_end: o.date_end ?? null,
      location_city: o.location_city,
      location_district: o.location_district,
      derivedStatus: st,
      dashHref: dash ? `/influencer/messages?receiverId=${dash.advertiserId}&proposalId=${dash.proposalId}` : null,
    }
  })

  const monthOpenCount = (opens ?? []).filter((o) => o.date >= start && o.date <= end).length

  const card = 'bg-white [.inf-pc_&]:border [.inf-pc_&]:border-[#EAEAEE] rounded-2xl [.inf-pc_&]:rounded-[14px] shadow-sm [.inf-pc_&]:shadow-none'

  // 셸은 influencer/layout.tsx 가 씌운다 — 여기서 또 부르면 사이드바가 두 겹이 된다.
  return (
    <>
      <NotificationsRealtime userId={user.id} />

      <CancelNoticeCard role="influencer" count={profile?.cancellation_count} />

      {/* 히어로: 프로필 + 매치스코어 + 블로그등급 + 크레딧 (모바일만 — PC는 헤더/사이드바에 이미 노출) */}
      <section className="[.inf-pc_&]:hidden bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-[#FEF3C7] text-[#B45309] text-xl font-extrabold flex items-center justify-center shrink-0">
          {initial(profile?.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900 truncate">{profile?.name}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {ip?.match_score != null && (
              <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-[#DBEAFE] text-[#1D4ED8]">
                매치 {ip.match_score}점
              </span>
            )}
            {blogAnalytics?.blog_grade && (
              <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309]">
                블로그 {blogAnalytics.blog_grade}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* PC KPI 4칸 */}
      <div className="hidden [.inf-pc_&]:grid grid-cols-4 gap-3.5">
        <div className="bg-white border border-[#EAEAEE] rounded-xl px-[18px] py-4">
          <div className="text-xs font-semibold text-[#7C7C88]">답 기다리는 제안</div>
          <div className="text-[22px] font-extrabold text-[#DC2626] mt-1">{awaitingProposals.length}건</div>
        </div>
        <div className="bg-white border border-[#EAEAEE] rounded-xl px-[18px] py-4">
          <div className="text-xs font-semibold text-[#7C7C88]">진행중 협업</div>
          <div className="text-[22px] font-extrabold mt-1">{inProgress.length}건</div>
        </div>
        <div className="bg-white border border-[#EAEAEE] rounded-xl px-[18px] py-4">
          <div className="text-xs font-semibold text-[#7C7C88]">이번 달 매출</div>
          <div className="text-[22px] font-extrabold mt-1">{monthTotal.toLocaleString()}원</div>
          {overdueCount > 0 && (
            <div className="text-[11px] font-semibold text-[#DC2626] mt-0.5">미수 {overdueCount}건</div>
          )}
        </div>
        <div className="bg-white border border-[#EAEAEE] rounded-xl px-[18px] py-4">
          <div className="text-xs font-semibold text-[#7C7C88]">블로그 등급</div>
          <div className="text-[22px] font-extrabold mt-1">{blogAnalytics?.blog_grade ?? '—'}</div>
        </div>
      </div>

      {/* 답을 기다리는 제안 — 가장 급한 것 */}
      {awaitingProposals.length > 0 && (
        <Link
          href="/influencer/messages"
          className="block bg-[#FFFBEB] border border-[#FDE68A] [.inf-pc_&]:rounded-[14px] rounded-2xl px-4 py-3 hover:bg-[#FEF3C7] transition"
        >
          <p className="text-[13px] font-bold text-[#92400E] flex items-center gap-1.5">
            <Hourglass size={14} strokeWidth={1.75} />
            답을 기다리는 제안 {awaitingProposals.length}건
          </p>
          <p className="text-[11.5px] text-[#B45309] mt-0.5">
            {awaitingProposals[0].advertiserName}님 외 — 대시에서 확인하고 수락하거나 조율하세요
          </p>
        </Link>
      )}

      <div className="flex flex-col gap-6 [.inf-pc_&]:grid [.inf-pc_&]:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] [.inf-pc_&]:gap-[14px] [.inf-pc_&]:items-stretch">
        {/* 좌 (PC) / 상단 (모바일) */}
        <div className="flex flex-col gap-6 [.inf-pc_&]:gap-[14px] min-w-0">
          {/* 이번 주 일정 7일 스트립 (모바일) / 캘린더(PC) */}
          <section className="[.inf-pc_&]:hidden">
            <h2 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
              <CalendarDays size={15} strokeWidth={1.75} className="opacity-70" /> 이번 주 일정
            </h2>
            <div className="grid grid-cols-7 gap-1.5">
              {weekStrip.map((d) => (
                <Link
                  key={d.date}
                  href={`/day/${d.date}`}
                  className={`rounded-xl p-1.5 flex flex-col items-center gap-1 border ${
                    d.isToday ? 'border-amber-400 bg-[#FEF3C7]' : 'border-transparent bg-white shadow-sm'
                  }`}
                >
                  <span className="text-[10px] text-gray-400">{d.dow}</span>
                  <span className={`text-[13px] font-bold ${d.isToday ? 'text-[#B45309]' : 'text-gray-700'}`}>{d.day}</span>
                  <div className="flex gap-0.5">
                    {d.counts.open > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />}
                    {d.counts.campaign > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className={card + ' [.inf-pc_&]:block hidden p-5'}>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-[14.5px] font-bold">내 캘린더</h2>
              <p className="text-xs text-gray-500">
                <span className="text-amber-600 font-medium">매칭 캠페인 {camps.length}</span> ·{' '}
                <span className="text-[#B45309] font-medium">내 오픈 {monthOpenCount}</span>
              </p>
            </div>
            <HomeCalendar year={year} month={month} countsByDate={countsByDate} isLoggedIn={true} />
          </section>

          {/* 빠른 액션 (모바일만 — PC는 사이드바로 대체) */}
          <section className="[.inf-pc_&]:hidden grid grid-cols-2 gap-3">
            <Link
              href="/influencer/schedule"
              className="bg-[#F59E0B] text-white rounded-2xl p-4 shadow-sm hover:bg-[#D97706] transition text-center"
            >
              <Plus size={22} strokeWidth={2} className="mx-auto mb-1" />
              <p className="font-semibold text-sm">오픈 등록</p>
            </Link>
            <Link
              href="/influencer/search"
              className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-center"
            >
              <Search size={22} strokeWidth={1.75} className="mx-auto mb-1 text-gray-700" />
              <p className="font-semibold text-sm text-gray-800">캠페인 찾기</p>
            </Link>
          </section>

          {/* 받은 제안 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm [.inf-pc_&]:text-[14.5px] font-bold text-gray-800 flex items-center gap-1.5">
                <Inbox size={15} strokeWidth={1.75} className="opacity-70" /> 받은 대시
              </h2>
              <Link href="/influencer/messages" className="text-xs text-[#B45309] hover:underline">전체보기 →</Link>
            </div>
            {awaitingProposals.length === 0 ? (
              <p className="text-sm text-gray-400 bg-white [.inf-pc_&]:border [.inf-pc_&]:border-[#EAEAEE] rounded-2xl [.inf-pc_&]:rounded-[14px] p-4 shadow-sm [.inf-pc_&]:shadow-none">
                받은 대시가 없어요.
              </p>
            ) : (
              <div className="space-y-2 [.inf-pc_&]:space-y-0 [.inf-pc_&]:border [.inf-pc_&]:border-[#EAEAEE] [.inf-pc_&]:rounded-[14px] [.inf-pc_&]:overflow-hidden [.inf-pc_&]:bg-white">
                {awaitingProposals.slice(0, 5).map((p) => (
                  <Link
                    key={p.id}
                    href={`/influencer/messages?receiverId=${p.advertiser_id}&proposalId=${p.id}`}
                    className="flex items-center bg-white [.inf-pc_&]:bg-transparent rounded-2xl [.inf-pc_&]:rounded-none p-3 [.inf-pc_&]:px-4 [.inf-pc_&]:py-3 shadow-sm [.inf-pc_&]:shadow-none [.inf-pc_&]:border-b [.inf-pc_&]:border-[#F5F5F7] hover:shadow-md [.inf-pc_&]:hover:bg-[#FAFAFB] transition"
                  >
                    <div className="w-9 h-9 bg-[#DBEAFE] rounded-full flex items-center justify-center text-[#1D4ED8] font-bold mr-3 shrink-0">
                      {initial(p.advertiserName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-gray-800 truncate">{p.title}</p>
                      <p className="text-xs text-gray-400 truncate flex items-center gap-1.5">
                        {p.advertiserName}{p.budget ? ` · ${p.budget.toLocaleString()}원` : ''}
                        {p.onTimeRate != null && (
                          <span className={`inline-flex items-center gap-1 text-[10.5px] font-medium ${p.onTimeRate >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${p.onTimeRate >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            정산 {p.onTimeRate}%
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="ml-2 shrink-0 text-[11px] bg-[#FEF3C7] text-[#B45309] px-2 py-0.5 rounded-full font-semibold">대시 열기</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* 진행중 협업 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm [.inf-pc_&]:text-[14.5px] font-bold text-gray-800 flex items-center gap-1.5">
                <Handshake size={15} strokeWidth={1.75} className="opacity-70" /> 진행중 협업
              </h2>
            </div>
            {inProgress.length === 0 ? (
              <p className="text-sm text-gray-400 bg-white [.inf-pc_&]:border [.inf-pc_&]:border-[#EAEAEE] rounded-2xl [.inf-pc_&]:rounded-[14px] p-4 shadow-sm [.inf-pc_&]:shadow-none">
                진행중인 협업이 없어요.
              </p>
            ) : (
              <div className="space-y-2 [.inf-pc_&]:space-y-0 [.inf-pc_&]:border [.inf-pc_&]:border-[#EAEAEE] [.inf-pc_&]:rounded-[14px] [.inf-pc_&]:overflow-hidden [.inf-pc_&]:bg-white">
                {inProgress.slice(0, 5).map((p) => (
                  <Link
                    key={p.id}
                    href={`/influencer/messages?receiverId=${p.advertiser_id}&proposalId=${p.id}`}
                    className="flex items-center bg-white [.inf-pc_&]:bg-transparent rounded-2xl [.inf-pc_&]:rounded-none p-3 [.inf-pc_&]:px-4 [.inf-pc_&]:py-3 shadow-sm [.inf-pc_&]:shadow-none [.inf-pc_&]:border-b [.inf-pc_&]:border-[#F5F5F7] hover:shadow-md [.inf-pc_&]:hover:bg-[#FAFAFB] transition"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-gray-800 truncate">{p.title}</p>
                      <p className="text-xs text-gray-400 truncate">{p.stage ?? '협의'} · 다음: {NEXT_STEP[p.stage ?? '협의']}</p>
                    </div>
                    <span className="ml-2 shrink-0 text-xs font-semibold text-gray-500">
                      {p.budget ? `${p.budget.toLocaleString()}원` : ''}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* 내 오픈 목록 (모바일만 — PC는 별도 사이드바 메뉴로 이동) */}
          <section className="[.inf-pc_&]:hidden">
            <MyOpensList opens={opensWithStatus} />
          </section>
        </div>

        {/* 우 (PC) / 하단 (모바일) */}
        <div className="flex flex-col gap-6 [.inf-pc_&]:gap-[14px] min-w-0">
          {/* 내 채널 분석 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm [.inf-pc_&]:text-[14.5px] font-bold text-gray-800 flex items-center gap-1.5">
                <BarChart3 size={15} strokeWidth={1.75} className="opacity-70" /> 내 채널 분석
              </h2>
              <Link href="/influencer/channel-analytics" className="text-xs text-[#B45309] hover:underline">상세보기 →</Link>
            </div>
            <BlogAnalyticsSummaryCard data={blogAnalytics} />
          </section>

          {/* 이번 달 수익 */}
          <section>
            <Link
              href="/influencer/earnings"
              className="block bg-white [.inf-pc_&]:border [.inf-pc_&]:border-[#EAEAEE] rounded-2xl [.inf-pc_&]:rounded-[14px] p-5 shadow-sm [.inf-pc_&]:shadow-none hover:shadow-md [.inf-pc_&]:hover:bg-[#FAFAFB] transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 flex items-center gap-1.5">
                    <Wallet size={14} strokeWidth={1.75} className="opacity-70" /> 이번 달 매출
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">{monthTotal.toLocaleString()}원</p>
                  {pendingTotal > 0 && (
                    <p className="text-xs text-orange-500 mt-0.5">정산 예정 {pendingTotal.toLocaleString()}원</p>
                  )}
                  {settlementDue > 0 && (
                    <p className="text-xs text-red-500 mt-0.5">오늘 정산 예정 {settlementDue}건</p>
                  )}
                  {overdueCount > 0 && (
                    <p className="text-xs font-semibold text-[#DC2626] mt-0.5">미수 {overdueCount}건</p>
                  )}
                </div>
                <span className="text-gray-300">상세 →</span>
              </div>
            </Link>
          </section>

          {/* 알림함 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm [.inf-pc_&]:text-[14.5px] font-bold text-gray-800 flex items-center gap-1.5">
                <Bell size={15} strokeWidth={1.75} className="opacity-70" /> 알림함
                {unreadNotif > 0 && (
                  <span className="ml-1.5 text-[11px] bg-red-500 text-white px-2 py-0.5 rounded-full align-middle">
                    {unreadNotif}
                  </span>
                )}
              </h2>
              <Link href="/influencer/notifications" className="text-xs text-[#B45309] hover:underline">전체보기 →</Link>
            </div>
            {notifPreview.length === 0 ? (
              <p className="text-sm text-gray-400 bg-white [.inf-pc_&]:border [.inf-pc_&]:border-[#EAEAEE] rounded-2xl [.inf-pc_&]:rounded-[14px] p-4 shadow-sm [.inf-pc_&]:shadow-none">
                아직 알림이 없어요.
              </p>
            ) : (
              <div className="space-y-2 [.inf-pc_&]:space-y-0 [.inf-pc_&]:border [.inf-pc_&]:border-[#EAEAEE] [.inf-pc_&]:rounded-[14px] [.inf-pc_&]:overflow-hidden [.inf-pc_&]:bg-white">
                {notifPreview.map((n) => (
                  <Link
                    key={n.id}
                    href="/influencer/notifications"
                    className={`flex items-start gap-3 rounded-2xl [.inf-pc_&]:rounded-none p-3 [.inf-pc_&]:px-4 shadow-sm [.inf-pc_&]:shadow-none [.inf-pc_&]:border-b [.inf-pc_&]:border-[#F5F5F7] transition ${
                      n.is_read ? 'bg-white [.inf-pc_&]:bg-transparent' : 'bg-[#FEF3C7] hover:bg-[#FDE68A] [.inf-pc_&]:bg-[#FFFBEB]'
                    }`}
                  >
                    {(() => {
                      const Icon = NOTIF_ICON[n.type] ?? Bell
                      return <Icon size={16} strokeWidth={1.75} className="shrink-0 mt-0.5 opacity-70" />
                    })()}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${n.is_read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title}</p>
                      {n.body && <p className="text-xs text-gray-400 truncate">{n.body}</p>}
                    </div>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-[#F59E0B] shrink-0 mt-1.5" />}
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* 대시 · 메시지 미리보기 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm [.inf-pc_&]:text-[14.5px] font-bold text-gray-800 flex items-center gap-1.5">
                <MessageSquare size={15} strokeWidth={1.75} className="opacity-70" /> 대시
              </h2>
              <Link href="/influencer/messages" className="text-xs text-[#B45309] hover:underline">전체보기 →</Link>
            </div>
            {convPreview.length === 0 ? (
              <p className="text-sm text-gray-400 bg-white [.inf-pc_&]:border [.inf-pc_&]:border-[#EAEAEE] rounded-2xl [.inf-pc_&]:rounded-[14px] p-4 shadow-sm [.inf-pc_&]:shadow-none">
                아직 주고받은 대시가 없어요.
              </p>
            ) : (
              <div className="space-y-2 [.inf-pc_&]:space-y-0 [.inf-pc_&]:border [.inf-pc_&]:border-[#EAEAEE] [.inf-pc_&]:rounded-[14px] [.inf-pc_&]:overflow-hidden [.inf-pc_&]:bg-white">
                {convPreview.map((c) => (
                  <Link
                    key={c.otherId}
                    href={`/influencer/messages?receiverId=${c.otherId}`}
                    className="flex items-center bg-white [.inf-pc_&]:bg-transparent rounded-2xl [.inf-pc_&]:rounded-none p-3 [.inf-pc_&]:px-4 shadow-sm [.inf-pc_&]:shadow-none [.inf-pc_&]:border-b [.inf-pc_&]:border-[#F5F5F7] hover:shadow-md [.inf-pc_&]:hover:bg-[#FAFAFB] transition"
                  >
                    <div className="w-10 h-10 bg-[#FEF3C7] rounded-full flex items-center justify-center text-[#B45309] font-bold mr-3">
                      {initial(nameById[c.otherId])}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800">{nameById[c.otherId] ?? '상대방'}</p>
                      <p className="text-xs text-gray-400 truncate">{c.last?.content}</p>
                    </div>
                    {c.unread ? (
                      <span className="ml-2 shrink-0 text-[11px] bg-red-100 text-red-500 px-2 py-0.5 rounded-full">미응답</span>
                    ) : (
                      <span className="ml-2 shrink-0 text-[11px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">상대 미확인</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
