import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import ConversationRow from '@/components/messages/ConversationRow'

export const dynamic = 'force-dynamic'

// 광고주 대화 목록 — 캠페인 대화(1:N)와 개인 대화(1:1)로 나눠 보여준다 (D6 A1)
export default async function AdvertiserMessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, campaign_id, influencer_id, created_at')
    .eq('advertiser_id', user.id)

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, title')
    .eq('advertiser_id', user.id)

  const campTitleById = Object.fromEntries((campaigns ?? []).map((c) => [c.id, c.title]))

  // 캠페인 그룹(campaign_id 있는 것) vs 개인 그룹(campaign_id 없는 것, influencer_id 기준)
  const byCampaign: Record<string, { influencerIds: Set<string> }> = {}
  const byPersonal: Record<string, true> = {}
  for (const p of proposals ?? []) {
    if (p.campaign_id) {
      (byCampaign[p.campaign_id] ??= { influencerIds: new Set() }).influencerIds.add(p.influencer_id)
    } else {
      byPersonal[p.influencer_id] = true
    }
  }

  const otherIds = [...new Set((proposals ?? []).map((p) => p.influencer_id))]
  const { data: msgs } = otherIds.length
    ? await supabase
        .from('messages')
        .select('sender_id, receiver_id, proposal_id, content, is_read, created_at')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
    : { data: [] }

  const proposalById = Object.fromEntries((proposals ?? []).map((p) => [p.id, p]))
  const { data: profiles } = otherIds.length
    ? await supabase.from('profiles').select('id, name').in('id', otherIds)
    : { data: [] }
  const nameById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.name]))

  // 캠페인방 미리보기/미응답: 그 campaign_id에 속한 모든 메시지 중 최신 + 안읽음 여부
  const campaignPreview: Record<string, { last: any; unread: boolean }> = {}
  const personalPreview: Record<string, { last: any; unread: boolean }> = {}
  for (const m of msgs ?? []) {
    const prop = m.proposal_id ? proposalById[m.proposal_id] : null
    if (!prop) continue
    const key = prop.campaign_id ?? `p:${prop.influencer_id}`
    const bucket = prop.campaign_id ? campaignPreview : personalPreview
    if (!bucket[key]) bucket[key] = { last: m, unread: false }
    if (m.receiver_id === user.id && !m.is_read) bucket[key].unread = true
  }

  // 이미 존재하는 conversations 행(담당자 등) — 없으면 목록 클릭 시 지연 생성되므로 여기선 id만 조회
  const campaignIds = Object.keys(byCampaign)
  const personalIds = Object.keys(byPersonal)
  const db = createServiceClient()
  const convRows: { id: string; kind: string; campaign_id: string | null; other_id: string | null }[] = []
  for (const cid of campaignIds) {
    const { data } = await db.rpc('get_or_create_conversation', {
      p_advertiser_id: user.id, p_kind: 'campaign', p_campaign_id: cid, p_other_id: null,
    })
    convRows.push({ id: data as string, kind: 'campaign', campaign_id: cid, other_id: null })
  }
  for (const oid of personalIds) {
    const { data } = await db.rpc('get_or_create_conversation', {
      p_advertiser_id: user.id, p_kind: 'personal', p_campaign_id: null, p_other_id: oid,
    })
    convRows.push({ id: data as string, kind: 'personal', campaign_id: null, other_id: oid })
  }

  const rows = convRows
    .map((c) => {
      if (c.kind === 'campaign') {
        const p = campaignPreview[c.campaign_id!]
        return {
          conv: c,
          title: campTitleById[c.campaign_id!] ?? '캠페인',
          subtitle: p?.last?.content || null,
          time: p?.last?.created_at,
          unread: p?.unread ?? false,
          participantCount: byCampaign[c.campaign_id!].influencerIds.size,
        }
      }
      const p = personalPreview[`p:${c.other_id}`]
      return {
        conv: c,
        title: nameById[c.other_id!] ?? '인플루언서',
        subtitle: p?.last?.content || null,
        time: p?.last?.created_at,
        unread: p?.unread ?? false,
        participantCount: undefined as number | undefined,
      }
    })
    .sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center mb-8">
        <Link href="/advertiser/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">
          ← 뒤로
        </Link>
        <h1 className="text-xl font-bold text-gray-900">대화</h1>
      </div>

      {rows.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">💬</div>
          <p className="text-gray-500">아직 대화가 없어요</p>
        </div>
      )}

      {rows.map((r) => (
        <ConversationRow
          key={r.conv.id}
          href={`/advertiser/messages/${r.conv.id}`}
          kind={r.conv.kind as 'campaign' | 'personal'}
          title={r.title}
          subtitle={r.subtitle}
          timeLabel={r.time ? new Date(r.time).toLocaleDateString('ko-KR') : ''}
          unread={r.unread}
          participantCount={r.participantCount}
        />
      ))}
    </div>
  )
}
