'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type SendResult = { ok: true } | { ok: false; error: string }

// D6 A3/A4 — 캠페인 대화 발송. onlyInfluencerId가 있으면 그 사람에게만(개별 발송),
// 없으면 참여자 전원에게 브로드캐스트한다. 소유자가 담당자 아닌 대화에 보내면 대리 발송으로 남는다.
export async function sendCampaignMessage(input: {
  campaignId: string
  content: string
  onlyInfluencerId?: string | null
}): Promise<SendResult> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const { data: campaign } = await auth.from('campaigns').select('advertiser_id').eq('id', input.campaignId).maybeSingle()
  if (!campaign || campaign.advertiser_id !== user.id) return { ok: false, error: '권한이 없어요.' }

  const { data: conv } = await auth
    .from('conversations')
    .select('manager_id')
    .eq('advertiser_id', user.id)
    .eq('campaign_id', input.campaignId)
    .maybeSingle()
  const proxy = !!(conv?.manager_id && conv.manager_id !== user.id)

  const db = createServiceClient()
  const { error } = await db.rpc('send_campaign_message', {
    p_advertiser_id: user.id,
    p_campaign_id: input.campaignId,
    p_content: input.content,
    p_only_influencer_id: input.onlyInfluencerId ?? null,
    p_proxy: proxy,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
