// D6 D1 — 값의 원본은 카탈로그 하나. 화면 어디서도 금액을 직접 쓰지 않고 전부 여기서 읽는다.
// 실제 지급/차감 로직은 sql/migrations/0018_credit_ledger.sql 등의 트리거·함수에 있고,
// 여기 있는 amount는 화면 표시·서버 함수 인자 참고값이다(서버가 최종 권위).

export type CreditPolicyItem = {
  key: string
  label: string
  dir: 'grant' | 'charge'
  amount: number
  status: 'once' | 'active' | 'beta_free'
}

export const CREDIT_POLICY: CreditPolicyItem[] = [
  // 가입 축하는 역할별로 금액이 다르다(광고주 20,000 / 인플루언서 10,000).
  // 원장에는 reason_code='welcome'으로 남는다(과거 데이터 호환 — 아래 두 키는 지급 시점 금액 결정용).
  { key: 'signup_advertiser', label: '가입 축하(광고주)',        dir: 'grant',  amount: 20_000, status: 'once' },
  { key: 'signup_influencer', label: '가입 축하(인플루언서)',    dir: 'grant',  amount: 10_000, status: 'once' },
  { key: 'profile_complete', label: '프로필 완성',              dir: 'grant',  amount:  3_000, status: 'once' },
  { key: 'first_action',     label: '첫 오픈/첫 캠페인',         dir: 'grant',  amount:  3_000, status: 'once' },
  { key: 'encourage',        label: '응원 크레딧',               dir: 'grant',  amount:    500, status: 'active' },
  { key: 'celebrate',        label: '협업 성사 축하',            dir: 'grant',  amount:  2_000, status: 'active' },
  { key: 'deal_complete',    label: '협업 성사(정산 완료)',      dir: 'grant',  amount:  3_000, status: 'active' },
  { key: 'review',           label: '리뷰 작성',                dir: 'grant',  amount:  1_000, status: 'active' },
  { key: 'invite',           label: '친구 초대',                dir: 'grant',  amount:  5_000, status: 'active' },
  { key: 'visit_weekly',     label: '주간 방문',                dir: 'grant',  amount:    500, status: 'active' },
  { key: 'visit_monthly',    label: '월간 방문',                dir: 'grant',  amount:  2_000, status: 'active' },
  { key: 'comeback',         label: '오랜만에 돌아오기',         dir: 'grant',  amount:  1_000, status: 'active' },

  { key: 'open_schedule',    label: '오픈 등록',                dir: 'charge', amount:  1_000, status: 'active' },
  { key: 'create_campaign',  label: '캠페인 개설',              dir: 'charge', amount:  5_000, status: 'active' },
  { key: 'send_proposal',    label: '대시 보내기',              dir: 'charge', amount:    500, status: 'beta_free' },
  { key: 'unlock_profile',   label: '프로필 열람',              dir: 'charge', amount:  1_000, status: 'beta_free' },

  { key: 'dormant_14',       label: '휴면 차감(14일)',          dir: 'charge', amount:    500, status: 'active' },
  { key: 'dormant_30',       label: '휴면 차감(30일, 반복)',     dir: 'charge', amount:  1_000, status: 'active' },
]

const policyByKey = Object.fromEntries(CREDIT_POLICY.map((p) => [p.key, p]))

export function creditAmount(key: string): number {
  return policyByKey[key]?.amount ?? 0
}

export function creditLabel(key: string): string {
  return policyByKey[key]?.label ?? key
}

export function isBetaFree(key: string): boolean {
  return policyByKey[key]?.status === 'beta_free'
}

// 옛 코드 호환용 — 새로 쓸 땐 CREDIT_POLICY/creditAmount를 직접 쓴다.
export const CREDIT_AMOUNTS = Object.fromEntries(
  CREDIT_POLICY.map((p) => [p.key.toUpperCase(), p.amount])
) as Record<string, number>

export const CREDIT_ACTION_LABELS: Record<string, string> = {
  ...Object.fromEntries(CREDIT_POLICY.map((p) => [p.key, p.label])),
  welcome:      '가입 환영 크레딧', // 과거 원장 reason_code — signup_advertiser/influencer로 갈리기 전 값
  admin_grant:  '관리자 지급',
  admin_deduct: '관리자 차감',
  migration:    '이전 시스템 잔액 이관',
}

export function signupCreditAmount(role: 'advertiser' | 'influencer'): number {
  return creditAmount(role === 'advertiser' ? 'signup_advertiser' : 'signup_influencer')
}

export type CreditReasonCode = string
