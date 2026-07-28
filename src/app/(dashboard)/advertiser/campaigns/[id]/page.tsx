import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CampaignBroadcast from '@/components/CampaignBroadcast'

export const dynamic = 'force-dynamic'

function confirmLabel(p: { advertiser_confirmed: boolean; influencer_confirmed: boolean }) {
  if (p.advertiser_confirmed && p.influencer_confirmed) return { label: '확정', color: 'bg-green-100 text-green-600' }
  if (p.influencer_confirmed) return { label: '인플루언서 확인', color: 'bg-blue-100 text-blue-600' }
  if (p.advertiser_confirmed) return { label: '내 확인 완료', color: 'bg-amber-100 text-amber-700' }
  return { label: '협의중', color: 'bg-gray-100 text-gray-500' }
}

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
    .order('created_at', { ascending: false })

  const infIds = [...new Set((proposals ?? []).map((p) => p.influencer_id))]
  const { data: names } = infIds.length
    ? await supabase.from('profiles').select('id, name').in('id', infIds)
    : { data: [] }
  const nameById = Object.fromEntries((names ?? []).map((p) => [p.id, p.name]))
  const { data: infProfs } = infIds.length
    ? await supabase.from('influencer_profiles').select('user_id, follower_count').in('user_id', infIds)
    : { data: [] }
  const followerById = Object.fromEntries((infProfs ?? []).map((i) => [i.user_id, i.follower_count]))

  const participants = (proposals ?? []).map((p) => ({
    proposalId: p.id,
    influencerId: p.influencer_id,
    name: nameById[p.influencer_id] ?? '인플루언서',
    follower: followerById[p.influencer_id],
    budget: p.budget,
    ...confirmLabel(p),
  }))

  const confirmedCount = participants.filter((p) => p.label === '확정').length

  const coverUrl: string = campaign.cover_image_url || campaign.image_urls?.[0] || ''
  const albumUrls: string[] = (campaign.image_urls ?? []).filter((u: string) => u !== coverUrl)

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center mb-6">
        <Link href="/advertiser/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">← 뒤로</Link>
        <h1 className="text-xl font-bold text-gray-900 truncate">{campaign.title}</h1>
      </div>

      {/* 대표사진 */}
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt={campaign.title}
          className="w-full aspect-video object-cover rounded-2xl mb-4"
        />
      )}

      {/* 앨범 (나머지 사진) */}
      {albumUrls.length > 0 && (
        <div className={`grid gap-2 mb-4 ${albumUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {albumUrls.map((url: string) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt=""
              className="w-full aspect-square object-cover rounded-xl"
            />
          ))}
        </div>
      )}

      {/* 캠페인 정보 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4 border-l-4 border-amber-400">
        <div className="text-sm text-gray-600 space-y-1">
          <p>📅 {new Date(campaign.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</p>
          <p>📍 {campaign.location_city} {campaign.location_district}</p>
          {(campaign.start_time || campaign.end_time) && (
            <p>🕐 {campaign.start_time?.slice(0, 5)}{campaign.end_time ? ` ~ ${campaign.end_time.slice(0, 5)}` : ''}</p>
          )}
        </div>
        {(campaign.predefined_categories?.length > 0 || campaign.free_tags?.length > 0) && (
          <div className="flex flex-wrap gap-1 mt-2">
            {campaign.predefined_categories?.map((t: string) => (
              <span key={t} className="text-[11px] bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">{t}</span>
            ))}
            {campaign.free_tags?.map((t: string) => (
              <span key={t} className="text-[11px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">#{t}</span>
            ))}
          </div>
        )}
        {campaign.details && <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap">{campaign.details}</p>}
        <div className="flex gap-2 mt-3">
          <Link href="/advertiser/campaigns/new" className="text-xs text-amber-600 hover:underline">수정</Link>
        </div>
      </div>

      {/* 참여 인플루언서 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-800">
          👥 참여 인플루언서 <span className="text-gray-400 font-normal">{participants.length}</span>
        </h2>
        <span className="text-xs text-green-600">확정 {confirmedCount}</span>
      </div>

      {participants.length === 0 ? (
        <p className="text-sm text-gray-400 bg-white rounded-2xl p-4 shadow-sm mb-4">아직 참여한 인플루언서가 없어요.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {participants.map((p) => (
            <div key={p.proposalId} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center min-w-0">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold mr-3">
                    {p.name?.[0] ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">
                      {p.follower ? `팔로워 ${p.follower.toLocaleString()}` : ''}
                      {p.budget ? ` · ${p.budget.toLocaleString()}원` : ''}
                    </p>
                  </div>
                </div>
                <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${p.color}`}>{p.label}</span>
              </div>
              <Link
                href={`/advertiser/messages?receiverId=${p.influencerId}&proposalId=${p.proposalId}`}
                className="mt-3 block text-center bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                💬 개별 메시지
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* 단체 메시지 */}
      {participants.length > 0 && (
        <CampaignBroadcast
          senderId={user.id}
          participants={participants.map((p) => ({ influencerId: p.influencerId, name: p.name, proposalId: p.proposalId, confirmed: p.label === '확정' }))}
        />
      )}
    </div>
  )
}
