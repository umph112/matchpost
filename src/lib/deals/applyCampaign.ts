'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type ApplyCampaignResult =
  | { ok: true; proposalId: string }
  | { ok: false; error: string }

// D32 1절 — 캠페인 지원. sendDash 와 짝이지만 방향이 반대다.
// 여기서는 로그인한 사람이 인플루언서고, 광고주는 캠페인에서 읽는다(넘겨받지 않는다 —
// 넘겨받으면 남의 캠페인에 남을 태울 수 있다).
export async function applyToCampaign(input: {
  campaignId: string
  message?: string | null
  date?: string | null // YYYY-MM-DD, 지역 캠페인만 필요
}): Promise<ApplyCampaignResult> {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const db = createServiceClient()
  const { data, error } = await db.rpc('apply_to_campaign', {
    p_influencer_id: user.id,
    p_campaign_id: input.campaignId,
    p_message: input.message?.trim() || null,
    p_date: input.date || null,
  })

  // 막는 조건(모집 종료·중복 지원·날짜 불일치)은 전부 함수가 한국어 문구로 올린다.
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: '지원에 실패했어요.' }
  return { ok: true, proposalId: data as string }
}
