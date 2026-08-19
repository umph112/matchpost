import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveCompany } from '@/lib/team/company'
import { viewShare } from '@/lib/team/viewShare'
import LeavesView, { type LeaveLite, type LeaveNote, type PendingItem, type DatedItem, type SubCand } from '@/components/LeavesView'

// 휴무·대행 — D14 4절. 대표는 수락 화면, 팀원은 신청 화면. 역할은 회사 소유 여부로 갈린다.
// 걸린 일(clash)은 스키마에 실제로 있는 값만: campaigns.content_end(게재 마감)·settlement_date(정산 예정일)
// + 미응답 대화(viewShare.waiting). 없는 값은 지어내지 않는다.
export const dynamic = 'force-dynamic'

const pad = (n: number) => String(n).padStart(2, '0')
const dayInMonth = (s: string | null, ymPrefix: string) =>
  s && s.startsWith(ymPrefix) ? Number(s.slice(8, 10)) : null

export default async function LeavesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const company = await resolveCompany(supabase, user.id)
  const ownerId = company.advertiserId

  // 이번 달 기준
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const todayDay = now.getDate()
  const dim = new Date(year, month, 0).getDate()
  const ymPrefix = `${year}-${pad(month)}`
  const monthStart = `${ymPrefix}-01`
  const monthEnd = `${ymPrefix}-${pad(dim)}`
  const monthLabel = `${year}년 ${month}월`

  // 대표 + 활동중 팀원
  const { data: teamRows } = await supabase
    .from('team_members')
    .select('member_id, role, status')
    .eq('owner_id', ownerId)
    .eq('status', 'active')
  const memberIds = (teamRows ?? []).filter((r) => r.member_id).map((r) => r.member_id as string)
  const companyIds = [ownerId, ...memberIds]

  // 회사 전체 캠페인 — 걸린 일과 대행자 부담을 한 번에 뽑는다
  const { data: allCamps } = await supabase
    .from('campaigns')
    .select('id, manager_id, title, content_end, settlement_date')
    .eq('advertiser_id', ownerId)
  const camps = allCamps ?? []

  // 이번 달과 겹치는 수락된 휴무
  const { data: apprRows } = await supabase
    .from('leaves')
    .select('id, member_id, from_date, to_date, kind, reason, status, substitute_id')
    .eq('advertiser_id', ownerId)
    .in('status', ['approved', 'done'])
    .lte('from_date', monthEnd)
    .gte('to_date', monthStart)
    .order('from_date', { ascending: true })

  // 내 진행 중 신청(팀원) — 대기/반려/답변
  const { data: openRows } = await supabase
    .from('leaves')
    .select('id, member_id, from_date, to_date, kind, reason, status, substitute_id')
    .eq('advertiser_id', ownerId)
    .eq('member_id', user.id)
    .in('status', ['pending', 'rejected', 'replied'])
    .order('created_at', { ascending: false })
    .limit(1)
  const myOpenRow = (openRows ?? [])[0] ?? null

  // 대표 수락 대기 목록
  const { data: pendRows } = company.isOwner
    ? await supabase
        .from('leaves')
        .select('id, member_id, from_date, to_date, kind, reason, status, substitute_id')
        .eq('advertiser_id', ownerId)
        .in('status', ['pending', 'rejected', 'replied'])
        .order('from_date', { ascending: true })
    : { data: [] as NonNullable<typeof apprRows> }

  // 이름 조회
  const nameIds = new Set<string>(companyIds)
  ;(apprRows ?? []).forEach((r) => { nameIds.add(r.member_id); if (r.substitute_id) nameIds.add(r.substitute_id) })
  ;(pendRows ?? []).forEach((r) => nameIds.add(r.member_id))
  const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', [...nameIds])
  const nameById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.name as string | null]))
  const nm = (id: string | null) => (id ? nameById[id] || '이름 미설정' : '')

  // 메모(스레드) 조회 — pending 이 아닌 건만
  const threadIds = [
    ...(myOpenRow && myOpenRow.status !== 'pending' ? [myOpenRow.id] : []),
    ...((pendRows ?? []).filter((r) => r.status !== 'pending').map((r) => r.id)),
  ]
  const { data: noteRows } = threadIds.length
    ? await supabase
        .from('leave_notes')
        .select('leave_id, author_id, text, at')
        .in('leave_id', threadIds)
        .order('at', { ascending: true })
    : { data: [] as { leave_id: string; author_id: string; text: string; at: string }[] }
  const notesByLeave: Record<string, LeaveNote[]> = {}
  ;(noteRows ?? []).forEach((n) => {
    ;(notesByLeave[n.leave_id] ??= []).push({
      who: nm(n.author_id),
      at: fmtAt(n.at),
      text: n.text,
      mine: n.author_id === ownerId, // 대표 메모 = 회색, 팀원 답 = 노랑 강조
    })
  })

  const toLite = (r: NonNullable<typeof apprRows>[number]): LeaveLite => ({
    id: r.id,
    memberId: r.member_id,
    memberName: nm(r.member_id),
    fromDate: r.from_date,
    toDate: r.to_date,
    kind: r.kind,
    reason: r.reason ?? null,
    status: r.status,
    substituteName: r.substitute_id ? nm(r.substitute_id) : null,
    notes: notesByLeave[r.id] ?? [],
  })

  const approved: LeaveLite[] = (apprRows ?? []).map(toLite)
  const myOpen: LeaveLite | null = myOpenRow ? toLite(myOpenRow) : null

  // 내 이번 달 걸린 일 (팀원 신청 폼) — 담당 캠페인의 게재 마감·정산 예정일
  const myDated: DatedItem[] = []
  for (const c of camps) {
    if (c.manager_id !== user.id) continue
    const ce = dayInMonth(c.content_end, ymPrefix)
    if (ce) myDated.push({ day: ce, what: `${c.title} 게재 마감` })
    const sd = dayInMonth(c.settlement_date, ymPrefix)
    if (sd) myDated.push({ day: sd, what: `${c.title} 정산 예정일` })
  }
  const myWaiting = company.isMember ? (await viewShare(supabase, ownerId, user.id)).waiting : 0

  // 담당 캠페인 수 (대행자 부담)
  const campsByManager: Record<string, number> = {}
  for (const c of camps) if (c.manager_id) campsByManager[c.manager_id] = (campsByManager[c.manager_id] ?? 0) + 1

  // 대표 수락 대기 항목 — 걸린 일 + 대행자 후보
  const pending: PendingItem[] = (company.isOwner ? (pendRows ?? []) : []).map((r) => {
    const clash = clashFor(camps, r.member_id, r.from_date, r.to_date)
    const candIds = companyIds.filter((id) => id !== r.member_id)
    const maxCand = Math.max(0, ...candIds.map((id) => campsByManager[id] ?? 0))
    const subs: SubCand[] = candIds.map((id) => {
      const n = campsByManager[id] ?? 0
      const heavy = n > 0 && n === maxCand
      return {
        id,
        name: id === ownerId ? `${nm(id)} (대표)` : nm(id),
        load: `담당 ${n}건 · ${heavy ? '가장 많이 맡음' : '여유 있음'}`,
        heavy,
      }
    })
    return {
      leave: toLite(r),
      clashN: clash.length,
      clashText: clash.map((c) => `${c.at} ${c.what}`).join(' · '),
      subs,
    }
  })

  return (
    <LeavesView
      isOwner={company.isOwner}
      year={year}
      month={month}
      todayDay={todayDay}
      monthLabel={monthLabel}
      myName={nm(user.id)}
      approved={approved}
      myOpen={myOpen}
      myDated={myDated}
      myWaiting={myWaiting}
      pending={pending}
    />
  )
}

// 특정 팀원의 [from,to] 기간에 걸친 게재 마감·정산 예정일
function clashFor(
  camps: { manager_id: string | null; title: string; content_end: string | null; settlement_date: string | null }[],
  memberId: string,
  from: string,
  to: string,
): { at: string; what: string; k: string }[] {
  const out: { at: string; what: string; k: string }[] = []
  const label = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`
  for (const c of camps) {
    if (c.manager_id !== memberId) continue
    if (c.content_end && c.content_end >= from && c.content_end <= to)
      out.push({ at: label(c.content_end), what: `${c.title} 게재 마감`, k: c.content_end })
    if (c.settlement_date && c.settlement_date >= from && c.settlement_date <= to)
      out.push({ at: label(c.settlement_date), what: `${c.title} 정산 예정일`, k: c.settlement_date })
  }
  return out.sort((a, b) => a.k.localeCompare(b.k))
}

// timestamptz → 'M/D HH:MM' (KST)
function fmtAt(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000)
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`
}
