import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DealSheet from '@/components/DealSheet'

export const dynamic = 'force-dynamic'

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', id).single()
  if (!campaign) redirect('/advertiser/dashboard')
  if (campaign.advertiser_id !== user.id) redirect('/advertiser/dashboard')

  const { data: proposals } = await supabase
    .from('proposals')
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: true })

  const infIds = [...new Set((proposals ?? []).map((p) => p.influencer_id))]
  const [{ data: profiles }, { data: infProfs }] = await Promise.all([
    infIds.length
      ? supabase.from('profiles').select('id, name, avatar_url').in('id', infIds)
      : Promise.resolve({ data: [] }),
    infIds.length
      ? supabase.from('influencer_profiles').select('user_id, follower_count, platforms, match_score, review_count').in('user_id', infIds)
      : Promise.resolve({ data: [] }),
  ])

  const profileById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))
  const infProfById = Object.fromEntries((infProfs ?? []).map((i) => [i.user_id, i]))

  // D14 6절 — 정산을 기록하는 사람 이름(대표/팀원)
  const { data: me } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle()

  const enrichedProposals = (proposals ?? []).map((p) => ({
    ...p,
    profile: profileById[p.influencer_id] ?? null,
    influencer_profile: infProfById[p.influencer_id] ?? null,
  }))

  return (
    <DealSheet
      campaign={campaign}
      proposals={enrichedProposals}
      userId={user.id}
      recorderName={me?.name ?? undefined}
    />
  )
}
