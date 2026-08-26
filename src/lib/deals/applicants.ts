'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveCompany } from '@/lib/team/company'

// D32 2절 — 광고주가 지원자를 고른다.
//
// ⚠️ /api/deal/confirm 을 재사용하지 않는다.
//    그 길은 「양쪽이 각자 자기 칸을 켠다」는 토글이라, 이미 influencer_confirmed 가 켜진
//    지원 줄에 쓰면 광고주가 두 번 눌러 자기 확정을 도로 끄는 동작이 된다.
//    그리고 그 안에는 start_at 겹침 검사가 있다 — 같은 캠페인에 N명을 뽑는 자리에서
//    두 번째 확정부터 「앞사람과 겹친다」로 막힌다. 겹침은 인플루언서 자기 일정끼리 볼 일이지
//    같은 캠페인 참여자끼리 볼 일이 아니다. 그래서 여기서는 start_at 을 쓰지 않는다.
//
// 방식은 D29 진행기록과 같다 — 당사자를 서버에서 확인하고, UPDATE 후 바뀐 행을 세서
// 0이면 조용히 넘어가지 않고 에러를 만든다.
export type ApplicantResult = { ok: true } | { ok: false; error: string }

type Gate =
  | {
      ok: true
      proposal: {
        id: string
        influencer_id: string
        advertiser_confirmed: boolean
        status: string | null
        initiated_by: string | null
        campaign_id: string | null
      }
      campaignTitle: string
    }
  | { ok: false; error: string }

// 광고주 쪽 당사자 확인. 대표든 활동중 팀원이든 회사 캠페인이면 고를 수 있다(D14 6절과 같은 게이트).
// 제안 줄은 service 로 읽는다 — RLS 로 안 보이는 줄을 「없음」으로 오해해 엉뚱한 안내를 내지 않기 위해서다.
async function requireAdvertiser(proposalId: string): Promise<Gate> {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const db = createServiceClient()
  const { data: proposal } = await db
    .from('proposals')
    .select('id, advertiser_id, influencer_id, advertiser_confirmed, status, initiated_by, campaign_id')
    .eq('id', proposalId)
    .maybeSingle()
  if (!proposal) return { ok: false, error: '지원을 찾을 수 없어요.' }

  const company = await resolveCompany(auth, user.id)
  if (proposal.advertiser_id !== company.advertiserId) {
    return { ok: false, error: '이 캠페인의 광고주가 아니에요.' }
  }

  let campaignTitle = '캠페인'
  if (proposal.campaign_id) {
    const { data: c } = await db
      .from('campaigns')
      .select('title')
      .eq('id', proposal.campaign_id)
      .maybeSingle()
    campaignTitle = c?.title ?? campaignTitle
  }
  return { ok: true, proposal, campaignTitle }
}

// 확정. 지원은 인플루언서가 이미 「하겠다」고 한 것이라(influencer_confirmed=true, 0098)
// 여기서 광고주 칸만 켜면 그 순간 양쪽 확정이 되고, 축하 크레딧 트리거도 그때 돈다(0018).
export async function confirmApplicant(proposalId: string): Promise<ApplicantResult> {
  const gate = await requireAdvertiser(proposalId)
  if (!gate.ok) return gate
  const { proposal, campaignTitle } = gate

  if (proposal.status === 'rejected') return { ok: false, error: '반려한 지원이에요.' }
  if (proposal.advertiser_confirmed) return { ok: false, error: '이미 확정한 지원자예요.' }

  const db = createServiceClient()
  const { data, error } = await db
    .from('proposals')
    .update({ advertiser_confirmed: true, status: 'accepted' })
    .eq('id', proposalId)
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: '확정되지 않았어요 — 새로고침 후 다시 시도해 주세요.' }
  }

  // 확정 알림은 여기서 직접 넣는다.
  // (양쪽 확정 시 도는 레거시 트리거가 하나 있었지만 레포에 없고, 0099 로 그 근처를 정리하면서
  //  살아 있는지 확신할 수 없다. 지원자는 예/아니오를 기다리는 사람이라 확실한 쪽에 둔다.
  //  중복이 생기면 검증에서 잡힌다 — 30번 스펙이 새 알림 수를 센다.)
  await db.from('notifications').insert({
    user_id: proposal.influencer_id,
    type: 'deal_made',
    kind: 'deal_made',
    title: '캠페인 참여가 확정됐어요',
    body: `「${campaignTitle}」 참여가 확정됐어요. 진행 단계를 확인해 주세요.`,
    link: `/influencer/deals/${proposalId}`,
    ref_type: 'proposal',
    ref_id: proposalId,
    state: 'unread',
  })

  return { ok: true }
}

// 반려. 사유는 선택이다 — 안 적어도 반려된다.
// ⚠️ influencer_confirmed 는 건드리지 않는다. 확정 수는 두 칸이 모두 켜진 줄만 세므로
//    상태만 rejected 로 두면 카운트에서 저절로 빠진다. 지원자가 「하겠다」고 한 사실은 사실대로 남긴다.
export async function rejectApplicant(
  proposalId: string,
  reason?: string | null,
): Promise<ApplicantResult> {
  const gate = await requireAdvertiser(proposalId)
  if (!gate.ok) return gate
  const { proposal, campaignTitle } = gate

  if (proposal.advertiser_confirmed) {
    return { ok: false, error: '이미 확정한 지원자는 반려할 수 없어요. 취소로 처리해 주세요.' }
  }
  if (proposal.status === 'rejected') return { ok: false, error: '이미 반려한 지원이에요.' }

  const trimmed = (reason ?? '').trim()

  const db = createServiceClient()
  const { data, error } = await db
    .from('proposals')
    .update({ status: 'rejected', reject_reason: trimmed || null })
    .eq('id', proposalId)
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: '반려되지 않았어요 — 새로고침 후 다시 시도해 주세요.' }
  }

  await db.from('notifications').insert({
    user_id: proposal.influencer_id,
    type: 'campaign_rejected',
    kind: 'campaign_rejected',
    title: '아쉽게도 이번 캠페인은 함께하지 못하게 됐어요',
    body: trimmed
      ? `「${campaignTitle}」 — ${trimmed}`
      : `「${campaignTitle}」 지원 결과예요. 다음 기회에 만나요.`,
    link: '/influencer/proposals',
    ref_type: 'proposal',
    ref_id: proposalId,
    state: 'unread',
  })

  return { ok: true }
}

// 모집 마감. 모집 인원이 차도 자동으로 닫지 않는다 — 한 명 더 받고 싶은 경우가 있어서다.
// 닫으면 지원 함수(0100)가 새 지원을 막고, 검색 카드도 「모집 종료」로 바뀐다.
export async function closeRecruiting(campaignId: string): Promise<ApplicantResult> {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const db = createServiceClient()
  const { data: campaign } = await db
    .from('campaigns')
    .select('advertiser_id, recruit_closed_at')
    .eq('id', campaignId)
    .maybeSingle()
  if (!campaign) return { ok: false, error: '캠페인을 찾을 수 없어요.' }

  const company = await resolveCompany(auth, user.id)
  if (campaign.advertiser_id !== company.advertiserId) {
    return { ok: false, error: '이 캠페인의 광고주가 아니에요.' }
  }
  if (campaign.recruit_closed_at) return { ok: false, error: '이미 모집이 마감됐어요.' }

  const { data, error } = await db
    .from('campaigns')
    .update({ recruit_closed_at: new Date().toISOString() })
    .eq('id', campaignId)
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    return { ok: false, error: '마감되지 않았어요 — 새로고침 후 다시 시도해 주세요.' }
  }
  return { ok: true }
}
