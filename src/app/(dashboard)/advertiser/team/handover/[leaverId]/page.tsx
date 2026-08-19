import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import HandoverView, {
  type Role,
  type Candidate,
  type CampItem,
  type ConvItem,
  type LogItem,
} from '@/components/HandoverView'

// 퇴사 · 이관 — D14 5절. 「이관내역 보기」 화면(5-6)은 세 역할이 같은 레이아웃을 보고
// 버튼 라벨만 다르다. 받는 사람 마이페이지 배너(5-5)·인플루언서 시스템 줄(5-9)은 다음 차수.
//
// 데이터는 모두 실제 스키마에서 온다:
//   - 남은 담당 = campaigns.manager_id = 퇴사자  (딸린 캠페인 대화는 캠페인을 따라가므로 목록엔 안 나옴)
//   - 개인 대화 = conversations.kind='personal' · manager_id = 퇴사자  (대표 보관 대상)
//   - conversations 는 RLS(SELECT) 로 실행자가 당사자 아닐 수 있어 로더는 service 로 읽는다.
export const dynamic = 'force-dynamic'

const md = (s: string | null) => (s ? `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}` : '')

export default async function HandoverPage({ params }: { params: Promise<{ leaverId: string }> }) {
  const { leaverId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()

  // 퇴사 진행 중(leaving) 또는 비활성(inactive) 팀원이어야 이 화면이 의미 있다
  const { data: lm } = await db
    .from('team_members')
    .select('owner_id, member_id, status, leave_on')
    .eq('member_id', leaverId)
    .in('status', ['leaving', 'inactive'])
    .maybeSingle()
  if (!lm || !lm.owner_id) redirect('/advertiser/team')
  const adv = lm.owner_id as string

  // 보는 사람이 이 회사 소속이어야 한다(대표 또는 활동중/퇴사예정 팀원)
  const viewerInCompany =
    user.id === adv ||
    !!(
      await db
        .from('team_members')
        .select('member_id')
        .eq('owner_id', adv)
        .eq('member_id', user.id)
        .in('status', ['active', 'leaving'])
        .maybeSingle()
    ).data
  if (!viewerInCompany) redirect('/advertiser/dashboard')

  const role: Role = user.id === leaverId ? 'leaver' : user.id === adv ? 'owner' : 'receiver'

  // 받는 사람 후보 = 대표 + 활동중 팀원(퇴사자 제외)
  const { data: activeRows } = await db
    .from('team_members')
    .select('member_id')
    .eq('owner_id', adv)
    .eq('status', 'active')
  const candIds = [adv, ...(activeRows ?? []).map((r) => r.member_id as string).filter((id) => id && id !== leaverId)]
  const uniqCandIds = [...new Set(candIds)]

  // 이름
  const nameIds = new Set<string>([leaverId, ...uniqCandIds])
  const { data: profiles } = await db.from('profiles').select('id, name').in('id', [...nameIds])
  const nameById = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id as string, (p.name as string | null) || '이름 미설정']),
  )
  const nm = (id: string) => nameById[id] ?? '이름 미설정'

  const candidates: Candidate[] = uniqCandIds.map((id) => ({
    id,
    name: id === adv ? `${nm(id)} (대표)` : nm(id),
    isOwner: id === adv,
  }))

  // 퇴사자에게 남은 담당 캠페인
  const { data: campRows } = await db
    .from('campaigns')
    .select('id, title, status, date, content_end, settlement_date')
    .eq('advertiser_id', adv)
    .eq('manager_id', leaverId)
    .order('created_at', { ascending: false })
  const camps0 = campRows ?? []
  const campIds = camps0.map((c) => c.id as string)

  // 모집/예산 (proposals)
  const propsByCamp: Record<string, { total: number; confirmed: number; spend: number }> = {}
  if (campIds.length) {
    const { data: props } = await db
      .from('proposals')
      .select('campaign_id, advertiser_confirmed, influencer_confirmed, budget')
      .in('campaign_id', campIds)
    for (const p of props ?? []) {
      const k = p.campaign_id as string
      const agg = (propsByCamp[k] ??= { total: 0, confirmed: 0, spend: 0 })
      agg.total++
      if (p.advertiser_confirmed && p.influencer_confirmed) {
        agg.confirmed++
        agg.spend += (p.budget as number) || 0
      }
    }
  }

  // 딸린 캠페인 대화 수(5-7 「대화 N건 포함」)
  const convCountByCamp: Record<string, number> = {}
  if (campIds.length) {
    const { data: cc } = await db
      .from('conversations')
      .select('campaign_id')
      .eq('advertiser_id', adv)
      .eq('kind', 'campaign')
      .in('campaign_id', campIds)
    for (const r of cc ?? []) {
      const k = r.campaign_id as string
      convCountByCamp[k] = (convCountByCamp[k] ?? 0) + 1
    }
  }

  const camps: CampItem[] = camps0.map((c) => {
    const agg = propsByCamp[c.id as string] ?? { total: 0, confirmed: 0, spend: 0 }
    const done = c.status === 'completed'
    const bits: string[] = [`확정 ${agg.confirmed}명`]
    if (agg.total - agg.confirmed > 0) bits.push(`협의 ${agg.total - agg.confirmed}명`)
    if (c.content_end) bits.push(`게재 마감 ${md(c.content_end as string)}`)
    if (c.settlement_date) bits.push(`정산 예정 ${md(c.settlement_date as string)}`)
    return {
      id: c.id as string,
      title: (c.title as string) || '제목 없음',
      stLabel: done ? '완료' : '진행중',
      meta: (convCountByCamp[c.id as string] ?? 0) > 0 ? `대화 ${convCountByCamp[c.id as string]}건 포함` : '',
      people: `${agg.confirmed} / ${agg.total}`,
      period: c.content_end ? `~${md(c.content_end as string)}` : c.date ? md(c.date as string) : '—',
      pay: agg.spend > 0 ? agg.spend.toLocaleString() : '—',
      handover: bits.join(' · '),
    }
  })

  // 퇴사자의 개인 대화(대표 보관 대상)
  const { data: pconvRows } = await db
    .from('conversations')
    .select('id, other_id, created_at')
    .eq('advertiser_id', adv)
    .eq('kind', 'personal')
    .eq('manager_id', leaverId)
    .order('created_at', { ascending: false })
  const pconvs0 = pconvRows ?? []
  const otherIds = [...new Set(pconvs0.map((c) => c.other_id as string).filter(Boolean))]
  const { data: otherProfiles } = otherIds.length
    ? await db.from('profiles').select('id, name').in('id', otherIds)
    : { data: [] as { id: string; name: string | null }[] }
  const otherName = Object.fromEntries(
    (otherProfiles ?? []).map((p) => [p.id as string, (p.name as string | null) || '이름 미설정']),
  )
  const convos: ConvItem[] = pconvs0.map((c) => {
    const name = c.other_id ? otherName[c.other_id as string] ?? '이름 미설정' : '이름 미설정'
    return {
      id: c.id as string,
      name,
      initial: (name.trim().split(/\s+/).pop() ?? name)[0] ?? '·',
      when: md(String(c.created_at).slice(0, 10)),
    }
  })

  // 이관 기록(꼬리표·출처의 근거) — 이 퇴사자에게서 나간 이력
  const { data: tRows } = await db
    .from('transfers')
    .select('kind, to_id, memo, at')
    .eq('from_id', leaverId)
    .order('at', { ascending: false })
    .limit(20)
  const log: LogItem[] = (tRows ?? []).map((t) => ({
    at: fmtAt(String(t.at)),
    what: `${t.kind === 'campaign' ? '캠페인' : '개인 대화'} → ${nm(t.to_id as string)}${t.memo ? ' · 메모 남김' : ''}`,
  }))

  return (
    <HandoverView
      role={role}
      myId={user.id}
      leaverName={nm(leaverId)}
      leaveOn={(lm.leave_on as string | null) ?? null}
      dueLabel={lm.leave_on ? dLabel(lm.leave_on as string) : null}
      ownerId={adv}
      candidates={candidates}
      camps={camps}
      convos={convos}
      log={log}
    />
  )
}

// timestamptz → 'M/D HH:MM' (KST)
function fmtAt(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`
}

// 남은 일수 — 'D-7' / 'D-day' / 'D+3' (KST 기준)
function dLabel(dateStr: string): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000)
  const t0 = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate())
  const [y, m, d] = dateStr.split('-').map(Number)
  const t1 = Date.UTC(y, m - 1, d)
  const diff = Math.round((t1 - t0) / 86400000)
  if (diff === 0) return 'D-day'
  return diff > 0 ? `D-${diff}` : `D+${-diff}`
}
