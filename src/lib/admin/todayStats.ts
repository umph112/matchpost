// D26 9-4절 — 「오늘」의 나머지 절(회원 현황 · 트래픽 · 오픈 · 캠페인 · 오늘 지표).
//
// ⚠️ 처리 대기 큐와 사이드바 배지는 todayQueue.ts 가 센다. 여기서 다시 세지 않는다.
//
// ⚠️ 트래픽은 두 표를 읽는다 — 성격이 달라 합치지 않았다(D30 [1]).
//    · 일별(최근 14일) = user_visit_log. (user_id, visited_on) 하루 순방문자이고
//      리워드 판정(visit-weekly · visit-monthly)이 그 위에 선다. 여기서 건드리지 않는다.
//    · 시간대(오늘 24시간) = page_views. 매 조회마다 한 행이라 시각이 있다.
//    page_views 가 쌓이기 전 구간은 0 이 아니라 「모름」이다 — firstViewAt 으로 갈라 화면이 비워둔다.
//
// ⚠️ 관리자 집계는 서비스 클라이언트로 읽는다 — user_visit_log RLS 가 본인 것만 허용이라
//    세션 클라이언트로 읽으면 관리자에게도 0건이 온다.

import { createServiceClient } from '@/lib/supabase/service'
import { kstDateString } from '@/lib/date'

/** YYYY-MM-DD 문자열 날짜 이동. Date 로 왕복하면 서버 TZ 가 섞이므로 UTC 로만 계산한다. */
export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** KST 그날 0시(=전날 15:00Z)의 timestamptz 경계. created_at 비교용. */
function kstDayStart(dateStr: string): string {
  return `${dateStr}T00:00:00+09:00`
}

export type MemberStat = { role: string; today: number; prev: number; total: number }

export type TodayStats = {
  members: { rows: MemberStat[]; total: number; today: number }
  traffic: {
    days: { date: string; count: number }[]
    today: number
    yesterday: number
    avg7: number
    sum30: number
    /** 오늘(KST) 0~23시 조회수. page_views 기준이라 일별과 단위가 다르다(조회수 ≠ 순방문자). */
    hours: { hour: number; views: number; visitors: number }[]
    /** page_views 최초 기록 시각. null 이면 시간대 기록이 아직 없다. */
    firstViewAt: string | null
  }
  opens: { upcoming: number; today: number; week: number }
  campaigns: { open: number; dash: number; confirmed: number; newToday: number }
  stats: { k: string; v: string; d: number; suffix?: string }[]
}

