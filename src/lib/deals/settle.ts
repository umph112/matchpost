'use server'

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

  return { ok: true }
}
