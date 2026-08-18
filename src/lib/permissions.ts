// 대화 담당자 권한 (IMPLEMENT-6-DELTA.md A5)
//
// ⚠️ 지금은 광고주 계정당 실제 로그인 사용자가 1명뿐이라(팀원이 별도 세션으로 로그인해
// 같은 계정에 접근하는 기능이 없음 — D5 team_members는 명단 관리 UI만 있고 권한 전파는
// 범위 밖이었음), 이 함수들은 "담당자가 아니면 관여 못 한다"를 지금 실제로 강제할 대상이
// 없다. 다만 규칙 자체는 여기 정의해두고, 대화 컴포넌트가 이 판정을 사용하도록 배선은
// 지금 해둔다 — 팀원 로그인이 생기면 코드를 안 고쳐도 된다.

export type ConversationPermission = {
  canSend: boolean
  isOwner: boolean
  isManager: boolean
  actingAsProxy: boolean
}

export function checkConversationPermission(params: {
  currentUserId: string
  ownerId: string
  managerId: string | null
}): ConversationPermission {
  const { currentUserId, ownerId, managerId } = params
  const isOwner = currentUserId === ownerId
  const isManager = managerId != null && currentUserId === managerId
  // 담당자가 아직 없으면(신규 대화) 누구나 보낼 수 있다 — 그 첫 메시지를 보낸 사람이
  // 담당자로 지정된다(호출 쪽에서 처리).
  const noManagerYet = managerId == null
  const canSend = isManager || isOwner || noManagerYet
  // 대표가 "담당자 아닌 대화"에 보내는 경우만 대리 발송
  const actingAsProxy = isOwner && !isManager && !noManagerYet
  return { canSend, isOwner, isManager, actingAsProxy }
}
