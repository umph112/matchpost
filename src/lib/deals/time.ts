'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type TimeResult = { ok: true } | { ok: false; error: string }

export async function setProposalTime(
  proposalId: string,
  startAt: string,
  durationMin: number,
): Promise<TimeResult> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const { data: proposal } = await auth
    .from('proposals')
    .select('advertiser_id, influencer_id')
    .eq('id', proposalId)
    .maybeSingle()
  if (!proposal || (proposal.advertiser_id !== user.id && proposal.influencer_id !== user.id)) {
    return { ok: false, error: '해당 협업의 당사자만 시간을 설정할 수 있어요.' }
  }

  const db = createServiceClient()
  const { error } = await db.rpc('set_proposal_time', {
    p_proposal_id: proposalId,
    p_by_id: user.id,
    p_start_at: startAt,
    p_duration_min: durationMin,
  })

  if (error) {
    const m = error.message.match(/time_overlap:(.+)/)
    if (m) return { ok: false, error: `${m[1]} 협업과 겹쳐요.` }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
