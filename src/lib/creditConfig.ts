// 크레딧 금액 설정 — 향후 DB 테이블로 이관 예정 (현재는 코드 관리)
export const CREDIT_AMOUNTS = {
  WELCOME_ADVERTISER: 100_000,   // 광고주 가입 환영
  WELCOME_INFLUENCER:  50_000,   // 인플루언서 가입 환영
  CAMPAIGN_OPEN:        5_000,   // 캠페인 오픈 (차감)
  CAMPAIGN_MADE_BONUS: 10_000,   // 캠페인 메이드 보너스 (지급)
  SCHEDULE_OPEN:        1_000,   // 인플루언서 오픈 등록 (차감)
  DASH_SEND:              100,   // 대시 발송 (차감)
} as const

export const CREDIT_ACTION_LABELS: Record<string, string> = {
  welcome_advertiser:  '가입 환영 크레딧',
  welcome_influencer:  '가입 환영 크레딧',
  campaign_open:       '캠페인 오픈',
  campaign_made:       '캠페인 메이드 보너스',
  schedule_open:       '오픈 등록',
  dash_send:           '대시 발송',
  admin_grant:         '관리자 지급',
  admin_deduct:        '관리자 차감',
}

export type CreditAction = keyof typeof CREDIT_ACTION_LABELS
