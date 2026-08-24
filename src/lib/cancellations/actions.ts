'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// 상수도 타입도 ./reasons 에 있다 — 'use server' 파일은 async 함수만 export 할 수 있다(이유는 그 파일 주석).
// ⚠️ 여기서 `export type { CancelReason }` 로 되넘기는 것도 안 된다. Next 16 의 'use server'
// 변환은 타입 재export 를 지우지 않고 런타임 re-export 로 내보내서
// 「ReferenceError: CancelReason is not defined」로 번들이 똑같이 죽는다(D23 실측).
// 쓰는 쪽은 '@/lib/cancellations/reasons' 에서 직접 가져올 것.
import type { CancelReason } from './reasons'

export type CancelResult = { ok: true; id: string } | { ok: false; error: string }

export async function requestCancellation(
  proposalId: string,
  reason: CancelReason,
  message?: string,
): Promise<CancelResult> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const db = createServiceClient()
  const { data, error } = await db.rpc('request_cancellation', {
    p_proposal_id: proposalId,
    p_by_id: user.id,
    p_reason: reason,
    p_message: message?.trim() || null,
  })

  if (error) {
    if (error.message.includes('cannot cancel after publish')) return { ok: false, error: '게재 이후에는 취소할 수 없어요.' }
    if (error.message.includes('already in progress'))         return { ok: false, error: '이미 진행 중인 취소 요청이 있어요.' }
    if (error.message.includes('not a party'))                 return { ok: false, error: '해당 협업의 당사자만 취소를 요청할 수 있어요.' }
    return { ok: false, error: error.message }
  }
  return { ok: true, id: data as string }
}

export async function acceptCancellation(cancellationId: string): Promise<CancelResult> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const db = createServiceClient()
  const { error } = await db.rpc('accept_cancellation', {
    p_cancellation_id: cancellationId,
    p_acceptor_id: user.id,
  })

  if (error) {
    if (error.message.includes('requester cannot accept')) return { ok: false, error: '본인이 요청한 취소는 직접 수락할 수 없어요.' }
    if (error.message.includes('not found'))                return { ok: false, error: '이미 처리됐어요.' }
    return { ok: false, error: error.message }
  }
  return { ok: true, id: cancellationId }
}

export async function withdrawCancellation(cancellationId: string): Promise<CancelResult> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const db = createServiceClient()
  const { error } = await db.rpc('withdraw_cancellation', {
    p_cancellation_id: cancellationId,
    p_by_id: user.id,
  })

  if (error) {
    if (error.message.includes('only the requester can withdraw')) return { ok: false, error: '본인이 요청한 취소만 철회할 수 있어요.' }
    if (error.message.includes('not found'))                        return { ok: false, error: '이미 처리됐어요.' }
    return { ok: false, error: error.message }
  }
  return { ok: true, id: cancellationId }
}
