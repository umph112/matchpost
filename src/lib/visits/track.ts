// 방문 기록 서버 액션 — user_visit_log 적재 + profiles.last_visited_at 갱신 + comeback 보상.
// 세션에서 파생된 userId만 받는다(클라이언트 입력값 신뢰 금지).
import { createServiceClient } from '@/lib/supabase/service'
import { grantCredits } from '@/lib/credits/ledger'

export async function recordVisit(userId: string): Promise<void> {
  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('last_visited_at')
    .eq('id', userId)
    .maybeSingle()

  const lastVisitedAt = profile?.last_visited_at ? new Date(profile.last_visited_at) : null
  const isComeback = lastVisitedAt !== null && Date.now() - lastVisitedAt.getTime() > 30 * 24 * 60 * 60 * 1000

  const today = new Date().toISOString().slice(0, 10)
  await supabase.from('user_visit_log').upsert(
    { user_id: userId, visited_on: today },
    { onConflict: 'user_id,visited_on', ignoreDuplicates: true }
  )

  await supabase.from('profiles').update({ last_visited_at: new Date().toISOString() }).eq('id', userId)

  if (isComeback) {
    try {
      await grantCredits(userId, 1000, 'reward', 'comeback', { memo: '복귀 크레딧' })
    } catch {
      // 이미 지급된 케이스 등은 조용히 무시 — 방문 기록 자체를 막지 않는다
    }
  }
}
