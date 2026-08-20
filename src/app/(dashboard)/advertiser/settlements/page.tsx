import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveCompany } from '@/lib/team/company'
import SettlementsView from '@/components/SettlementsView'

export const dynamic = 'force-dynamic'

export default async function SettlementsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // D14 6절 관찰1 — 회사 단위로 조회. 대표는 회사 전체, 팀원은 회사 것 중 자기 담당(manager_id)만 기본 노출.
  const company = await resolveCompany(supabase, user.id)
  let campaignsQuery = supabase
    .from('campaigns')
    .select('id, title, campaign_type, settlement_date, tax_doc_requested_at, status, overdue_reminder_count')
    .eq('advertiser_id', company.advertiserId)
  if (company.isMember) campaignsQuery = campaignsQuery.eq('manager_id', user.id)
  const { data: campaigns } = await campaignsQuery.order('settlement_date', { ascending: true })

  const campIds = (campaigns ?? []).map((c) => c.id)
  const { data: proposals } = campIds.length
    ? await supabase
        .from('proposals')
        .select('id, campaign_id, influencer_id, budget, advertiser_confirmed, influencer_confirmed, tax_doc_type, tax_doc_received, settlement_status, settled_at, paid_disputed_at, settlement_date')
        .in('campaign_id', campIds)
    : { data: [] }

  const infIds = [...new Set((proposals ?? []).map((p) => p.influencer_id))]
  const { data: profiles } = infIds.length
    ? await supabase.from('profiles').select('id, name').in('id', infIds)
    : { data: [] }
  const nameById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.name]))

  // D14 6절 — 정산을 기록하는 사람 이름(대표/팀원)
  const { data: me } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle()

  const enrichedProposals = (proposals ?? []).map((p) => ({
    ...p,
    profile: { name: nameById[p.influencer_id] ?? null },
  }))

  return (
    <SettlementsView
      campaigns={campaigns ?? []}
      proposals={enrichedProposals}
      recorderName={me?.name ?? undefined}
    />
  )
}
