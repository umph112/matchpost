import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MyCampaignsList from '@/components/MyCampaignsList'

export const dynamic = 'force-dynamic'

const pad = (n: number) => String(n).padStart(2, '0')

export default async function AdvertiserCampaignsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('advertiser_id', user.id)
    .order('created_at', { ascending: false })

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

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const withStatus = (campaigns ?? []).map((c) => {
    let st: '진행중' | '마감' | '캔슬' | '완료' = '진행중'
    if (c.status === 'cancelled') st = '캔슬'
    else if (c.status === 'completed') st = '완료'
    else if (c.date && c.date < todayStr) st = '마감'
    return { ...c, derivedStatus: st, stats: byCamp[c.id] ?? { total: 0, confirmed: 0, negotiating: 0 } }
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
