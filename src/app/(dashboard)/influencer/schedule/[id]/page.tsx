import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { monthDayKo } from '@/lib/date'
import { settlementDateOf } from '@/lib/deals/settlementDate'
import PerkEditable from './PerkEditable'

// D24 — 오픈 묶음 보기.
// 오픈 하나(schedule)에서 시작된 협업들을 「그날 몇 시에 어디를 가고 총 얼마를 받나」로 묶는다.
//
// ⚠️ 묶는 기준은 proposals.schedule_id 다. 날짜 겹침으로 묶으면 다른 오픈의 건이 섞인다.
// ⚠️ schedules.fee 를 금액으로 쓰지 않는다 — text(「30만원~」)이고 오픈의 희망 페이다.
//    실제 금액은 proposals.budget 이다.

const KST = 'Asia/Seoul'
const DOW_KO = ['일', '월', '화', '수', '목', '금', '토']

const kstDay = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: KST }).format(new Date(iso))
const kstHm = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: KST, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date(iso))

const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const hhmm = (n: number) => {
  const c = Math.max(0, Math.min(n, 23 * 60 + 59))
  return String(Math.floor(c / 60)).padStart(2, '0') + ':' + String(c % 60).padStart(2, '0')
}
const won = (n: number) => n.toLocaleString()
const dur = (n: number) => (n >= 60 ? Math.floor(n / 60) + '시간' + (n % 60 ? ' ' + (n % 60) + '분' : '') : n + '분')
const dayLabel = (ymd: string) => `${monthDayKo(ymd)} (${DOW_KO[new Date(ymd + 'T00:00:00').getDay()]})`
const addDays = (ymd: string, n: number) => {
  const d = new Date(ymd + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return new Intl.DateTimeFormat('en-CA').format(d)
}

type Stop = { at: string; name: string; place: string | null }
type Deal = {
  id: string
  advertiserId: string
  brand: string
  what: string
  budget: number
  perk: string | null
  isStay: boolean
  confirmed: boolean
  day: string | null
  stops: Stop[]
  startHm: string | null
  durationMin: number
  settlementDate: string | null
}
type Card = {
  key: string
  isGap: false
  from: string
  toLabel: string
  isStay: boolean
  isShoot: boolean
  deal: Deal
  spanNote: string
}
type Gap = { key: string; isGap: true; from: string; to: string; canAdd: boolean }

export default async function OpenBundlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: schedule } = await supabase
    .from('schedules')
    .select('*')
    .eq('id', id)
    .eq('influencer_id', user.id)
    .maybeSingle()
  if (!schedule) notFound()

  const { data: propsRaw } = await supabase
    .from('proposals')
    .select('id, advertiser_id, campaign_id, budget, stage, advertiser_confirmed, influencer_confirmed, start_at, duration_min, perk, is_stay, settlement_date')
    .eq('schedule_id', id)
    .eq('influencer_id', user.id)

  const rows = propsRaw ?? []
  const propIds = rows.map((p) => p.id)
  const advIds = [...new Set(rows.map((p) => p.advertiser_id))]
  const campIds = [...new Set(rows.map((p) => p.campaign_id).filter(Boolean) as string[])]

  const [{ data: stopsRaw }, { data: advProfiles }, { data: advCompanies }, { data: camps }] = await Promise.all([
    propIds.length
      ? supabase.from('proposal_stops').select('proposal_id, at, name, place, sort').in('proposal_id', propIds)
      : Promise.resolve({ data: [] as any[] }),
    advIds.length ? supabase.from('profiles').select('id, name').in('id', advIds) : Promise.resolve({ data: [] as any[] }),
    advIds.length
      // 남의 회사명이라 advertiser_public 뷰로 읽는다(0095)
      ? supabase.from('advertiser_public').select('user_id, company_name').in('user_id', advIds)
      : Promise.resolve({ data: [] as any[] }),
    campIds.length
      ? supabase.from('campaigns').select('id, title, brand_name, settlement_date').in('id', campIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const advName = Object.fromEntries((advProfiles ?? []).map((p: any) => [p.id, p.name]))
  const advCompany = Object.fromEntries((advCompanies ?? []).map((a: any) => [a.user_id, a.company_name]))
  const campById = Object.fromEntries((camps ?? []).map((c: any) => [c.id, c]))

  const stopsByProposal: Record<string, Stop[]> = {}
  for (const s of (stopsRaw ?? []) as any[]) {
    ;(stopsByProposal[s.proposal_id] ??= []).push({ at: String(s.at).slice(0, 5), name: s.name, place: s.place })
  }
  for (const k of Object.keys(stopsByProposal)) {
    stopsByProposal[k].sort((a, b) => mins(a.at) - mins(b.at))
  }

  const deals: Deal[] = rows.map((p: any) => {
    const camp = p.campaign_id ? campById[p.campaign_id] : null
    return {
      id: p.id,
      advertiserId: p.advertiser_id,
      brand: camp?.brand_name || advCompany[p.advertiser_id] || advName[p.advertiser_id] || '광고주',
      what: camp?.title || schedule.title || '협업',
      budget: p.budget ?? 0,
      perk: p.perk ?? null,
      isStay: !!p.is_stay,
      confirmed: !!(p.advertiser_confirmed && p.influencer_confirmed),
      day: p.start_at ? kstDay(p.start_at) : null,
      stops: stopsByProposal[p.id] ?? [],
      startHm: p.start_at ? kstHm(p.start_at) : null,
      durationMin: Math.max(p.duration_min ?? 60, 60),
      settlementDate: settlementDateOf(p, camp ? { settlement_date: camp.settlement_date } : null),
    }
  })

  // 시간표에 놓이려면 「양쪽 확정」 + 「날짜(start_at)」가 있어야 한다.
  // 나머지(협의중 · 시간 미정)는 숨기지 않고 시간표 아래 별도 카드에 모은다 —
  // 대시가 왔는데 화면에 없는 것이 더 큰 문제다.
  const placed = deals.filter((d) => d.confirmed && d.day)
  const pending = deals.filter((d) => !(d.confirmed && d.day))

  // 건의 시간대 = 협의 시각에서 파생. 인플루언서가 손으로 적지 않는다.
  //   방문 1곳    = −1시간 ~ +2시간 (앞1 + 본1 + 뒤1)
  //   방문 여러 곳 = 첫 방문 −1시간 ~ 마지막 방문 +2시간
  //                (방문마다 3시간을 따로 잡으면 16:00·17:00 연속 방문이 겹친다)
  //   숙박        = 20:00 → 익일 10:00
  const STAY_FROM = '20:00', STAY_TO = '10:00'
  const span = (d: Deal): { from: string; to: string } => {
    if (d.isStay) return { from: STAY_FROM, to: STAY_TO }
    if (d.stops.length) {
      const ats = d.stops.map((s) => mins(s.at))
      return { from: hhmm(Math.min(...ats) - 60), to: hhmm(Math.max(...ats) + 120) }
    }
    const at = mins(d.startHm as string)
    return { from: hhmm(at - 60), to: hhmm(at + d.durationMin + 60) }
  }

  // 오픈이 열어둔 시간대. 인플루언서가 적어둔 값이 있으면 그 값을 쓴다.
  const rawFrom = schedule.start_time ? String(schedule.start_time).slice(0, 5) : '09:00'
  const rawTo = schedule.end_time ? String(schedule.end_time).slice(0, 5) : '19:00'
  const OPEN_FROM = mins(rawTo) > mins(rawFrom) ? rawFrom : '09:00'
  const OPEN_TO = mins(rawTo) > mins(rawFrom) ? rawTo : '19:00'

  // 날짜 목록 — 오픈 기간 + (기간 밖에 잡힌 건이 있으면 그 날짜도). 건을 떨어뜨리지 않는다.
  const startYmd: string = schedule.date
  const endYmd: string = schedule.date_end || schedule.date
  const dayKeys: string[] = []
  for (let d = startYmd; d <= endYmd && dayKeys.length < 60; d = addDays(d, 1)) dayKeys.push(d)
  for (const d of placed) if (d.day && !dayKeys.includes(d.day)) dayKeys.push(d.day)
  dayKeys.sort()

  const days = dayKeys.map((key) => {
    const raw = placed.filter((d) => d.day === key)
    const stays = raw.filter((d) => d.isStay)
    const visits = raw.filter((d) => !d.isStay).map((d) => ({ deal: d, ...span(d), isShoot: false }))

    // 숙박 협찬은 두 덩어리다 — 낮에 잠시 들러 촬영하고 저녁에 다시 가서 잔다.
    // 촬영 블록(앞뒤 30분 + 본 30분 = 1시간 30분)은 낮 시간을 실제로 쓰므로 빈 시간을 차지한다.
    // 협의 시각(stops)이 없으면 언제 들르는지 모르므로 만들지 않는다 — 추정해 채우지 않는다.
    const shoots = stays
      .filter((d) => d.stops.length > 0)
      .map((d) => {
        const at = mins(d.stops[0].at)
        return { deal: d, from: hhmm(at - 30), to: hhmm(at + 60), isShoot: true }
      })

    const list = [...visits, ...shoots].sort((a, b) => mins(a.from) - mins(b.from))
    const slots: (Card | Gap)[] = []
    let cursor = mins(OPEN_FROM)

    const pushGap = (from: number, to: number) => {
      const gap = to - from
      if (gap < 30) return   // 30분 미만은 이동 여유라 그리지 않는다
      slots.push({ key: `gap-${key}-${from}`, isGap: true, from: hhmm(from), to: hhmm(to), canAdd: gap >= 90 })
    }

    const card = (x: { deal: Deal; from: string; to: string; isShoot: boolean }): Card => ({
      key: `${x.deal.id}${x.isShoot ? '-shoot' : ''}`,
      isGap: false,
      from: x.from,
      toLabel: x.deal.isStay && !x.isShoot ? `${x.to} 익일` : x.to,
      isStay: x.deal.isStay && !x.isShoot,
      isShoot: x.isShoot,
      deal: x.deal,
      spanNote: x.isShoot
        ? '앞뒤 30분 · 촬영 30분'
        : x.deal.isStay
          ? '체크인 · 체크아웃 기본'
          : x.deal.stops.length > 1
            ? `${x.deal.stops.length}곳 · 앞뒤 여유 포함`
            : '앞뒤 여유 포함',
    })

    for (const x of list) {
      pushGap(cursor, mins(x.from))
      slots.push(card(x))
      cursor = Math.max(cursor, mins(x.to))
    }
    pushGap(cursor, mins(OPEN_TO))
    // 숙박은 하루를 덮는 일정이라 시각 순서에 끼우지 않고 맨 아래에 둔다
    for (const d of stays) slots.push(card({ deal: d, ...span(d), isShoot: false }))

    // 숙박은 자는 시간이라 빈 칸 계산에서 뺀다 — 같이 세면 저녁 이후가 통째로 막힌다
    const busy = list.reduce((a, x) => a + (mins(x.to) - mins(x.from)), 0)
    const free = (mins(OPEN_TO) - mins(OPEN_FROM)) - busy

    return {
      key,
      label: dayLabel(key),
      // 「협업 N건」은 실제 건수다. 파생 블록(촬영)을 세면 부제와 합이 어긋난다.
      count: `협업 ${raw.length}건`,
      free: free > 0 ? `빈 시간 ${dur(free)}` : '빈 시간 없음',
      slots,
    }
  })

  const cash = placed.reduce((a, d) => a + d.budget, 0)
  const perkDeals = placed.filter((d) => d.perk)
  const visitCount = placed.filter((d) => !d.isStay).reduce((a, d) => a + (d.stops.length || 1), 0)
  const dateRange = endYmd !== startYmd ? `${monthDayKo(startYmd)} – ${monthDayKo(endYmd)}` : monthDayKo(startYmd)
  const sub = placed.length
    ? `${dateRange} · 협업 ${placed.length}건 확정 · 방문 ${visitCount}곳`
    : `${dateRange} · 확정된 협업 없음`

  // 헤더가 「결제 예정일 순」이라 적혀 있으니 실제로 정렬한다. 미정은 뒤로.
  // 제공만 받는 건(budget 0)은 정산 대상이 아니라 올리지 않는다.
  const pays = placed
    .filter((d) => d.budget > 0)
    .sort((a, b) => (a.settlementDate ?? '9999').localeCompare(b.settlementDate ?? '9999'))

  const dashHref = (d: Deal) => `/influencer/messages?receiverId=${d.advertiserId}&proposalId=${d.id}`

  const NOTES = [
    '한 건에 방문지가 여러 곳일 수 있어요. 묶인 건은 카드 하나에 방문 시각을 나란히 보여줍니다.',
    '시간대는 첫 방문 1시간 전부터 마지막 방문 2시간 뒤까지 잡혀요. 「딜시트 열기」에서 조정할 수 있습니다.',
    '숙박은 오후 8시부터 다음날 오전 10시까지가 기본이에요. 자는 시간이라 다른 일정과 겹쳐도 되고 빈 시간 계산에서 빠집니다.',
    '보수는 건마다 달라요 — 원고료만, 제공만, 둘 다. 제공은 합계에 넣지 않고 아래에 따로 적습니다.',
    '파란 점선이 그어진 「제공」 표현은 눌러서 고칠 수 있어요. 「서비스 제공」을 「저녁 2인 · 음료 포함」처럼 실제 받은 대로 적어두면 나중에 찾기 쉽습니다. 금액은 합의된 값이라 대시에서만 바꿉니다.',
    '빈 시간이 1시간 30분 넘게 남으면 「여기 열어두기」로 그 시간대만 다시 열 수 있어요. 다른 광고주가 그 시간대와 위치를 보고 대시합니다.',
  ]

  return (
    <div className="p-7 max-w-[1180px] flex flex-col gap-[14px]">
      {/* 머리 */}
      <div className="flex items-end gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-[9px]">
            <span
              className={`text-[10px] font-extrabold rounded-[5px] px-[7px] py-[3px] flex-shrink-0 ${
                schedule.is_public ? 'bg-[#DBEAFE] text-[#1D4ED8]' : 'bg-[#F1F1F4] text-[#7C7C88]'
              }`}
            >
              {schedule.is_public ? '공개 오픈' : '비공개 오픈'}
            </span>
            <h1 className="m-0 text-[23px] font-extrabold tracking-[-0.03em] text-[#17171B]">{schedule.title}</h1>
          </div>
          <p className="mt-[5px] text-[13px] text-[#7C7C88]">{sub}</p>
        </div>
        <div className="ml-auto flex gap-2 flex-shrink-0">
          <Link
            href="/influencer/schedule/list"
            className="h-11 px-4 rounded-[11px] bg-[#17171B] hover:bg-[#2A2A33] text-white text-[13px] font-bold flex items-center transition"
          >
            내 일정으로
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-[14px] items-start max-lg:grid-cols-1">
        {/* 좌 — 날짜별 시간표 */}
        <div className="flex flex-col gap-[14px] min-w-0">
          {days.map((d) => (
            <div key={d.key} className="bg-white border border-[#EAEAEE] rounded-[14px] overflow-hidden">
              <div className="h-[50px] flex items-center px-5 border-b border-[#F1F1F4]">
                <h2 className="m-0 text-[14px] font-extrabold tracking-[-0.02em] text-[#17171B]">{d.label}</h2>
                <span className="text-[11.5px] text-[#9A9AA5] ml-[9px]">{d.count}</span>
                <span className="ml-auto text-[11.5px] text-[#9A9AA5]">{d.free}</span>
              </div>

              <div className="px-5 pt-4 pb-1 flex flex-col">
                {d.slots.map((s) =>
                  s.isGap ? (
                    // 빈 칸을 반드시 그린다. 빈 칸이 보여야 「여기에 하나 더」가 보인다.
                    <div key={s.key} className="flex gap-[14px]">
                      <div className="w-14 flex-shrink-0" />
                      <div className="w-[10px] flex-shrink-0 flex justify-center">
                        <span className="w-px flex-1 bg-[#EAEAEE] block" />
                      </div>
                      <div className="flex-1 min-w-0 pb-4">
                        <div className="border border-dashed border-[#D4D4DC] rounded-[12px] px-4 py-3 bg-[#FBFBFC] flex items-center gap-[9px]">
                          <span className="text-[11.5px] font-bold text-[#7C7C88] tabular-nums flex-shrink-0">
                            {s.from} – {s.to}
                          </span>
                          <span className="text-[11.5px] text-[#9A9AA5] min-w-0">
                            {dur(mins(s.to) - mins(s.from))} 비어 있어요
                          </span>
                          {s.canAdd && (
                            <Link
                              href={`/influencer/schedule?date=${d.key}&from=${s.from}&to=${s.to}`}
                              className="ml-auto text-[11.5px] font-bold text-[#B45309] hover:text-[#92400E] flex-shrink-0"
                            >
                              여기 열어두기
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div key={s.key} className="flex gap-[14px]">
                      <div className="w-14 flex-shrink-0 pt-0.5">
                        <div className="text-[12.5px] font-extrabold tracking-[-0.02em] text-[#17171B] tabular-nums">{s.from}</div>
                        <div className="text-[10.5px] text-[#B0B0BB] mt-0.5 tabular-nums">{s.toLabel}</div>
                      </div>

                      <div className="w-[10px] flex-shrink-0 flex flex-col items-center">
                        <span
                          className={`w-[9px] h-[9px] flex-shrink-0 mt-[5px] block ${
                            s.isStay ? 'rounded-[3px] bg-[#3B82F6]' : 'rounded-full bg-[#F59E0B]'
                          }`}
                        />
                        <span className="w-px flex-1 bg-[#EAEAEE] block" />
                      </div>

                      <div className="flex-1 min-w-0 pb-4">
                        <div className="border border-[#EAEAEE] hover:border-[#D4D4DC] rounded-[12px] px-4 py-[14px] bg-white transition">
                          <div className="flex items-center gap-[7px]">
                            <span className="text-[13.5px] font-bold tracking-[-0.015em] text-[#17171B] min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">
                              {s.deal.brand}
                            </span>
                            {s.isStay && (
                              <span className="text-[10px] font-bold bg-[#DBEAFE] text-[#1D4ED8] rounded-[4px] px-1.5 py-0.5 flex-shrink-0">숙박</span>
                            )}
                            {s.isShoot && (
                              <span className="text-[10px] font-bold bg-[#DBEAFE] text-[#1D4ED8] rounded-[4px] px-1.5 py-0.5 flex-shrink-0">숙박 촬영</span>
                            )}
                            <span className="text-[10px] font-bold rounded-[4px] px-1.5 py-0.5 flex-shrink-0 bg-[#DCFCE7] text-[#15803D]">확정</span>
                          </div>
                          <div className="text-[11.5px] text-[#7C7C88] mt-1">{s.deal.what}</div>

                          {/* 방문지 — 숙박 카드에는 그리지 않는다. 간략 위치는 빈 값이 정상. */}
                          {!s.isStay && s.deal.stops.length > 0 && (
                            <div className="flex flex-col gap-[5px] mt-[9px]">
                              {s.deal.stops.map((p, i) => (
                                <div key={`${s.key}-stop-${i}`} className="flex items-baseline gap-2">
                                  <span className="text-[11px] font-bold text-[#3C3C46] w-[42px] flex-shrink-0 tabular-nums">{p.at}</span>
                                  <span className="text-[11.5px] text-[#3C3C46] min-w-0">{p.name}</span>
                                  <span className="text-[10.5px] text-[#B0B0BB] min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">
                                    {p.place ?? ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="text-[10.5px] text-[#B0B0BB] mt-[7px]">{s.spanNote}</div>

                          {s.isShoot ? (
                            // 한 건이 두 카드로 보이는데 금액이 두 번 나오면 두 건으로 읽힌다.
                            <div className="text-[10.5px] text-[#1D4ED8] mt-[7px]">
                              같은 건이에요 — 조건과 정산은 숙박 카드에 있어요
                            </div>
                          ) : (
                            <div className="flex items-center gap-[9px] mt-[11px] pt-[11px] border-t border-[#F5F5F7]">
                              {s.deal.budget > 0 ? (
                                <span
                                  title="합의된 금액이에요"
                                  className="flex-shrink-0 whitespace-nowrap text-[13px] font-extrabold tracking-[-0.02em] tabular-nums text-[#17171B]"
                                >
                                  {won(s.deal.budget)}원
                                </span>
                              ) : (
                                // 제공만인 건에 「0원」이라 쓰지 않는다 — 손해 본 건으로 읽힌다.
                                <PerkEditable
                                  proposalId={s.deal.id}
                                  userId={user.id}
                                  perk={s.deal.perk}
                                  variant="only"
                                />
                              )}
                              {s.deal.budget > 0 && s.deal.perk && (
                                <PerkEditable
                                  proposalId={s.deal.id}
                                  userId={user.id}
                                  perk={s.deal.perk}
                                  variant="plus"
                                />
                              )}
                              {/* 제공만인 건에 「결제일 미정」을 붙이지 않는다 — 정할 결제일이 남은 것으로 읽힌다. */}
                              <span className="text-[11px] text-[#9A9AA5] flex-shrink-0 whitespace-nowrap">
                                {s.deal.budget > 0
                                  ? s.deal.settlementDate ? `결제 ${monthDayKo(s.deal.settlementDate)}` : '결제일 미정'
                                  : '결제 없음'}
                              </span>
                              {/* D29 1번 — 「딜시트 열기」는 딜시트로 간다(전엔 대화로 갔다) */}
                              <Link
                                href={`/influencer/deals/${s.deal.id}`}
                                className="ml-auto text-[11.5px] font-bold text-[#B45309] hover:text-[#92400E] flex-shrink-0 whitespace-nowrap"
                              >
                                딜시트 열기 →
                              </Link>
                            </div>
                          )}

                          {s.isStay && (
                            <div className="text-[10.5px] text-[#1D4ED8] mt-[7px]">
                              이 시간대에 다른 일정을 함께 넣을 수 있어요
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}

          {/* 아직 시간이 안 정해진 건 — 0건이면 카드 자체를 그리지 않는다.
              합계·빈 시간 계산에는 넣지 않되, 화면에서 사라지게 두지도 않는다. */}
          {pending.length > 0 && (
            <div className="bg-white border border-[#EAEAEE] rounded-[14px] overflow-hidden">
              <div className="h-[50px] flex items-center px-5 bg-[#FFFBEB] border-b border-[#FDE68A]">
                <h2 className="m-0 text-[14px] font-extrabold tracking-[-0.02em] text-[#17171B]">
                  아직 시간이 안 정해진 {pending.length}건
                </h2>
                <span className="ml-auto text-[11.5px] text-[#B45309]">시간을 정해야 시간표에 들어가요</span>
              </div>
              <div className="flex flex-col">
                {pending.map((d) => (
                  <div key={d.id} className="flex items-center gap-[9px] px-5 py-[13px] border-b border-[#F5F5F7] last:border-b-0">
                    <span className="text-[13px] font-bold tracking-[-0.015em] text-[#17171B] min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">
                      {d.brand}
                    </span>
                    <span className="text-[10px] font-bold bg-[#FEF3C7] text-[#B45309] rounded-[4px] px-1.5 py-0.5 flex-shrink-0">
                      {d.confirmed ? '시간 미정' : '협의중'}
                    </span>
                    <span className="text-[12.5px] font-extrabold tracking-[-0.02em] tabular-nums flex-shrink-0 whitespace-nowrap ml-2 text-[#17171B]">
                      {d.budget > 0 ? `${won(d.budget)}원` : (d.perk ?? '제공')}
                    </span>
                    <Link
                      href={dashHref(d)}
                      className="ml-auto h-8 px-3 rounded-[9px] bg-[#17171B] hover:bg-[#2A2A33] text-white text-[11.5px] font-bold flex items-center flex-shrink-0 transition"
                    >
                      대시에서 시간 정하기
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 우 — 320px */}
        <div className="flex flex-col gap-[14px] min-w-0">
          <div className="bg-[#17171B] rounded-[14px] px-5 py-[18px]">
            <div className="flex items-center gap-[7px]">
              <span className="w-[7px] h-[7px] rounded-full bg-[#F59E0B] block" />
              <span className="text-[11.5px] font-bold text-white/[0.62] tracking-[0.02em]">이 일정에서 받을 돈</span>
            </div>
            <div className="flex items-baseline gap-1 mt-2.5">
              <span className="text-[28px] font-extrabold tracking-[-0.035em] text-white leading-none tabular-nums">{won(cash)}</span>
              <span className="text-[13px] font-semibold text-white/[0.62]">원</span>
            </div>
            {/* 「각각 입금됩니다」가 없으면 한 번에 들어오는 돈으로 읽힌다. */}
            <div className="text-[11.5px] text-white/[0.42] leading-[1.7] mt-[9px] text-pretty">
              광고주마다 따로 계약한 건이라 각각 입금됩니다.
              {perkDeals.length > 0 && ` 이 밖에 ${perkDeals.map((d) => `${d.brand} ${d.perk}`).join(' · ')}을 받아요.`}
            </div>
          </div>

          <div className="bg-white border border-[#EAEAEE] rounded-[14px] overflow-hidden">
            <div className="h-[46px] flex items-center px-[18px] border-b border-[#F1F1F4]">
              <h2 className="m-0 text-[13.5px] font-bold tracking-[-0.01em] text-[#17171B]">받을 순서</h2>
              <span className="ml-auto text-[11px] text-[#9A9AA5]">결제 예정일 순</span>
            </div>
            <div className="flex flex-col">
              {pays.length === 0 ? (
                <div className="px-[18px] py-3 text-[11.5px] text-[#9A9AA5]">아직 받을 금액이 없어요.</div>
              ) : (
                pays.map((d) => (
                  <div key={d.id} className="flex items-center gap-2.5 px-[18px] py-3 border-b border-[#F5F5F7]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] flex-shrink-0 block" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-bold text-[#3C3C46] whitespace-nowrap overflow-hidden text-ellipsis">{d.brand}</div>
                      <div className="text-[10.5px] text-[#9A9AA5] mt-0.5">
                        {d.settlementDate ? `${monthDayKo(d.settlementDate)} 예정` : '결제일 미정'}
                      </div>
                    </div>
                    <span className="text-[12px] font-bold text-[#17171B] flex-shrink-0 tabular-nums">{won(d.budget)}원</span>
                  </div>
                ))
              )}
            </div>
            <div className="px-[18px] py-3 text-[11px] text-[#9A9AA5] leading-[1.65] border-t border-[#F1F1F4]">
              결제일이 아직 정해지지 않은 건은 대시에서 협의해 정해주세요.
            </div>
          </div>

          <div className="bg-white border border-[#EAEAEE] rounded-[14px] px-[18px] py-[15px]">
            <div className="text-[12px] font-extrabold text-[#3C3C46]">이 화면에 대해</div>
            <div className="flex flex-col gap-[9px] mt-[11px]">
              {NOTES.map((n, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="w-1 h-1 rounded-full bg-[#C4C4CE] mt-[7px] flex-shrink-0 block" />
                  <span className="text-[11.5px] text-[#5C5C68] leading-[1.65] min-w-0">{n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
