// settleCampaign — IMPLEMENT-2-SETTLE.md
// 정산 완료 시 6단계를 순서대로 처리한다. 여러 화면에서 호출하는 공통 서버 액션.
'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { grantCredits } from '@/lib/credits/ledger'

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
  const now = new Date()

  const { data: proposal, error: pErr } = await db
    .from('proposals')
    .select('id, advertiser_id, influencer_id, settled_at')
    .eq('id', proposalId)
    .single()
  if (pErr || !proposal) return { ok: false, error: '제안을 찾을 수 없어요.' }
  if (proposal.settled_at) return { ok: false, error: '이미 정산 완료된 제안이에요.' }

  // ── 1. proposals.settled_at = now + contact_hidden_at = settled_at + 5일
  const settlePayload: Record<string, unknown> = {
    settled_at: now.toISOString(),
    contact_hidden_at: new Date(now.getTime() + 5 * 86400000).toISOString(),
  }
  if (opts?.backdatedReason) settlePayload.settled_backdated_reason = opts.backdatedReason
  if (opts?.withholding) {
    settlePayload.withholding_applied = opts.withholding.applied
    if (opts.withholding.gross != null) settlePayload.amount_gross = opts.withholding.gross
    if (opts.withholding.withheld != null) settlePayload.amount_withheld = opts.withholding.withheld
    if (opts.withholding.net != null) settlePayload.amount_net = opts.withholding.net
  }

  const { error: settleErr } = await db
    .from('proposals')
    .update(settlePayload)
    .eq('id', proposalId)
    .is('settled_at', null) // 동시 요청 방지
  if (settleErr) return { ok: false, error: settleErr.message }

  // ── 2. deal_checkpoints payment 완료 + late_days (유예 3일)
  const { data: payment } = await db
    .from('deal_checkpoints')
    .select('id, due_adjusted')
    .eq('proposal_id', proposalId)
    .eq('kind', 'payment')
    .is('completed_at', null)
    .maybeSingle()

  if (payment) {
    const due = payment.due_adjusted ? new Date(payment.due_adjusted) : null
    const lateDays = due
      ? Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000) - 3)
      : 0
    await db
      .from('deal_checkpoints')
      .update({ completed_at: now.toISOString(), late_days: lateDays })
      .eq('id', payment.id)
  }

  // ── 3. 양쪽 deal_complete 크레딧 +3,000 (제안당 1회 — 중복 방지)
  await Promise.all(
    [proposal.advertiser_id, proposal.influencer_id].map(async (userId) => {
      const { data: existing } = await db
        .from('credit_ledger')
        .select('id')
        .eq('user_id', userId)
        .eq('ref_id', proposalId)
        .eq('ref_type', 'proposal')
        .eq('reason_code', 'deal_complete')
        .maybeSingle()
      if (!existing) {
        await grantCredits(userId, 3000, 'reward', 'deal_complete', {
          refType: 'proposal',
          refId: proposalId,
          memo: '정산 완료 크레딧',
        })
      }
    }),
  )

  // ── 4. trust_score — VIEW이므로 자동 갱신, no-op

  // ── 5. 상호 평가 요청 즉시 알림 + D+3 리마인드 / D+7 마감 예약
  const group = `review:${proposalId}`
  const reviewLink = `/advertiser/campaigns`

  await db.from('notifications').insert([
    {
      user_id: proposal.advertiser_id,
      kind: 'review_request',
      title: '상대방을 평가해주세요',
      body: '7일 이내 평가 시 크레딧 1,000C가 지급됩니다.',
      link: reviewLink,
      ref_type: 'proposal',
      ref_id: proposalId,
      state: 'unread',
      notification_group: group,
    },
    {
      user_id: proposal.influencer_id,
      kind: 'review_request',
      title: '상대방을 평가해주세요',
      body: '7일 이내 평가 시 크레딧 1,000C가 지급됩니다.',
      link: reviewLink,
      ref_type: 'proposal',
      ref_id: proposalId,
      state: 'unread',
      notification_group: group,
    },
  ])

  const d3 = new Date(now.getTime() + 3 * 86400000)
  const d7 = new Date(now.getTime() + 7 * 86400000)

  await db.from('notification_schedules').insert(
    [proposal.advertiser_id, proposal.influencer_id].flatMap((userId) => [
      {
        notification_group: group,
        user_id: userId,
        ref_type: 'proposal',
        ref_id: proposalId,
        kind: 'review_reminder',
        title: '아직 평가를 완료하지 않으셨어요',
        body: '4일 후 평가 기간이 마감됩니다.',
        link: reviewLink,
        send_at: d3.toISOString(),
      },
      {
        notification_group: group,
        user_id: userId,
        ref_type: 'proposal',
        ref_id: proposalId,
        kind: 'review_deadline',
        title: '오늘이 평가 마감일이에요',
        body: '오늘 자정까지 평가하지 않으면 크레딧이 지급되지 않아요.',
        link: reviewLink,
        send_at: d7.toISOString(),
      },
    ]),
  )

  // ── 6. contact_hidden_at은 1단계에서 proposals에 이미 설정됨

  return { ok: true }
}
