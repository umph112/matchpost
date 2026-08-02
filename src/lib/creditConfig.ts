// 크레딧 금액·표시 설정 — IMPLEMENT-1-SCHEMA.md 1번(크레딧 원장) 기준.
// 실제 지급/차감 로직은 sql/migrations/0018_credit_ledger.sql의 트리거·함수에 있다.
// 여기 있는 amount는 화면/문서용 참고값이며 서버 함수의 인자로 그대로 전달된다.
export const CREDIT_AMOUNTS = {
  WELCOME:            30_000,  // 가입 환영 (양쪽, 첫 로그인 1회)
  PROFILE_COMPLETE:    3_000,  // 프로필 완성 (양쪽, 계정당 1회)
  FIRST_ACTION:        3_000,  // 첫 오픈/첫 캠페인 (양쪽, 계정당 1회)
  ENCOURAGE:             500,  // 오픈·캠페인 열 때마다 (양쪽)
  CELEBRATE:           2_000,  // 협업 성사 (양쪽)
  DEAL_COMPLETE:       3_000,  // 정산 완료 (양쪽 모두)
  REVIEW:              1_000,  // 종료 후 7일 이내 리뷰 작성 (양쪽)
  INVITE:              5_000,  // 초대 — 피초대자 첫 활동 완료 시 (초대자)
  VISIT_WEEKLY:          500,  // 주 5일 이상 방문 (양쪽)
  VISIT_MONTHLY:       2_000,  // 월 20일 이상 방문 (양쪽)
  COMEBACK:            1_000,  // 30일 공백 후 복귀 1회 (양쪽)

  OPEN_SCHEDULE:       1_000,  // 오픈 등록 (차감, 인플루언서)
  CREATE_CAMPAIGN:     5_000,  // 캠페인 등록 (차감, 광고주)
  SEND_PROPOSAL:         500,  // 대시 발송 (차감, 광고주)
  UNLOCK_PROFILE:      1_000,  // 프로필 상세 열람 (차감, 광고주) — 기능 미구현, 금액만 확정

  DORMANT_14:            500,  // 휴면 14일 (1회)
  DORMANT_30:          1_000,  // 휴면 30일 이후 (30일마다 반복)
} as const

export const CREDIT_ACTION_LABELS: Record<string, string> = {
  welcome:          '가입 환영 크레딧',
  profile_complete: '프로필 완성 크레딧',
  first_action:     '첫 활동 크레딧',
  encourage:        '응원 크레딧',
  celebrate:        '협업 성사 축하 크레딧',
  deal_complete:    '정산 완료 크레딧',
  review:           '리뷰 작성 크레딧',
  invite:           '초대 크레딧',
  visit_weekly:     '주간 방문 크레딧',
  visit_monthly:    '월간 방문 크레딧',
  comeback:         '복귀 크레딧',

  open_schedule:    '오픈 등록',
  create_campaign:  '캠페인 등록',
  send_proposal:    '대시 발송',
  unlock_profile:   '프로필 열람',

  dormant_14:       '휴면 차감 (14일)',
  dormant_30:       '휴면 차감 (30일)',

  admin_grant:      '관리자 지급',
  admin_deduct:     '관리자 차감',
  migration:        '이전 시스템 잔액 이관',
}

export type CreditReasonCode = keyof typeof CREDIT_ACTION_LABELS
