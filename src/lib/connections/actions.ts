'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type ConnectionResult = { ok: true; id?: string } | { ok: false; error: string }

export async function proposeConnection(otherId: string): Promise<ConnectionResult> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const db = createServiceClient()
  const { data, error } = await db.rpc('propose_connection', {
    p_by_id: user.id,
    p_other_id: otherId,
  })

  if (error) {
    if (error.message.includes('no settled collaboration')) {
      return { ok: false, error: '함께 정산 완료한 협업이 있어야 등록을 제안할 수 있어요.' }
    }
    return { ok: false, error: error.message }
  }
  return { ok: true, id: data as string }
}

// 친구등록(D12): 양쪽 승낙 없이 즉시 성립. source = manual(광고주 직접) | collab(정산 완료) | invite(예약, 미배선).
// manual 만 상대에게 알림. 이미 맺어진 사이면 source 를 덮지 않는다(register_connection 내부 on conflict do nothing).
export async function registerConnection(
  otherId: string,
  source: 'manual' | 'collab' = 'manual',
): Promise<ConnectionResult> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const db = createServiceClient()
  const { data, error } = await db.rpc('register_connection', {
    p_by_id: user.id,
    p_other_id: otherId,
    p_source: source,
    p_notify: source === 'manual',
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, id: data as string }
}

// 친구등록 해제 — 관계 행 삭제. ⚠️ 상대(광고주)에게 알리지 않는다(알리면 해제를 못 함).
export async function unregisterConnection(otherId: string): Promise<ConnectionResult> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const db = createServiceClient()
  // a_id < b_id 정규화로 행을 찾아 삭제.
  const a = user.id < otherId ? user.id : otherId
  const b = user.id < otherId ? otherId : user.id
  const { error } = await db.from('connections').delete().eq('a_id', a).eq('b_id', b)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function respondConnection(connectionId: string, accept: boolean): Promise<ConnectionResult> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const db = createServiceClient()
  const { error } = await db.rpc('respond_connection', {
    p_connection_id: connectionId,
    p_by_id: user.id,
    p_accept: accept,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function revokeConnection(connectionId: string): Promise<ConnectionResult> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const db = createServiceClient()
  const { error } = await db.rpc('revoke_connection', {
    p_connection_id: connectionId,
    p_by_id: user.id,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
