import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettlementsView from '@/components/SettlementsView'

export const dynamic = 'force-dynamic'

export default async function SettlementsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, title, campaign_type, settlement_date, tax_doc_requested_at, status, overdue_reminder_count')
    .eq('advertiser_id', user.id)
    .order('settlement_date', { ascending: true })

  const campIds = (campaigns ?? []).map((c) => c.id)
  const { data: proposals } = campIds.length
    ? await supabase
        .from('proposals')
        .select('id, campaign_id, influencer_id, budget, advertiser_confirmed, influencer_confirmed, tax_doc_type, tax_doc_received, settlement_status, settled_at, paid_disputed_at')
        .in('campaign_id', campIds)
    : { data: [] }

  const infIds = [...new Set((proposals ?? []).map((p) => p.influencer_id))]
  const { data: profiles } = infIds.length
    ? await supabase.from('profiles').select('id, name').in('id', infIds)
    : { data: [] }
  const nameById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.name]))

  const enrichedProposals = (proposals ?? []).map((p) => ({
    ...p,
    profile: { name: nameById[p.influencer_id] ?? null },
  }))

  return (
    <SettlementsView
      campaigns={campaigns ?? []}
      proposals={enrichedProposals}
    />
  )
}
