import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/TopBar'
import HomeCalendar from '@/components/HomeCalendar'
import NotificationsRealtime from '@/components/NotificationsRealtime'

export const dynamic = 'force-dynamic'

const pad = (n: number) => String(n).padStart(2, '0')

const NOTIF_ICON: Record<string, string> = {
  campaign_created: '📣', campaign_updated: '📝', campaign_completed: '✅', campaign_cancelled: '🚫',
  open_created: '📅', open_completed: '✅', open_cancelled: '🚫',
  deal_made: '🤝', dash_received: '💬', settlement_due: '💰',
  deal_confirm_request: '⏳', deal_confirm_self: '☑️',
}

export default async function AdvertiserMyPage() {
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
  if (profile?.role === 'influencer') redirect('/influencer/dashboard')
  if (profile?.role !== 'advertiser') redirect('/login')

  const { data: advProfile } = await supabase
    .from('advertiser_profiles')
    .select('company_name')
    .eq('user_id', user.id)
    .single()
  const displayName = advProfile?.company_name ?? profile?.name

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const start = `${year}-${pad(month)}-01`
  const end = `${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`
  const todayStr = `${year}-${pad(month)}-${pad(now.getDate())}`

  // 내 캠페인
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('advertiser_id', user.id)
    .order('created_at', { ascending: false })
  const campIds = (campaigns ?? []).map((c) => c.id)

  // 캠페인별 참여 인플루언서(제안) 집계
  const { data: cProposals } = campIds.length
    ? await supabase
        .from('proposals')
        .select('campaign_id, advertiser_confirmed, influencer_confirmed, budget')
        .in('campaign_id', campIds)
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

  // 달력: 내 캠페인(amber) + 공개 오픈(blue)
  const countsByDate: Record<string, { open: number; campaign: number }> = {}
  for (const c of campaigns ?? []) {
    if (c.date >= start && c.date <= end) (countsByDate[c.date] ??= { open: 0, campaign: 0 }).campaign++
  }
  const { data: opens } = await supabase
    .from('schedules')
    .select('date')
    .eq('is_public', true)
    .eq('status', 'open')
    .gte('date', start)
    .lte('date', end)
  for (const o of opens ?? []) {
    ;(countsByDate[(o as { date: string }).date] ??= { open: 0, campaign: 0 }).open++
  }

  // 메시지 미리보기
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
  const convPreview = Object.values(convMap).slice(0, 3)
  const otherIds = convPreview.map((c) => c.otherId)
  const { data: names } = otherIds.length
    ? await supabase.from('profiles').select('id, name').in('id', otherIds)
    : { data: [] }
  const nameById = Object.fromEntries((names ?? []).map((p) => [p.id, p.name]))

  // 알림
  const { data: notifs } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
  const unreadNotif = (notifs ?? []).filter((n) => !n.is_read).length
  const notifPreview = (notifs ?? []).slice(0, 3)

  const bannerBits: string[] = []
  if (unreadNotif > 0) bannerBits.push(`새 알림 ${unreadNotif}`)

  // 캠페인 상태 파생
  const campaignsWithStatus = (campaigns ?? []).map((c) => {
    let st: '진행중' | '마감' | '캔슬' | '완료' = '진행중'
    if (c.status === 'cancelled') st = '캔슬'
    else if (c.status === 'completed') st = '완료'
    else if (c.date < todayStr) st = '마감'
    return { ...c, derivedStatus: st, stats: byCamp[c.id] ?? { total: 0, confirmed: 0, negotiating: 0 } }
  })
  const monthCampCount = (campaigns ?? []).filter((c) => c.date >= start && c.date <= end).length

  const STATUS_STYLE: Record<string, string> = {
    진행중: 'bg-amber-100 text-amber-700',
    완료: 'bg-green-100 text-green-600',
    마감: 'bg-gray-100 text-gray-500',
    캔슬: 'bg-red-100 text-red-500',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar name={displayName} homeHref="/advertiser/dashboard" editHref="/advertiser/profile" />
      <NotificationsRealtime userId={user.id} />

      <main className="max-w-lg mx-auto px-4 py-5 space-y-6">
        {/* 액션 배너 */}
        {bannerBits.length > 0 && (
          <Link
            href="/advertiser/notifications"
            className="flex items-center justify-between bg-amber-500 text-white rounded-2xl px-4 py-3 shadow-sm hover:bg-amber-600 transition"
          >
            <span className="text-sm font-medium">🔔 {bannerBits.join(' · ')}</span>
            <span>→</span>
          </Link>
        )}

        {/* 달력 */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h1 className="text-lg font-bold text-gray-900">캠페인 캘린더</h1>
            <p className="text-xs text-gray-500">
              <span className="text-amber-600 font-medium">내 캠페인 {monthCampCount}</span> ·{' '}
              <span className="text-blue-600 font-medium">오픈 {(opens ?? []).length}</span>
            </p>
          </div>
          <HomeCalendar year={year} month={month} countsByDate={countsByDate} isLoggedIn={true} />
        </section>

        {/* 빠른 액션 */}
        <section className="grid grid-cols-2 gap-3">
          <Link href="/advertiser/campaigns/new" className="bg-amber-500 text-white rounded-2xl p-4 shadow-sm hover:bg-amber-600 transition text-center">
            <div className="text-2xl mb-1">＋</div>
            <p className="font-semibold text-sm">캠페인 등록</p>
          </Link>
          <Link href="/advertiser/search" className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-center">
            <div className="text-2xl mb-1">🔍</div>
            <p className="font-semibold text-sm text-gray-800">인플루언서 찾기</p>
          </Link>
        </section>

        {/* 내 캠페인 */}
        <section>
          <h2 className="text-sm font-bold text-gray-800 mb-3">📣 내 캠페인</h2>
          {campaignsWithStatus.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white rounded-2xl p-4 shadow-sm">아직 등록한 캠페인이 없어요.</p>
          ) : (
            <div className="space-y-2">
              {campaignsWithStatus.map((c) => (
                <Link
                  key={c.id}
                  href={`/advertiser/campaigns/${c.id}`}
                  className="block bg-white rounded-2xl p-4 shadow-sm border-l-4 border-amber-400 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{c.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">📅 {c.date}　📍 {c.location_city} {c.location_district}</p>
                    </div>
                    <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE[c.derivedStatus]}`}>
                      {c.derivedStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="text-gray-600">👥 참여 {c.stats.total}</span>
                    <span className="text-green-600">확정 {c.stats.confirmed}</span>
                    <span className="text-amber-600">협의중 {c.stats.negotiating}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 대시 · 메시지 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800">💬 대시 · 메시지</h2>
            <Link href="/advertiser/messages" className="text-xs text-amber-600 hover:underline">전체보기 →</Link>
          </div>
          {convPreview.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white rounded-2xl p-4 shadow-sm">아직 주고받은 대시가 없어요.</p>
          ) : (
            <div className="space-y-2">
              {convPreview.map((c) => (
                <Link key={c.otherId} href={`/advertiser/messages`}
                  className="flex items-center bg-white rounded-2xl p-3 shadow-sm hover:shadow-md transition">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold mr-3">
                    {nameById[c.otherId]?.[0] ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800">{nameById[c.otherId] ?? '상대방'}</p>
                    <p className="text-xs text-gray-400 truncate">{c.last?.content}</p>
                  </div>
                  {c.awaitingMe ? (
                    <span className="ml-2 shrink-0 text-[11px] bg-red-100 text-red-500 px-2 py-0.5 rounded-full">미응답</span>
                  ) : (
                    <span className="ml-2 shrink-0 text-[11px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">상대 미확인</span>
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
              {unreadNotif > 0 && <span className="ml-1.5 text-[11px] bg-red-500 text-white px-2 py-0.5 rounded-full align-middle">{unreadNotif}</span>}
            </h2>
            <Link href="/advertiser/notifications" className="text-xs text-amber-600 hover:underline">전체보기 →</Link>
          </div>
          {notifPreview.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white rounded-2xl p-4 shadow-sm">아직 알림이 없어요.</p>
          ) : (
            <div className="space-y-2">
              {notifPreview.map((n) => (
                <Link key={n.id} href="/advertiser/notifications"
                  className={`flex items-start gap-3 rounded-2xl p-3 shadow-sm transition ${n.is_read ? 'bg-white' : 'bg-amber-50 hover:bg-amber-100'}`}>
                  <span className="text-lg shrink-0">{NOTIF_ICON[n.type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${n.is_read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title}</p>
                    {n.body && <p className="text-xs text-gray-400 truncate">{n.body}</p>}
                  </div>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 집행 요약 */}
        <section>
          <div className="block bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-500">💰 확정 집행 예정</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{spendConfirmed.toLocaleString()}원</p>
            <p className="text-xs text-gray-400 mt-0.5">양쪽 확정된 협업 기준</p>
          </div>
        </section>
      </main>
    </div>
  )
}
