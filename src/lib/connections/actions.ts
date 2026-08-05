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
