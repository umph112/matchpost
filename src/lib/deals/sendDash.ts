'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type SendDashResult =
  | { ok: true; proposalId: string; resent: boolean }
  | { ok: false; error: string }

export async function sendDash(input: {
  influencerId: string
  scheduleId?: string | null
  campaignId?: string | null
  message?: string | null
  budget?: number | null
  collaborationType?: string | null
  date: string // YYYY-MM-DD, 필수 (D6 A6)
}): Promise<SendDashResult> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }
  if (!input.date) return { ok: false, error: '날짜를 골라야 보낼 수 있어요.' }

  const db = createServiceClient()
  const { data, error } = await db.rpc('send_dash', {
    p_advertiser_id: user.id,
    p_influencer_id: input.influencerId,
    p_schedule_id: input.scheduleId ?? null,
    p_campaign_id: input.campaignId ?? null,
    p_message: input.message?.trim() || null,
    p_budget: input.budget ?? null,
    p_collaboration_type: input.collaborationType ?? null,
    p_date: input.date,
  })

  if (error) return { ok: false, error: error.message }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { ok: false, error: '대시 전송에 실패했어요.' }
  return { ok: true, proposalId: row.proposal_id, resent: row.resent }
}