export async function getTodayStats(): Promise<TodayStats> {
  const db = createServiceClient()
  const today = kstDateString()
  const yesterday = shiftDate(today, -1)
  const from14 = shiftDate(today, -13)
  const from30 = shiftDate(today, -29)
  const week = shiftDate(today, 6)

  const [profRes, visitRes, schedRes, campRes, propRes, reportRes, hourRes, firstViewRes] =
    await Promise.all([
    db.from('profiles').select('role, created_at').neq('role', 'admin'),
    db.from('user_visit_log').select('user_id, visited_on').gte('visited_on', from30),
    db
      .from('schedules')
      .select('date')
      .eq('is_public', true)
      .eq('status', 'open')
      .gte('date', today),
    db.from('campaigns').select('id, status, created_at'),
    db.from('proposals').select('campaign_id, advertiser_confirmed, influencer_confirmed'),
    db.from('reports').select('created_at').gte('created_at', kstDayStart(yesterday)),
    // 오늘(KST) 조회 원본 — 시간대 막대용
    db
      .from('page_views')
      .select('user_id, viewed_at')
      .gte('viewed_at', kstDayStart(today))
      .lt('viewed_at', kstDayStart(shiftDate(today, 1))),
    // 기록이 언제부터 있나 — 그 이전 구간은 0 이 아니라 「모름」이다
    db.from('page_views').select('viewed_at').order('viewed_at', { ascending: true }).limit(1),
  ])

  // ── 회원 현황 ───────────────────────────────────────────
  const profs = profRes.data ?? []
  const countFor = (role: string, day: string) =>
    profs.filter((p) => p.role === role && kstDateString(new Date(p.created_at)) === day).length

  const rows: MemberStat[] = (['influencer', 'advertiser'] as const).map((role) => ({
    role: role === 'influencer' ? '인플루언서' : '광고주',
    today: countFor(role, today),
    prev: countFor(role, yesterday),
    total: profs.filter((p) => p.role === role).length,
  }))

  // ── 트래픽 ─────────────────────────────────────────────
  const visits = visitRes.data ?? []
  const byDay: Record<string, number> = {}
  for (const v of visits) byDay[v.visited_on] = (byDay[v.visited_on] ?? 0) + 1

  const days: { date: string; count: number }[] = []
  for (let i = 0; i < 14; i++) {
    const date = shiftDate(from14, i)
    days.push({ date, count: byDay[date] ?? 0 })
  }
  const last7 = days.slice(-7)
  const avg7 = last7.length ? Math.round(last7.reduce((s, d) => s + d.count, 0) / last7.length) : 0

  // 시간대 — KST 시(hour)로 담는다. 서버 TZ 를 타지 않게 +9h 밀고 UTC 시를 읽는다.
  const kstHour = (iso: string) => new Date(Date.parse(iso) + 9 * 60 * 60 * 1000).getUTCHours()
  const perHour: { views: number; users: Set<string> }[] = Array.from({ length: 24 }, () => ({
    views: 0,
    users: new Set<string>(),
  }))
  for (const v of hourRes.data ?? []) {
    const h = perHour[kstHour(v.viewed_at)]
    if (!h) continue
    h.views++
    if (v.user_id) h.users.add(v.user_id)
  }
  const hours = perHour.map((h, hour) => ({ hour, views: h.views, visitors: h.users.size }))
  const firstViewAt = firstViewRes.data?.[0]?.viewed_at ?? null

  // ── 오픈 ───────────────────────────────────────────────
  const scheds = schedRes.data ?? []

  // ── 캠페인 ─────────────────────────────────────────────
  const camps = campRes.data ?? []
  const openCamps = camps.filter((c) => c.status === 'open')
  const openIds = new Set(openCamps.map((c) => c.id))
  const props = propRes.data ?? []
  const onOpen = props.filter((p) => p.campaign_id && openIds.has(p.campaign_id))

  // ── 오늘 지표 (어제 대비) ────────────────────────────────
  const newTodayCamp = camps.filter(
    (c) => c.created_at && kstDateString(new Date(c.created_at)) === today,
  ).length
  const newPrevCamp = camps.filter(
    (c) => c.created_at && kstDateString(new Date(c.created_at)) === yesterday,
  ).length
  const reports = reportRes.data ?? []
  const reportToday = reports.filter((r) => kstDateString(new Date(r.created_at)) === today).length
  const reportPrev = reports.filter((r) => kstDateString(new Date(r.created_at)) === yesterday).length

  const joinToday = rows.reduce((s, m) => s + m.today, 0)
  const joinPrev = rows.reduce((s, m) => s + m.prev, 0)
  const visitToday = byDay[today] ?? 0
  const visitPrev = byDay[yesterday] ?? 0

  return {
    members: {
      rows,
      total: rows.reduce((s, m) => s + m.total, 0),
      today: joinToday,
    },
    traffic: {
      days,
      today: visitToday,
      yesterday: visitPrev,
      avg7,
      sum30: visits.length,
      hours,
      firstViewAt,
    },
    opens: {
      upcoming: scheds.length,
      today: scheds.filter((s) => s.date === today).length,
      week: scheds.filter((s) => s.date >= today && s.date <= week).length,
    },
    campaigns: {
      open: openCamps.length,
      dash: onOpen.length,
      confirmed: onOpen.filter((p) => p.advertiser_confirmed && p.influencer_confirmed).length,
      newToday: newTodayCamp,
    },
    stats: [
      { k: '신규 가입', v: String(joinToday), d: joinToday - joinPrev, suffix: '명' },
      { k: '방문', v: String(visitToday), d: visitToday - visitPrev, suffix: '명' },
      { k: '새 캠페인', v: String(newTodayCamp), d: newTodayCamp - newPrevCamp, suffix: '건' },
      { k: '새 신고', v: String(reportToday), d: reportToday - reportPrev, suffix: '건' },
    ],
  }
}
