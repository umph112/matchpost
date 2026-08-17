'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type SettleResult = { ok: true } | { ok: false; error: string }

export interface SettleOptions {
  backdatedReason?: string
  withholding?: {
    applied: boolean
    gross?: number
    withheld?: number
    net?: number
  }
}

export async function settleCampaign(
  proposalId: string,
  opts?: SettleOptions,
): Promise<SettleResult> {
  // settle_campaign은 service_role 전용으로 잠겨 있어(0046) 여기서 먼저 소유권을 확인해야 한다.
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const { data: proposal } = await auth
    .from('proposals')
    .select('advertiser_id, influencer_id')
    .eq('id', proposalId)
    .maybeSingle()
  if (!proposal || proposal.advertiser_id !== user.id) {
    return { ok: false, error: '정산 권한이 없어요.' }
  }

  const db = createServiceClient()

  const { error } = await db.rpc('settle_campaign', {
    p_proposal_id:      proposalId,
    p_backdated_reason: opts?.backdatedReason ?? null,
    p_withholding:      opts?.withholding?.applied ?? null,
    p_amount_gross:     opts?.withholding?.gross ?? null,
    p_amount_withheld:  opts?.withholding?.withheld ?? null,
    p_amount_net:       opts?.withholding?.net ?? null,
  })

  if (error) {
    if (error.message.includes('already settled')) return { ok: false, error: '이미 정산 완료된 제안이에요.' }
    if (error.message.includes('not found'))       return { ok: false, error: '제안을 찾을 수 없어요.' }
    return { ok: false, error: error.message }
  }

  // 협업 완료 → 친구등록(collab). 이미 맺어진 사이면 register_connection 내부에서 그대로 둔다.
  // ⚠️ best-effort: 등록이 실패해도 정산 결과를 깨뜨리지 않는다. collab 은 상대에게 알리지 않는다.
  if (proposal.influencer_id) {
    try {
      await db.rpc('register_connection', {
        p_by_id:    proposal.advertiser_id,
        p_other_id: proposal.influencer_id,
        p_source:   'collab',
        p_notify:   false,
      })
    } catch {
      // 무시 — 정산은 이미 성공했다.
    }
  }

  return { ok: true }
}

export async function requestTaxDocs(campaignId: string): Promise<SettleResult> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const { data: campaign } = await auth
    .from('campaigns')
    .select('advertiser_id')
    .eq('id', campaignId)
    .maybeSingle()
  if (!campaign || campaign.advertiser_id !== user.id) {
    return { ok: false, error: '요청 권한이 없어요.' }
  }

  const db = createServiceClient()
  const { error } = await db.rpc('request_tax_docs', {
    p_campaign_id: campaignId,
    p_by_id: user.id,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function resolveSettlementDispute(campaignId: string, note?: string): Promise<SettleResult> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const { data: campaign } = await auth
    .from('campaigns')
    .select('advertiser_id')
    .eq('id', campaignId)
    .maybeSingle()
  if (!campaign || campaign.advertiser_id !== user.id) {
    return { ok: false, error: '처리 권한이 없어요.' }
  }

  const db = createServiceClient()
  const { error } = await db.rpc('resolve_settlement_dispute', {
    p_campaign_id: campaignId,
    p_by_id: user.id,
    p_note: note?.trim() || null,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function reSettleCampaign(proposalId: string): Promise<SettleResult> {
  // re_settle_campaign도 service_role 전용으로 잠겨 있어(0048) 여기서 먼저 소유권을 확인한다.
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const { data: proposal } = await auth
    .from('proposals')
    .select('advertiser_id')
    .eq('id', proposalId)
    .maybeSingle()
  if (!proposal || proposal.advertiser_id !== user.id) {
    return { ok: false, error: '재정산 권한이 없어요.' }
  }

  const db = createServiceClient()
  const { error } = await db.rpc('re_settle_campaign', { p_proposal_id: proposalId })

  if (error) {
    if (error.message.includes('not settled yet'))       return { ok: false, error: '아직 정산 기록이 없어요.' }
    if (error.message.includes('no dispute to resolve')) return { ok: false, error: '재정산이 필요한 상태가 아니에요.' }
    if (error.message.includes('not found'))             return { ok: false, error: '제안을 찾을 수 없어요.' }
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
