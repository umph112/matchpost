import type { SupabaseClient } from '@supabase/supabase-js'

// 담당자별 업무 집계 — D14 2·3절.
//
// viewAs 규칙:
//   'me'        → campaigns.manager_id = 로그인 id (호출부에서 넘긴 loginId)
//   <member id> → campaigns.manager_id = 그 팀원 id
//   'all'       → 회사 전체를 팀원별로 합산 (respHours 는 가중평균)
//
// ⚠️ 스펙 시그니처는 viewShare(advertiserId, viewAs) 지만, 쿼리에 클라이언트가 필요해
// resolveCompany 와 동일하게 supabase 를 첫 인자로 받는다.
export type ShareStats = {
  camps: number // 담당 캠페인 수
  campsNew: number // 이번 달 등록
  done: number // 완료(status='completed') 캠페인 수
  infl: number // 확정 인플루언서
  talking: number // 협의중
  spend: number // 확정 집행 예정(원)
  waiting: number // 응답 대기(미응답 대화)
  respHours: number // 평균 응답 시간(시간) — 근사치
}

const empty: ShareStats = { camps: 0, campsNew: 0, done: 0, infl: 0, talking: 0, spend: 0, waiting: 0, respHours: 0 }

function monthRange(): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const pad = (n: number) => String(n).padStart(2, '0')
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${new Date(y, m, 0).getDate()}` }
}

// manager 한 명(또는 me)의 집계
async function statsFor(
  supabase: SupabaseClient,
  advertiserId: string,
  managerId: string,
): Promise<ShareStats> {
  const { start, end } = monthRange()

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, created_at, date, status')
    .eq('advertiser_id', advertiserId)
    .eq('manager_id', managerId)
  const camps = campaigns ?? []
  const campIds = camps.map((c) => c.id)
  const campsNew = camps.filter((c) => c.created_at && c.created_at.slice(0, 10) >= start && c.created_at.slice(0, 10) <= end).length
  const done = camps.filter((c) => c.status === 'completed').length

  let infl = 0
  let talking = 0
  let spend = 0
  if (campIds.length) {
    const { data: props } = await supabase
      .from('proposals')
      .select('advertiser_confirmed, influencer_confirmed, budget')
      .in('campaign_id', campIds)
    for (const p of props ?? []) {
      if (p.advertiser_confirmed && p.influencer_confirmed) {
        infl++
        spend += p.budget || 0
      } else {
        talking++
      }
    }
  }

  // 응답 대기 + 평균 응답 시간(근사) — manager 가 receiver 인 미읽음 대화 수.
  // respHours 는 인플루언서 발신 → manager 응답까지의 평균 간격(가능한 범위에서만).
  const { data: msgs } = await supabase
    .from('messages')
    .select('sender_id, receiver_id, is_read, created_at')
    .or(`sender_id.eq.${managerId},receiver_id.eq.${managerId}`)
    .order('created_at', { ascending: true })
    .limit(200)
  const unreadOthers = new Set<string>()
  const pending: Record<string, string> = {} // other → 상대 발신 시각(응답 대기)
  const gaps: number[] = []
  for (const m of msgs ?? []) {
    const other = m.sender_id === managerId ? m.receiver_id : m.sender_id
    if (m.receiver_id === managerId) {
      if (!m.is_read) unreadOthers.add(other)
      if (!pending[other]) pending[other] = m.created_at
    } else {
      // manager 발신 = 응답. 직전 상대 발신과의 간격을 시간으로.
      if (pending[other]) {
        const gap = (new Date(m.created_at).getTime() - new Date(pending[other]).getTime()) / 36e5
        if (gap >= 0) gaps.push(gap)
        delete pending[other]
      }
    }
  }
  const waiting = unreadOthers.size
  const respHours = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0

  return { camps: camps.length, campsNew, done, infl, talking, spend, waiting, respHours }
}

export async function viewShare(
  supabase: SupabaseClient,
  advertiserId: string,
  viewAs: string,
): Promise<ShareStats> {
  if (viewAs !== 'all') {
    // 'me' 든 특정 member id 든, 호출부가 실제 id 를 넘긴다(‘me’ 는 로그인 id 로 치환해 전달).
    return statsFor(supabase, advertiserId, viewAs)
  }

  // 회사 전체 = 활동중 팀원 + 대표(=advertiserId) 각각을 집계해 합산.
  const { data: teamRows } = await supabase
    .from('team_members')
    .select('member_id, role, status')
    .eq('owner_id', advertiserId)
    .eq('status', 'active')
  const memberIds = [
    advertiserId,
    ...(teamRows ?? []).filter((r) => r.member_id).map((r) => r.member_id as string),
  ]

  const perMember = await Promise.all(memberIds.map((id) => statsFor(supabase, advertiserId, id)))

  // 합산 — respHours 는 담당 캠페인 수(camps)로 가중평균. (6+4+9=19 이 아니라 가중평균)
  const sum = perMember.reduce<ShareStats>((acc, s) => ({
    camps: acc.camps + s.camps,
    campsNew: acc.campsNew + s.campsNew,
    done: acc.done + s.done,
    infl: acc.infl + s.infl,
    talking: acc.talking + s.talking,
    spend: acc.spend + s.spend,
    waiting: acc.waiting + s.waiting,
    respHours: acc.respHours, // 아래에서 별도 계산
  }), { ...empty })

  const weightNum = perMember.reduce((a, s) => a + s.respHours * s.camps, 0)
  const weightDen = perMember.reduce((a, s) => a + s.camps, 0)
  sum.respHours = weightDen ? Math.round(weightNum / weightDen) : 0

  return sum
}
