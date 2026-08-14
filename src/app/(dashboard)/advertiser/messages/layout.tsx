import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import ConversationList, { type ConvRow } from '@/components/messages/ConversationList'
import MessagesSplit from '@/components/messages/MessagesSplit'
import { listDateLabel } from '@/lib/date'

export const dynamic = 'force-dynamic'

// D7 3-1/3-2 — 대화 목록은 이 라우트 그룹 전체(목록·[id])가 공유하는 좌측 패널.
// PC에서는 항상 노출, 모바일에서는 MessagesSplit이 라우트에 따라 한쪽만 보여준다.
export default async function AdvertiserMessagesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, campaign_id, influencer_id, created_at, advertiser_confirmed, influencer_confirmed')
    .eq('advertiser_id', user.id)

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, title')
    .eq('advertiser_id', user.id)

  const campTitleById = Object.fromEntries((campaigns ?? []).map((c) => [c.id, c.title]))

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

  // 캠페인방/개인방 미리보기: 최신 메시지, 안읽음 개수, 마지막 발신자(미응답 판정용)
  type Preview = { last: { content: string; created_at: string; sender_id: string } | null; unreadCount: number }
  const campaignPreview: Record<string, Preview> = {}
  const personalPreview: Record<string, Preview> = {}
  for (const m of msgs ?? []) {
    const prop = m.proposal_id ? proposalById[m.proposal_id] : null
    if (!prop) continue
    const key = prop.campaign_id ?? `p:${prop.influencer_id}`
    const bucket = prop.campaign_id ? campaignPreview : personalPreview
    if (!bucket[key]) bucket[key] = { last: m, unreadCount: 0 }
    if (m.receiver_id === user.id && !m.is_read) bucket[key].unreadCount++
  }

  const campaignIds = Object.keys(byCampaign)
  const personalIds = Object.keys(byPersonal)

  // D10 §1-2 — 단계 배지: 방에 속한 제안들의 확정 플래그를 집계해 가장 앞선 단계로.
  const stageOf = (list: { advertiser_confirmed?: boolean; influencer_confirmed?: boolean }[]): 'talking' | 'inner' | 'both' => {
    let best: 'talking' | 'inner' | 'both' = 'talking'
    for (const p of list) {
      const a = !!p.advertiser_confirmed, i = !!p.influencer_confirmed
      if (a && i) return 'both'
      if (a || i) best = 'inner'
    }
    return best
  }
  const campaignStage: Record<string, 'talking' | 'inner' | 'both'> = {}
  const personalStage: Record<string, 'talking' | 'inner' | 'both'> = {}
  for (const cid of campaignIds) campaignStage[cid] = stageOf((proposals ?? []).filter((p) => p.campaign_id === cid))
  for (const oid of personalIds) personalStage[oid] = stageOf((proposals ?? []).filter((p) => !p.campaign_id && p.influencer_id === oid))

  // D10 §1-2 — 개인방(1:1)만 매치스코어 노출. 캠페인방은 참여자 다수라 단일 점수 없음.
  const { data: ips } = personalIds.length
    ? await supabase.from('influencer_profiles').select('user_id, match_score, review_count').in('user_id', personalIds)
    : { data: [] }
  const scoreById = Object.fromEntries((ips ?? []).map((p) => [p.user_id, p]))

  const db = createServiceClient()
  const convRows: { id: string; kind: 'campaign' | 'personal'; campaign_id: string | null; other_id: string | null }[] = []
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

  const OVERDUE_MS = 2 * 24 * 60 * 60 * 1000
  type RowOpts = { participantCount?: number; matchScore?: number | null; reviewCount?: number; stage?: 'talking' | 'inner' | 'both' | 'canceled' }
  const toRow = (c: (typeof convRows)[number], p: Preview | undefined, title: string, opts: RowOpts = {}): ConvRow & { time: string } => ({
    convId: c.id,
    title,
    subtitle: p?.last?.content || null,
    time: p?.last?.created_at ?? '',
    timeLabel: p?.last?.created_at ? listDateLabel(p.last.created_at) : '',
    unreadCount: p?.unreadCount ?? 0,
    overdue: !!(p?.last && p.last.sender_id !== user.id && Date.now() - new Date(p.last.created_at).getTime() >= OVERDUE_MS),
    participantCount: opts.participantCount,
    matchScore: opts.matchScore,
    reviewCount: opts.reviewCount,
    stage: opts.stage,
  })

  const campaignRows = convRows
    .filter((c) => c.kind === 'campaign')
    .map((c) => toRow(c, campaignPreview[c.campaign_id!], campTitleById[c.campaign_id!] ?? '캠페인', {
      participantCount: byCampaign[c.campaign_id!].influencerIds.size,
      stage: campaignStage[c.campaign_id!],
    }))
    .sort((a, b) => b.time.localeCompare(a.time))
  const personalRows = convRows
    .filter((c) => c.kind === 'personal')
    .map((c) => toRow(c, personalPreview[`p:${c.other_id}`], nameById[c.other_id!] ?? '인플루언서', {
      matchScore: scoreById[c.other_id!]?.match_score ?? null,
      reviewCount: scoreById[c.other_id!]?.review_count ?? 0,
      stage: personalStage[c.other_id!],
    }))
    .sort((a, b) => b.time.localeCompare(a.time))

  return (
    <div className="flex flex-col gap-3 [.adv-pc_&]:h-full">
      <h1 className="text-xl font-bold text-gray-900 [.adv-pc_&]:text-[19px] [.adv-pc_&]:font-extrabold px-1">대시</h1>
      <MessagesSplit
        basePath="/advertiser/messages"
        pcClass="adv-pc"
        list={
          <ConversationList
            hrefPrefix="/advertiser/messages/"
            campaignRows={campaignRows}
            personalRows={personalRows}
            emptyActionHref="/advertiser/search"
            emptyActionLabel="인플루언서 찾기"
          />
        }
      >
        {children}
      </MessagesSplit>
    </div>
  )
}
