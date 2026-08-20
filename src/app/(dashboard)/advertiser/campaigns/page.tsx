import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { resolveCompany } from '@/lib/team/company'
import MyCampaignsList from '@/components/MyCampaignsList'

export const dynamic = 'force-dynamic'

const pad = (n: number) => String(n).padStart(2, '0')
// timestamptz → 'M/D' (KST) — 이관 출처 표시용
const mdKst = (iso: string) => {
  const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000)
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()}`
}

export default async function AdvertiserCampaignsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 회사·모드 스코핑 — 대시보드와 동일(§2). 팀원/「내 업무」는 manager_id=나, 「회사 관리」는 회사 전체.
  // 솔로 대표는 모든 캠페인의 manager_id=advertiser_id 라 결과가 그대로다(무회귀).
  const company = await resolveCompany(supabase, user.id)
  const cookieStore = await cookies()
  const view = cookieStore.get('adv_view')?.value === 'all' ? 'all' : 'me'
  const scopeToMe = company.isMember || view === 'me'

  let campQuery = supabase
    .from('campaigns')
    .select('id,title,date,created_at,recruit_start,recruit_end,channels,campaign_type,budget_total,recruit_target,location_city,location_district,status')
    .eq('advertiser_id', company.advertiserId)
  if (scopeToMe) campQuery = campQuery.eq('manager_id', user.id)
  const { data: campaigns } = await campQuery.order('created_at', { ascending: false })

  const campIds = (campaigns ?? []).map((c) => c.id)
  const { data: cProposals } = campIds.length
    ? await supabase.from('proposals').select('campaign_id, advertiser_confirmed, influencer_confirmed').in('campaign_id', campIds)
    : { data: [] }

  const byCamp: Record<string, { total: number; confirmed: number; negotiating: number }> = {}
  for (const p of cProposals ?? []) {
    const g = (byCamp[p.campaign_id] ??= { total: 0, confirmed: 0, negotiating: 0 })
    g.total++
    if (p.advertiser_confirmed && p.influencer_confirmed) g.confirmed++
    else g.negotiating++
  }

  // 5-8 이관 꼬리표 — 나에게 이관된 캠페인(누구에게서·언제). transfers 에 행이 있으면 계속 붙는다.
  const receivedByCamp: Record<string, { fromName: string; when: string }> = {}
  if (campIds.length) {
    const { data: tr } = await supabase
      .from('transfers')
      .select('ref_id, from_id, at')
      .eq('to_id', user.id)
      .eq('kind', 'campaign')
      .in('ref_id', campIds)
      .order('at', { ascending: false })
    const fromIds = [...new Set((tr ?? []).map((t) => t.from_id as string).filter(Boolean))]
    const { data: fromProfs } = fromIds.length
      ? await supabase.from('profiles').select('id, name').in('id', fromIds)
      : { data: [] as { id: string; name: string | null }[] }
    const fromName = Object.fromEntries(
      (fromProfs ?? []).map((p) => [p.id as string, (p.name as string | null) || '이름 미설정']),
    )
    for (const t of tr ?? []) {
      const cid = t.ref_id as string
      if (receivedByCamp[cid]) continue // 최신 1건만(정렬 desc)
      receivedByCamp[cid] = { fromName: fromName[t.from_id as string] ?? '이름 미설정', when: mdKst(String(t.at)) }
    }
  }

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const withStatus = (campaigns ?? []).map((c) => {
    let st: '진행중' | '마감' | '캔슬' | '완료' = '진행중'
    if (c.status === 'cancelled') st = '캔슬'
    else if (c.status === 'completed') st = '완료'
    else if (c.date && c.date < todayStr) st = '마감'
    return { ...c, derivedStatus: st, stats: byCamp[c.id] ?? { total: 0, confirmed: 0, negotiating: 0 }, received: receivedByCamp[c.id] ?? null }
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">캠페인</h1>
        <Link
          href="/advertiser/campaigns/new"
          className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600"
        >
          ＋ 캠페인 등록
        </Link>
      </div>
      {withStatus.length === 0 ? (
        <p className="text-sm text-gray-400 bg-white rounded-2xl p-5 shadow-sm">아직 등록한 캠페인이 없어요.</p>
      ) : (
        <MyCampaignsList campaigns={withStatus} />
      )}
    </div>
  )
}
