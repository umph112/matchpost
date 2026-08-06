'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type TeamResult = { ok: true } | { ok: false; error: string }

// 초대는 다른 사람의 이메일(user_private)을 교차 조회해야 해서 service-role RPC를 거친다.
export async function inviteTeamMember(email: string, role: '담당자' | '관리자'): Promise<TeamResult> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const db = createServiceClient()
  const { error } = await db.rpc('invite_team_member', {
    p_owner_id: user.id,
    p_email: email.trim(),
    p_role: role,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// 역할 변경 / 재발송 / 활성-비활성 전환은 소유자 본인 행만 건드리므로 RLS로 충분해
// 인증된 클라이언트로 바로 처리한다(별도 서버 액션 없이 컴포넌트에서 supabase.from() 호출).
