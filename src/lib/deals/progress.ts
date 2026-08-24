'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveCompany } from '@/lib/team/company'
import { ALL_STAGES, stageOwnerOf } from '@/lib/campaign-stages'

// D29 PROMPT-2 — 딜시트의 진행 기록(단계·세무자료·정산상태)을 서버로 옮긴다.
//
// 왜: 브라우저에서 supabase.update() 를 쏘면 RLS 가 막아도 error 는 null 이고 행만 0개다.
//     if (!error) 로 성공 처리하던 코드가 화면만 넘기고 DB 는 그대로였다(findings 17).
//     서버액션은 ① 당사자를 직접 확인하고 ② 영향 행 수를 세서 0이면 에러를 돌려준다.
//
// 범위는 세 개뿐이다 — advanceStage · setTaxDocReceived · setSettlementStatus.
export type ProgressResult = { ok: true } | { ok: false; error: string }

const SETTLEMENT_VALUES = ['미정산', '정산중', '완료'] as const

type Party = { userId: string; role: 'advertiser' | 'influencer' }

// 당사자 확인 — 광고주는 그 협업의 회사 소속(대표 또는 활동중 팀원), 인플루언서는 그 협업 본인.
// 제안 줄은 service 로 읽는다: RLS 로 안 보이는 줄을 "없음"으로 오해해 엉뚱한 안내를 내지 않기 위해서다.
async function requireParty(
  proposalId: string,
): Promise<{ ok: true; party: Party; stage: string | null } | { ok: false; error: string }> {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요해요.' }

  const db = createServiceClient()
  const { data: proposal } = await db
    .from('proposals')
    .select('advertiser_id, influencer_id, stage')
    .eq('id', proposalId)
    .maybeSingle()
  if (!proposal) return { ok: false, error: '협업을 찾을 수 없어요.' }

  if (proposal.influencer_id === user.id) {
    return { ok: true, party: { userId: user.id, role: 'influencer' }, stage: proposal.stage }
  }
  const company = await resolveCompany(auth, user.id)
  if (proposal.advertiser_id === company.advertiserId) {
    return { ok: true, party: { userId: user.id, role: 'advertiser' }, stage: proposal.stage }
  }
  return { ok: false, error: '이 협업의 당사자가 아니에요.' }
}

// UPDATE 후 실제로 바뀐 행을 돌려받아 센다. 0이면 조용히 넘어가지 않고 에러를 만든다.
async function updateProposal(
  proposalId: string,
  patch: Record<string, unknown>,
): Promise<ProgressResult> {
  const db = createServiceClient()
  const { data, error } = await db.from('proposals').update(patch).eq('id', proposalId).select('id')
  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) return { ok: false, error: '기록되지 않았어요 — 새로고침 후 다시 시도해 주세요.' }
  return { ok: true }
}

// 단계 이동. 다음 단계 이름은 화면이 계산해 보내고(캠페인마다 켜진 단계가 달라서),
// 여기선 그 이름이 전체 단계 목록에 있는 값인지만 확인한다.
//
// D29 PROMPT-4 — 화면에서 버튼을 숨기는 것만으로는 못 막는다. 지금 단계의 담당자인지
// 여기서도 확인한다. 담당자 판정은 화면이 보내온 값이 아니라 DB 에 적힌 현재 단계로 한다
// (화면이 낡았을 수 있고, 낡은 화면 말을 믿으면 확인이 무의미해진다).
export async function advanceStage(proposalId: string, nextStage: string): Promise<ProgressResult> {
  if (!(ALL_STAGES as readonly string[]).includes(nextStage)) {
    return { ok: false, error: '알 수 없는 단계예요.' }
  }
  const gate = await requireParty(proposalId)
  if (!gate.ok) return gate

  const owner = stageOwnerOf(gate.stage)
  if (owner !== gate.party.role) {
    return {
      ok: false,
      error: owner === 'advertiser' ? '이 단계는 광고주가 넘겨요.' : '이 단계는 인플루언서가 넘겨요.',
    }
  }
  return updateProposal(proposalId, { stage: nextStage })
}

// 세무자료 — 내는 쪽(인플루언서)·받는 쪽(광고주) 둘 다 기록할 수 있다.
export async function setTaxDocReceived(proposalId: string, received: boolean): Promise<ProgressResult> {
  const gate = await requireParty(proposalId)
  if (!gate.ok) return gate
  return updateProposal(proposalId, { tax_doc_received: received })
}

// 정산 상태 — 돈을 보내는 쪽이 정한다. settled_at·paid_confirmed_at 은 여기서 건드리지 않는다.
export async function setSettlementStatus(proposalId: string, status: string): Promise<ProgressResult> {
  if (!(SETTLEMENT_VALUES as readonly string[]).includes(status)) {
    return { ok: false, error: '알 수 없는 정산 상태예요.' }
  }
  const gate = await requireParty(proposalId)
  if (!gate.ok) return gate
  if (gate.party.role !== 'advertiser') return { ok: false, error: '정산 상태는 광고주가 정해요.' }
  return updateProposal(proposalId, { settlement_status: status })
}
