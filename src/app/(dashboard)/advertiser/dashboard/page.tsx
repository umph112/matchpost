import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import CampaignCalendar from '@/components/CampaignCalendar'
import NotificationsRealtime from '@/components/NotificationsRealtime'
import IncomingHandoverBanner, { type IncomingHandoverItem } from '@/components/IncomingHandoverBanner'
import CancelNoticeCard from '@/components/CancelNoticeCard'
import { initial } from '@/lib/initial'
import { resolveCompany } from '@/lib/team/company'
import {
  Search, Bell, FileText, Megaphone, Pencil, CheckCircle2, Ban, CalendarPlus,
  Handshake, MessageSquare, Wallet, Hourglass, CheckSquare, type LucideIcon,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const pad = (n: number) => String(n).padStart(2, '0')

const NOTIF_ICON: Record<string, LucideIcon> = {
  campaign_created: Megaphone, campaign_updated: Pencil, campaign_completed: CheckCircle2, campaign_cancelled: Ban,
  open_created: CalendarPlus, open_completed: CheckCircle2, open_cancelled: Ban,
  deal_made: Handshake, dash_received: MessageSquare, settlement_due: Wallet,
  deal_confirm_request: Hourglass, deal_confirm_self: CheckSquare,
}

export default async function AdvertiserMyPage() {
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
  if (profile?.role === 'influencer') redirect('/influencer/dashboard')
  if (profile?.role !== 'advertiser') redirect('/login')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const start = `${year}-${pad(month)}-01`
  const end = `${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`
  const todayStr = `${year}-${pad(month)}-${pad(now.getDate())}`

  // 회사(대표) 해석 — 팀원이면 소속 회사(owner_id)의 데이터를 본다. 대표면 본인=회사(무변경).
  const company = await resolveCompany(supabase, user.id)

  // 모드(내 업무/회사 관리) — 대표만 전환 가능. 팀원은 항상 「내 담당」.
  const cookieStore = await cookies()
  const view = cookieStore.get('adv_view')?.value === 'all' ? 'all' : 'me'
  // 「내 담당」이면 manager_id=본인으로 좁힌다. 솔로 대표는 모든 캠페인이 본인 담당이라 무변경.
  const scopeToMe = company.isMember || view === 'me'

  // 5-5 받는 사람 이관 배너 — 나에게 캠페인이 넘어오기 시작한 퇴사(예정/비활성) 팀원별 진행률.
  // 받는 사람은 미리 지정되지 않으므로(5-3) transfers(to_id=나)로 대상 퇴사자를 역산한다.
  // remaining(퇴사자에게 남은 캠페인)이 0이면 배너를 띄우지 않는다.
  const incomingHandovers: IncomingHandoverItem[] = []
  {
    const { data: myReceipts } = await supabase
      .from('transfers')
      .select('from_id')
      .eq('to_id', user.id)
      .eq('kind', 'campaign')
    const recByLeaver: Record<string, number> = {}
    for (const r of myReceipts ?? []) {
      const f = r.from_id as string | null
      if (f) recByLeaver[f] = (recByLeaver[f] ?? 0) + 1
    }
    const leaverIds = Object.keys(recByLeaver)
    if (leaverIds.length) {
      const { data: leaverRows } = await supabase
        .from('team_members')
        .select('member_id, leave_on')
        .eq('owner_id', company.advertiserId)
        .in('member_id', leaverIds)
        .in('status', ['leaving', 'inactive'])
      const { data: leaverProfs } = await supabase.from('profiles').select('id, name').in('id', leaverIds)
      const lname = Object.fromEntries(
        (leaverProfs ?? []).map((p) => [p.id as string, (p.name as string | null) || '이름 미설정']),
      )
      for (const lr of leaverRows ?? []) {
        const lid = lr.member_id as string
        const { count } = await supabase
          .from('campaigns')
          .select('id', { count: 'exact', head: true })
          .eq('advertiser_id', company.advertiserId)
          .eq('manager_id', lid)
        const remaining = count ?? 0
        if (remaining === 0) continue // 남은 게 없으면 배너를 띄우지 않는다
        const received = recByLeaver[lid] ?? 0
        incomingHandovers.push({
          leaverId: lid,
          leaverName: lname[lid] ?? '이름 미설정',
          leaveOn: (lr.leave_on as string | null) ?? null,
          total: received + remaining,
          received,
          remaining,
        })
      }
    }
  }

  const { data: campaigns } = scopeToMe
    ? await supabase
        .from('campaigns')
        .select('*')
        .eq('advertiser_id', company.advertiserId)
        .eq('manager_id', user.id)
        .order('created_at', { ascending: false })
    : await supabase
        .from('campaigns')
        .select('*')
        .eq('advertiser_id', company.advertiserId)
        .order('created_at', { ascending: false })
  const campIds = (campaigns ?? []).map((c) => c.id)

  // 캠페인별 참여 인플루언서(제안) 집계
  const { data: cProposals } = campIds.length
    ? await supabase.from('proposals').select('campaign_id, advertiser_confirmed, influencer_confirmed, budget').in('campaign_id', campIds)
    : { data: [] }
  const byCamp: Record<string, { total: number; confirmed: number; negotiating: number }> = {}
  let spendConfirmed = 0
  for (const p of cProposals ?? []) {
    const g = (byCamp[p.campaign_id] ??= { total: 0, confirmed: 0, negotiating: 0 })
    g.total++
    if (p.advertiser_confirmed && p.influencer_confirmed) {
      g.confirmed++
      spendConfirmed += p.budget || 0
    } else {
      g.negotiating++
    }
  }

  // 이번 달 공개 오픈(인플루언서가 공개로 연 일정) + 인플루언서 정보
  const { data: openRows } = await supabase
    .from('schedules')
    .select('*')
    .eq('is_public', true)
    .eq('status', 'open')
    .gte('date', start)
    .lte('date', end)
    .order('date')
  const openInfIds = [...new Set((openRows ?? []).map((o) => o.influencer_id))]
  const { data: openProfiles } = openInfIds.length
    ? await supabase.from('profiles').select('id, name').in('id', openInfIds)
    : { data: [] }
  const { data: openIps } = openInfIds.length
    ? await supabase.from('influencer_profiles').select('user_id, follower_count, categories').in('user_id', openInfIds)
    : { data: [] }
  const pNameById = Object.fromEntries((openProfiles ?? []).map((p) => [p.id, p.name]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ipById: Record<string, any> = Object.fromEntries((openIps ?? []).map((i) => [i.user_id, i]))
  const openCount = (openRows ?? []).length

  // 메시지 미리보기 — unread(미응답)는 대화를 열면(is_read=true) 사라지는 단일 값에서 파생(A1)
  const { data: msgs } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(60)
  const convMap: Record<string, { otherId: string; last: { content?: string }; unread: boolean }> = {}
  for (const m of msgs ?? []) {
    const other = m.sender_id === user.id ? m.receiver_id : m.sender_id
    if (!convMap[other]) convMap[other] = { otherId: other, last: m, unread: false }
    if (m.receiver_id === user.id && !m.is_read) convMap[other].unread = true
  }
  const convPreview = Object.values(convMap).slice(0, 3)
  const otherIds = convPreview.map((c) => c.otherId)
  const { data: names } = otherIds.length
    ? await supabase.from('profiles').select('id, name').in('id', otherIds)
    : { data: [] }
  const nameById = Object.fromEntries((names ?? []).map((p) => [p.id, p.name]))
  const convIdByOther: Record<string, string> = {}
  for (const oid of otherIds) {
    const { data: convId } = await supabase.rpc('get_or_create_conversation', {
      p_advertiser_id: user.id, p_kind: 'personal', p_campaign_id: null, p_other_id: oid,
    })
    if (convId) convIdByOther[oid] = convId as string
  }

  // 알림
  const { data: notifs } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
  const unreadNotif = (notifs ?? []).filter((n) => !n.is_read).length
  const notifPreview = (notifs ?? []).slice(0, 3)

  // 캠페인 상태 파생
  const campaignsWithStatus = (campaigns ?? []).map((c) => {
    let st: '진행중' | '마감' | '캔슬' | '완료' = '진행중'
    if (c.status === 'cancelled') st = '캔슬'
    else if (c.status === 'completed') st = '완료'
    else if (c.date && c.date < todayStr) st = '마감'
    return { ...c, derivedStatus: st, stats: byCamp[c.id] ?? { total: 0, confirmed: 0, negotiating: 0 } }
  })
  const monthCampCount = (campaigns ?? []).filter((c) => c.date >= start && c.date <= end).length
  const recentCampaigns = campaignsWithStatus.slice(0, 5)

  // 캘린더 날짜별 데이터 (내 캠페인 + 공개 오픈) — 셀 카운트 + 팝업(STEP 5)용
  const dayOf = (dateStr: string) => parseInt(dateStr.slice(8, 10))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byDay: Record<number, { campaigns: any[]; opens: any[] }> = {}
  for (const c of campaignsWithStatus) {
    if (c.date && c.date >= start && c.date <= end) (byDay[dayOf(c.date)] ??= { campaigns: [], opens: [] }).campaigns.push(c)
  }
  for (const o of openRows ?? []) {
    ;(byDay[dayOf(o.date)] ??= { campaigns: [], opens: [] }).opens.push({
      id: o.id,
      name: pNameById[o.influencer_id] || '인플루언서',
      category: ipById[o.influencer_id]?.categories?.[0] || o.predefined_categories?.[0] || '',
      followers: ipById[o.influencer_id]?.follower_count || 0,
      channels: o.channels || null,
      region: [o.location_city, o.location_district].filter(Boolean).join(' '),
      time: o.start_time ? `${String(o.start_time).slice(0, 5)}${o.end_time ? '~' + String(o.end_time).slice(0, 5) : ''}` : '종일',
      fee: o.fee || null,
      memo: o.memo || null,
      influencerId: o.influencer_id,
    })
  }

  // 양식함 (저장된 상세 양식). 없으면 예시로 모양 채움.
  const { data: detailTpls } = await supabase
    .from('campaign_detail_templates')
    .select('id, name')
    .eq('advertiser_id', user.id)
    .order('created_at', { ascending: false })
    .limit(6)
  const savedForms =
    detailTpls && detailTpls.length > 0
      ? detailTpls.map((t) => ({ ...t, sample: false }))
      : [
          { id: 's1', name: '방문형 카페 리뷰 기본 양식', sample: true },
          { id: 's2', name: '제품 협찬 블로그 양식', sample: true },
          { id: 's3', name: '기자단 배포 양식', sample: true },
        ]

  // 친구등록 인플루언서 (기능 미구현 — 예시 데이터로 모양 채움)
  const favInfluencers = [
    { id: 'f1', name: '뷰티하는 지연', followers: 82000, category: '뷰티' },
    { id: 'f2', name: '먹방요정 하루', followers: 154000, category: '맛집' },
    { id: 'f3', name: '여행자 민준', followers: 47000, category: '여행' },
    { id: 'f4', name: '홈카페 소소', followers: 33000, category: '라이프' },
  ]

  // KPI
  const ongoingCount = campaignsWithStatus.filter((c) => c.derivedStatus === '진행중').length
  let confirmedInf = 0
  let negotiatingInf = 0
  for (const c of campaignsWithStatus) {
    confirmedInf += c.stats.confirmed
    negotiatingInf += c.stats.negotiating
  }
  const respWaiting = Object.values(convMap).filter((c) => c.unread).length
  const kpis = [
    { label: '진행중 캠페인', value: String(ongoingCount), unit: '건', sub: `이번 달 등록 ${monthCampCount}건`, dot: '#F59E0B' },
    { label: '확정 인플루언서', value: String(confirmedInf), unit: '명', sub: `협의중 ${negotiatingInf}명`, dot: '#22C55E' },
    { label: '확정 집행 예정', value: spendConfirmed.toLocaleString(), unit: '원', sub: '양쪽 확정 기준', dot: '#3B82F6' },
    { label: '응답 대기', value: String(respWaiting), unit: '건', sub: '미응답 대화', dot: '#EF4444' },
  ]

  const STATUS_STYLE: Record<string, string> = {
    진행중: 'bg-[#FEF3C7] text-[#B45309]',
    완료: 'bg-[#DCFCE7] text-[#15803D]',
    마감: 'bg-[#F1F1F4] text-[#7C7C88]',
    캔슬: 'bg-[#FEE2E2] text-[#DC2626]',
  }
  const BAR_COLOR: Record<string, string> = { 진행중: '#F59E0B', 완료: '#22C55E', 마감: '#C4C4CE', 캔슬: '#F87171' }
  const CAMP_COLS = 'grid-cols-[minmax(0,1fr)_96px_108px_120px_92px]'

  const card = 'bg-white border border-[#EAEAEE] rounded-[14px] overflow-hidden'
  const cardHead = 'h-[52px] flex items-center border-b border-[#F1F1F4] shrink-0'

  return (
    <div className="flex flex-col gap-5 [.adv-pc_&]:gap-[14px]">
      <NotificationsRealtime userId={user.id} />

      {/* 5-5 받는 사람 이관 배너 — 넘어오는 담당이 있을 때만, 내 페이지 위에 한 줄. */}
      <IncomingHandoverBanner items={incomingHandovers} />

      <CancelNoticeCard role="advertiser" count={profile?.cancellation_count} />

      {/* 페이지 헤더 */}
      <div className="flex flex-col gap-3 [.adv-pc_&]:flex-row [.adv-pc_&]:items-end [.adv-pc_&]:gap-4">
        <div>
          <h1 className="text-[23px] font-extrabold tracking-[-0.03em] text-[#17171B]">마이페이지</h1>
          <p className="text-[13px] text-[#7C7C88] mt-1">확정 대기 {negotiatingInf}건 · 진행중 캠페인 {ongoingCount}건이 있어요.</p>
        </div>
        <div className="flex gap-2 [.adv-pc_&]:ml-auto">
          <Link href="/advertiser/search" className="flex items-center gap-1.5 h-[38px] px-[15px] rounded-[9px] border border-[#E2E2E8] bg-white text-[13px] font-semibold text-[#3C3C46] hover:bg-[#F6F6F7]">
            <Search size={14} strokeWidth={1.75} /> 인플루언서 찾기
          </Link>
          <Link href="/advertiser/connections" className="flex items-center gap-1.5 h-[38px] px-[15px] rounded-[9px] border border-[#E2E2E8] bg-white text-[13px] font-semibold text-[#3C3C46] hover:bg-[#F6F6F7]">
            <Handshake size={14} strokeWidth={1.75} /> 내 인플루언서
          </Link>
          <Link href="/advertiser/campaigns/new" className="flex items-center gap-1.5 h-[38px] px-4 rounded-[9px] bg-[#F59E0B] text-white text-[13px] font-bold hover:bg-[#D97706] shadow-[0_1px_2px_rgba(245,158,11,0.35)]">
            ＋ 캠페인 등록
          </Link>
        </div>
      </div>

      {/* KPI 행 */}
      <div className="grid grid-cols-2 [.adv-pc_&]:grid-cols-4 gap-3.5">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-[#EAEAEE] rounded-xl px-[18px] py-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-[2px]" style={{ background: k.dot }} />
              <span className="text-xs font-semibold text-[#7C7C88]">{k.label}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[26px] font-extrabold tracking-[-0.035em] leading-none">{k.value}</span>
              <span className="text-xs font-semibold text-[#9A9AA5]">{k.unit}</span>
            </div>
            <div className="text-[11.5px] text-[#9A9AA5]">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* 2단 그리드 */}
      <div className="flex flex-col gap-[14px] [.adv-pc_&]:grid [.adv-pc_&]:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] [.adv-pc_&]:gap-[14px] [.adv-pc_&]:items-stretch">
        {/* 좌 */}
        <div className="flex flex-col gap-5 [.adv-pc_&]:gap-[14px] min-w-0">
          {/* 캘린더 */}
          <section className={card}>
            <div className={cardHead + ' gap-3 px-5'}>
              <h2 className="text-[14.5px] font-bold tracking-[-0.01em] whitespace-nowrap">캠페인 캘린더</h2>
              <div className="flex items-center gap-3 ml-2.5 whitespace-nowrap">
                <span className="flex items-center gap-1.5 text-[11.5px] text-[#7C7C88]">
                  <span className="w-[7px] h-[7px] rounded-[2px] bg-[#F59E0B]" />내 캠페인 {monthCampCount} <span className="text-[#B0B0BB]">(내가 등록)</span>
                </span>
                <span className="flex items-center gap-1.5 text-[11.5px] text-[#7C7C88]">
                  <span className="w-[7px] h-[7px] rounded-[2px] bg-[#3B82F6]" />공개 오픈 {openCount} <span className="text-[#B0B0BB]">(전체)</span>
                </span>
              </div>
              <span className="ml-auto text-[13px] font-bold">{year}. {month}</span>
            </div>
            <div className="p-5 pt-3.5 pb-[18px]">
              <CampaignCalendar year={year} month={month} byDay={byDay} />
            </div>
          </section>

          {/* 최근 캠페인 (표는 STEP 3에서 정식 컬럼화) */}
          <section className={card + ' flex-1 flex flex-col'}>
            <div className={cardHead + ' px-5'}>
              <h2 className="text-[14.5px] font-bold tracking-[-0.01em]">최근 캠페인</h2>
              <span className="ml-2 text-[11.5px] text-[#9A9AA5]">총 {campaignsWithStatus.length}건</span>
              <Link href="/advertiser/campaigns" className="ml-auto text-xs font-semibold text-[#B45309] hover:text-[#92400E]">전체보기 →</Link>
            </div>
            {recentCampaigns.length === 0 ? (
              <p className="text-sm text-[#9A9AA5] p-5">아직 등록한 캠페인이 없어요.</p>
            ) : (
              <div className="overflow-x-auto">
               <div className="min-w-[560px]">
                {/* 표 헤더 */}
                <div className={`grid ${CAMP_COLS} px-5 py-[9px] bg-[#FAFAFB] border-b border-[#F1F1F4]`}>
                  <span className="text-[11px] font-bold text-[#9A9AA5]">캠페인</span>
                  <span className="text-[11px] font-bold text-[#9A9AA5]">상태</span>
                  <span className="text-[11px] font-bold text-[#9A9AA5] text-right">모집</span>
                  <span className="text-[11px] font-bold text-[#9A9AA5] text-right">확정 예산</span>
                  <span className="text-[11px] font-bold text-[#9A9AA5] text-right">딜시트</span>
                </div>
                {/* 데이터 행 */}
                {recentCampaigns.map((c) => {
                  const target = c.recruit_target || c.stats.total || 0
                  const pct = target > 0 ? Math.min(100, Math.round((c.stats.confirmed / target) * 100)) : 0
                  const meta = [c.campaign_type || '캠페인', c.channels?.length ? c.channels.join('·') : null, c.location_city || null, c.date || null]
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <Link
                      key={c.id}
                      href={`/advertiser/campaigns/${c.id}`}
                      className={`grid ${CAMP_COLS} items-center px-5 py-[13px] border-b border-[#F5F5F7] hover:bg-[#FAFAFB]`}
                    >
                      <div className="min-w-0 pr-3.5">
                        <div className="text-[13.5px] font-semibold truncate tracking-[-0.01em]">{c.title}</div>
                        <div className="text-[11.5px] text-[#9A9AA5] mt-[3px] truncate">{meta}</div>
                      </div>
                      <div>
                        <span className={`text-[11px] font-bold px-2 py-[3px] rounded-[5px] ${STATUS_STYLE[c.derivedStatus]}`}>{c.derivedStatus}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[12.5px] font-semibold">
                          확정 {c.stats.confirmed}
                          <span className="text-[#B0B0BB]">/{target}</span>
                        </div>
                        <div className="h-1 rounded-[2px] bg-[#F1F1F4] mt-[5px] ml-auto w-[78px] overflow-hidden">
                          <div className="h-full rounded-[2px]" style={{ width: pct + '%', background: BAR_COLOR[c.derivedStatus] }} />
                        </div>
                      </div>
                      <div className="text-right text-[12.5px] font-semibold [font-variant-numeric:tabular-nums]">
                        {c.budget_total ? c.budget_total.toLocaleString() : '—'}
                      </div>
                      <div className="text-right text-[12px] font-semibold text-[#B45309]">열기 →</div>
                    </Link>
                  )
                })}
               </div>
              </div>
            )}
          </section>
        </div>

        {/* 우 */}
        <div className="flex flex-col gap-5 [.adv-pc_&]:gap-[14px] min-w-0">
          {/* 대시·메시지 */}
          <section className={card}>
            <div className={cardHead + ' px-[18px]'}>
              <h2 className="text-[13.5px] font-bold">대시</h2>
              {respWaiting > 0 && <span className="ml-[7px] text-[10.5px] font-bold bg-[#FEE2E2] text-[#DC2626] rounded-full px-1.5">{respWaiting}</span>}
              <Link href="/advertiser/messages" className="ml-auto text-[11.5px] font-semibold text-[#B45309]">전체보기 →</Link>
            </div>
            {convPreview.length === 0 ? (
              <p className="text-sm text-[#9A9AA5] p-[18px]">아직 주고받은 대시가 없어요.</p>
            ) : (
              convPreview.map((c) => (
                <Link key={c.otherId} href={`/advertiser/messages/${convIdByOther[c.otherId] ?? ''}`} className="flex items-center gap-[11px] px-[18px] py-3 border-b border-[#F5F5F7] hover:bg-[#FAFAFB]">
                  <div className="w-[34px] h-[34px] rounded-full bg-[#FEF3C7] text-[#B45309] text-[13px] font-extrabold flex items-center justify-center shrink-0">
                    {initial(nameById[c.otherId])}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold truncate">{nameById[c.otherId] ?? '상대방'}</div>
                    <div className="text-[11.5px] text-[#9A9AA5] truncate mt-0.5">{c.last?.content}</div>
                  </div>
                  {c.unread ? (
                    <span className="text-[10.5px] font-bold bg-[#FEE2E2] text-[#DC2626] rounded-full px-[7px] py-0.5 shrink-0">미응답</span>
                  ) : (
                    <span className="text-[10.5px] font-semibold bg-[#F1F1F4] text-[#9A9AA5] rounded-full px-[7px] py-0.5 shrink-0">상대 미확인</span>
                  )}
                </Link>
              ))
            )}
          </section>

          {/* 알림함 */}
          <section className={card}>
            <div className={cardHead + ' px-[18px]'}>
              <h2 className="text-[13.5px] font-bold">알림함</h2>
              {unreadNotif > 0 && <span className="ml-[7px] text-[10.5px] font-bold bg-[#FEE2E2] text-[#DC2626] rounded-full px-1.5">{unreadNotif}</span>}
              <Link href="/advertiser/notifications" className="ml-auto text-[11.5px] font-semibold text-[#B45309]">전체보기 →</Link>
            </div>
            {notifPreview.length === 0 ? (
              <p className="text-sm text-[#9A9AA5] p-[18px]">아직 알림이 없어요.</p>
            ) : (
              notifPreview.map((n) => (
                <Link key={n.id} href="/advertiser/notifications" className={`flex gap-[11px] px-[18px] py-3 border-b border-[#F5F5F7] ${n.is_read ? 'bg-white' : 'bg-[#FFFBEB]'}`}>
                  {(() => {
                    const Icon = NOTIF_ICON[n.type] ?? Bell
                    return <Icon size={15} strokeWidth={1.75} className="shrink-0 mt-0.5 opacity-70" />
                  })()}
                  <div className="min-w-0 flex-1">
                    <div className={`text-[12.5px] tracking-[-0.01em] ${n.is_read ? 'font-medium text-[#5C5C68]' : 'font-bold'}`}>{n.title}</div>
                    {n.body && <div className="text-[11.5px] text-[#9A9AA5] truncate mt-0.5">{n.body}</div>}
                  </div>
                </Link>
              ))
            )}
          </section>

          {/* 친구등록 인플루언서 (예시) */}
          <section className={card}>
            <div className={cardHead + ' px-[18px]'}>
              <h2 className="text-[13.5px] font-bold">친구등록 인플루언서</h2>
              <span className="ml-[7px] text-[9.5px] font-bold text-[#9A9AA5] bg-[#F1F1F4] rounded px-[5px] py-0.5">예시</span>
              <Link href="/advertiser/search" className="ml-auto text-[11.5px] font-semibold text-[#B45309]">찾기 →</Link>
            </div>
            {favInfluencers.map((inf) => (
              <div key={inf.id} className="flex items-center gap-[11px] px-[18px] py-[11px] border-b border-[#F5F5F7]">
                <div className="w-8 h-8 rounded-full bg-[#F1F1F4] text-[#5C5C68] text-[12.5px] font-bold flex items-center justify-center shrink-0">{initial(inf.name)}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold truncate">{inf.name}</div>
                  <div className="text-[11px] text-[#9A9AA5] mt-px">{inf.category} · 팔로워 {inf.followers.toLocaleString()}</div>
                </div>
                <span className="text-[11px] font-semibold text-[#7C7C88] border border-[#E2E2E8] rounded-md px-[9px] py-1">초대</span>
              </div>
            ))}
          </section>

          {/* 양식함 */}
          <section className={card + ' flex-1 flex flex-col'}>
            <div className={cardHead + ' px-[18px]'}>
              <h2 className="text-[13.5px] font-bold">양식함</h2>
              <Link href="/advertiser/campaigns/new" className="ml-auto text-[11.5px] font-semibold text-[#B45309]">등록에 쓰기 →</Link>
            </div>
            <div className="p-2.5 pt-2">
              {savedForms.map((f) => (
                <div key={f.id} className="flex items-center gap-2.5 px-2.5 py-[9px] rounded-lg hover:bg-[#FAFAFB]">
                  <FileText size={14} strokeWidth={1.75} className="opacity-60 shrink-0" />
                  <span className="text-[12.5px] font-medium flex-1 min-w-0 truncate">{f.name}</span>
                  {f.sample && <span className="text-[9.5px] font-bold text-[#9A9AA5] bg-[#F1F1F4] rounded px-[5px] py-0.5">예시</span>}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
