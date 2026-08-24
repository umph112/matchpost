import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveCompany } from '@/lib/team/company'
import DealSheet from '@/components/DealSheet'
import { openDealCampaign } from '@/lib/deals/openDeal'

export const dynamic = 'force-dynamic'

// D29 1번 — 딜시트의 단위를 협업(proposal)으로. 오픈에서 바로 성사된 건(campaign_id 없음)은
// 캠페인 딜시트로 갈 길이 없어 성사 이후가 통째로 비어 있었다.
export default async function OpenDealSheetPage({
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
  if (!proposal) redirect('/advertiser/dashboard')

  // 캠페인 건이면 원래 딜시트가 주인이다 — 같은 표가 두 주소에 살지 않게 넘긴다.
  if (proposal.campaign_id) redirect(`/advertiser/campaigns/${proposal.campaign_id}`)

  // 게이트는 캠페인 딜시트와 같은 결 — 회사 소유 여부로 본다(대표·팀원 모두 열린다).
  const company = await resolveCompany(supabase, user.id)
  if (proposal.advertiser_id !== company.advertiserId) redirect('/advertiser/dashboard')

  const { data: schedule } = await supabase
    .from('schedules')
    .select('id, title, date, date_end, location_city, location_district, channels')
    .eq('id', proposal.schedule_id)
    .maybeSingle()
  if (!schedule) redirect('/advertiser/dashboard')

  const [{ data: profile }, { data: infProf }, { data: me }] = await Promise.all([
    supabase.from('profiles').select('id, name, avatar_url').eq('id', proposal.influencer_id).maybeSingle(),
    supabase
      .from('influencer_profiles')
      .select('user_id, follower_count, platforms, match_score, review_count')
      .eq('user_id', proposal.influencer_id)
      .maybeSingle(),
    supabase.from('profiles').select('name').eq('id', user.id).maybeSingle(),
  ])

  return (
    <DealSheet
      campaign={openDealCampaign(schedule)}
      proposals={[{ ...proposal, profile: profile ?? null, influencer_profile: infProf ?? null }]}
      userId={user.id}
      recorderName={me?.name ?? undefined}
      dealKind="open"
      backHref="/advertiser/dashboard"
      backLabel="← 대시보드"
    />
  )
}
