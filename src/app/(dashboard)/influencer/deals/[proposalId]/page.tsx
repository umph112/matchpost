import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DealSheet, { type DealSheetCampaign } from '@/components/DealSheet'
import { openDealCampaign } from '@/lib/deals/openDeal'

export const dynamic = 'force-dynamic'

// D29 1번 — 인플루언서도 같은 딜시트를 본다. 기록·정산은 광고주 몫이라 조작은 감추고(viewerRole),
// 지금 몇 단계인지·조건은 무엇인지·결제일은 언제인지를 읽는 자리다.
export default async function InfluencerDealSheetPage({
  params,
}: {
  params: Promise<{ proposalId: string }>
}) {
  const { proposalId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: proposal } = await supabase.from('proposals').select('*').eq('id', proposalId).maybeSingle()
  if (!proposal) redirect('/influencer/proposals')
  if (proposal.influencer_id !== user.id) redirect('/influencer/dashboard')

  let campaign: DealSheetCampaign | null = null
  let backHref = '/influencer/proposals'
  let backLabel = '← 받은 대시'

  if (proposal.campaign_id) {
    const { data: c } = await supabase.from('campaigns').select('*').eq('id', proposal.campaign_id).maybeSingle()
    // 캠페인 줄을 못 읽으면(권한) 단계를 지어내지 않고 대시로 돌려보낸다 — 틀린 단계표가 더 나쁘다.
    if (!c) redirect('/influencer/proposals')
    campaign = c as DealSheetCampaign
  } else {
    const { data: schedule } = await supabase
      .from('schedules')
      .select('id, title, date, date_end, location_city, location_district, channels')
      .eq('id', proposal.schedule_id)
      .maybeSingle()
    if (!schedule) redirect('/influencer/proposals')
    campaign = openDealCampaign(schedule)
    backHref = `/influencer/schedule/${schedule.id}`
    backLabel = '← 이 날 일정'
  }

  const [{ data: profile }, { data: infProf }] = await Promise.all([
    supabase.from('profiles').select('id, name, avatar_url').eq('id', user.id).maybeSingle(),
    supabase
      .from('influencer_profiles')
      .select('user_id, follower_count, platforms, match_score, review_count')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  return (
    <DealSheet
      campaign={campaign}
      proposals={[{ ...proposal, profile: profile ?? null, influencer_profile: infProf ?? null }]}
      userId={user.id}
      viewerRole="influencer"
      dealKind={proposal.campaign_id ? 'campaign' : 'open'}
      backHref={backHref}
      backLabel={backLabel}
    />
  )
}
