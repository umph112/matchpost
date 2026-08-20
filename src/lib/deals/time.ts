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

// D20 §3 — 결제일 변경 제안. 대시 대화창에서 양쪽 다 보낼 수 있다. 수락은 acceptDateProposal 이 처리한다.
export async function proposeSettlementDate(
  proposalId: string,
  date: string,
  reason: string,
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
    return { ok: false, error: '해당 협업의 당사자만 결제일을 제안할 수 있어요.' }
  }

  const db = createServiceClient()
  const { error } = await db.rpc('propose_settlement_date', {
    p_proposal_id: proposalId,
    p_by_id: user.id,
    p_date: date,
    p_reason: reason.trim() || null,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// D6 A7 — 날짜 제안 수락. 상대가 보낸 제안에만 쓸 수 있고, 수락하면 곧바로 진행일(start_at)이 된다.
// D20 §3 — 결제일 제안(proposed_date_kind='settlement')이면 RPC 안에서 매출 시점만 옮긴다(진행일 불변).
export async function acceptDateProposal(proposalId: string): Promise<TimeResult> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const db = createServiceClient()
  const { error } = await db.rpc('accept_date_proposal', {
    p_proposal_id: proposalId,
    p_by_id: user.id,
  })

  if (error) {
    if (error.message.includes('cannot accept own proposal')) return { ok: false, error: '내가 보낸 제안은 직접 수락할 수 없어요.' }
    if (error.message.includes('no pending date proposal')) return { ok: false, error: '이미 처리된 제안이에요.' }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
