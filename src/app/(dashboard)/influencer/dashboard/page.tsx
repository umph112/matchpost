import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/TopBar'
import HomeCalendar from '@/components/HomeCalendar'
import MyOpensList from '@/components/MyOpensList'
import NotificationsRealtime from '@/components/NotificationsRealtime'
import { BlogAnalyticsSummaryCard } from '@/components/BlogAnalyticsCard'

export const dynamic = 'force-dynamic'

const pad = (n: number) => String(n).padStart(2, '0')

const NOTIF_ICON: Record<string, string> = {
  campaign_created: '📣', campaign_updated: '📝', campaign_completed: '✅', campaign_cancelled: '🚫',
  open_created: '📅', open_completed: '✅', open_cancelled: '🚫',
  deal_made: '🤝', dash_received: '💬', settlement_due: '💰',
  deal_confirm_request: '⏳', deal_confirm_self: '☑️',
}

export default async function InfluencerMyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, status')
    .eq('id', user.id)
    .single()

  if (profile?.status === 'pending') redirect('/pending')
  if (profile?.role === 'advertiser') redirect('/advertiser/dashboard')
  if (profile?.role !== 'influencer') redirect('/login')

  const { data: ip } = await supabase
    .from('influencer_profiles')
    .select('categories')
    .eq('user_id', user.id)
    .single()
  const myCats: string[] = ip?.categories ?? []

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const start = `${year}-${pad(month)}-01`
  const end = `${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`
  const todayStr = `${year}-${pad(month)}-${pad(now.getDate())}`

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

  // 제안(대시): 받은 대기 + 성사(메이드) 판정용
  const { data: proposals } = await supabase
    .from('proposals')
    .select('schedule_id, advertiser_confirmed, influencer_confirmed')
    .eq('influencer_id', user.id)
  const madeSchedules = new Set(
    (proposals ?? [])
      .filter((p) => p.advertiser_confirmed && p.influencer_confirmed)
      .map((p) => p.schedule_id)
  )

  // 달력 카운트 (이달)
  const countsByDate: Record<string, { open: number; campaign: number }> = {}
  for (const o of opens ?? []) {
    if (o.date >= start && o.date <= end) (countsByDate[o.date] ??= { open: 0, campaign: 0 }).open++
  }
  for (const c of camps) {
    ;(countsByDate[(c as { date: string }).date] ??= { open: 0, campaign: 0 }).campaign++
  }

  // 메시지 미리보기 + 미응답
  const { data: msgs } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(60)
  const convMap: Record<string, { otherId: string; last: any; awaitingMe: boolean }> = {}
  for (const m of msgs ?? []) {
    const other = m.sender_id === user.id ? m.receiver_id : m.sender_id
    if (!convMap[other]) convMap[other] = { otherId: other, last: m, awaitingMe: m.receiver_id === user.id }
  }
  const convs = Object.values(convMap)
  const convPreview = convs.slice(0, 3)
  const otherIds = convPreview.map((c) => c.otherId)
  const { data: names } = otherIds.length
    ? await supabase.from('profiles').select('id, name').in('id', otherIds)
    : { data: [] }
  const nameById = Object.fromEntries((names ?? []).map((p) => [p.id, p.name]))

  // 매출 (이달)
  const { data: earn } = await supabase
    .from('earnings')
    .select('amount, status, created_at')
    .eq('influencer_id', user.id)
  const monthEarn = (earn ?? []).filter((e) => {
    const d = new Date(e.created_at)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })
  const monthTotal = monthEarn.reduce((s, e) => s + (e.amount || 0), 0)
  const pendingTotal = monthEarn.filter((e) => e.status === '예정').reduce((s, e) => s + (e.amount || 0), 0)

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

  // 정산 당일
  const { data: dueEarn } = await supabase
    .from('earnings')
    .select('id')
    .eq('influencer_id', user.id)
    .eq('due_date', todayStr)
  const settlementDue = (dueEarn ?? []).length

  // 오픈 상태 파생
  const opensWithStatus = (opens ?? []).map((o) => {
    let st: '진행중' | '메이드' | '마감' | '캔슬' = '진행중'
    if (o.status === 'cancelled') st = '캔슬'
    else if (madeSchedules.has(o.id)) st = '메이드'
    else if (o.date < todayStr) st = '마감'
    return {
      id: o.id,
      title: o.title,
      date: o.date,
      location_city: o.location_city,
      location_district: o.location_district,
      derivedStatus: st,
    }
  })

  const monthOpenCount = (opens ?? []).filter((o) => o.date >= start && o.date <= end).length
  const bannerBits: string[] = []
  if (unreadNotif > 0) bannerBits.push(`새 알림 ${unreadNotif}`)
  if (settlementDue > 0) bannerBits.push(`오늘 정산 예정 ${settlementDue}건`)

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar name={profile?.name} />
      <NotificationsRealtime userId={user.id} />

      <main className="max-w-lg mx-auto px-4 py-5 space-y-6">
        {/* 액션 배너 (당일 알림·정산) */}
        {bannerBits.length > 0 && (
          <Link
            href="/influencer/notifications"
            className="flex items-center justify-between bg-blue-600 text-white rounded-2xl px-4 py-3 shadow-sm hover:bg-blue-700 transition"
          >
            <span className="text-sm font-medium">🔔 {bannerBits.join(' · ')}</span>
            <span>→</span>
          </Link>
        )}

        {/* 달력 */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h1 className="text-lg font-bold text-gray-900">내 캘린더</h1>
            <p className="text-xs text-gray-500">
              <span className="text-amber-600 font-medium">매칭 캠페인 {camps.length}</span> ·{' '}
              <span className="text-blue-600 font-medium">내 오픈 {monthOpenCount}</span>
            </p>
          </div>
          <HomeCalendar year={year} month={month} countsByDate={countsByDate} isLoggedIn={true} />
        </section>

        {/* 빠른 액션 */}
        <section className="grid grid-cols-2 gap-3">
          <Link
            href="/influencer/schedule"
            className="bg-blue-600 text-white rounded-2xl p-4 shadow-sm hover:bg-blue-700 transition text-center"
          >
            <div className="text-2xl mb-1">＋</div>
            <p className="font-semibold text-sm">오픈 등록</p>
          </Link>
          <Link
            href="/influencer/search"
            className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-center"
          >
            <div className="text-2xl mb-1">🔍</div>
            <p className="font-semibold text-sm text-gray-800">캠페인 검색</p>
          </Link>
        </section>

        {/* 대시 · 메시지 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800">💬 대시 · 메시지</h2>
            <Link href="/influencer/messages" className="text-xs text-blue-600 hover:underline">
              전체보기 →
            </Link>
          </div>
          {convPreview.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white rounded-2xl p-4 shadow-sm">아직 주고받은 대시가 없어요.</p>
          ) : (
            <div className="space-y-2">
              {convPreview.map((c) => (
                <Link
                  key={c.otherId}
                  href={`/influencer/messages?receiverId=${c.otherId}`}
                  className="flex items-center bg-white rounded-2xl p-3 shadow-sm hover:shadow-md transition"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold mr-3">
                    {nameById[c.otherId]?.[0] ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800">{nameById[c.otherId] ?? '상대방'}</p>
                    <p className="text-xs text-gray-400 truncate">{c.last?.content}</p>
                  </div>
                  {c.awaitingMe ? (
                    <span className="ml-2 shrink-0 text-[11px] bg-red-100 text-red-500 px-2 py-0.5 rounded-full">
                      미응답
                    </span>
                  ) : (
                    <span className="ml-2 shrink-0 text-[11px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                      상대 미확인
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 알림함 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800">
              🔔 알림함
              {unreadNotif > 0 && (
                <span className="ml-1.5 text-[11px] bg-red-500 text-white px-2 py-0.5 rounded-full align-middle">
                  {unreadNotif}
                </span>
              )}
            </h2>
            <Link href="/influencer/notifications" className="text-xs text-blue-600 hover:underline">
              전체보기 →
            </Link>
          </div>
          {notifPreview.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white rounded-2xl p-4 shadow-sm">아직 알림이 없어요.</p>
          ) : (
            <div className="space-y-2">
              {notifPreview.map((n) => (
                <Link
                  key={n.id}
                  href="/influencer/notifications"
                  className={`flex items-start gap-3 rounded-2xl p-3 shadow-sm transition ${
                    n.is_read ? 'bg-white' : 'bg-blue-50 hover:bg-blue-100'
                  }`}
                >
                  <span className="text-lg shrink-0">{NOTIF_ICON[n.type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${n.is_read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title}</p>
                    {n.body && <p className="text-xs text-gray-400 truncate">{n.body}</p>}
                  </div>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 내 오픈 목록 */}
        <section>
          <MyOpensList opens={opensWithStatus} />
        </section>

        {/* 내 채널 분석 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800">📊 내 채널 분석</h2>
            <Link href="/influencer/channel-analytics" className="text-xs text-blue-600 hover:underline">
              상세보기 →
            </Link>
          </div>
          <BlogAnalyticsSummaryCard data={blogAnalytics} />
        </section>

        {/* 매출 */}
        <section>
          <Link
            href="/influencer/earnings"
            className="block bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">💰 이번 달 매출</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{monthTotal.toLocaleString()}원</p>
                {pendingTotal > 0 && (
                  <p className="text-xs text-orange-500 mt-0.5">정산 예정 {pendingTotal.toLocaleString()}원</p>
                )}
              </div>
              <span className="text-gray-300">상세 →</span>
            </div>
          </Link>
        </section>
      </main>
    </div>
  )
}
