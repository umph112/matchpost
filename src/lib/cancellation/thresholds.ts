// 취소 누적에 따른 안내/공개 표시 단계 — 이 파일이 유일한 원본이다.
//
// ⚠️ profiles.cancellation_count 는 "횟수"가 아니라 "점수"다.
//    request_cancellation() 이 가이드 단계 이후의 취소에는 +2, 그 전이면 +1 을 더한다.
//    (sql/migrations/0069, 0093)
//    그래서 아래 임계값도 회수가 아니라 점수다. 광고주 public = 6점은 가이드 이후 취소
//    3건이다. 여기를 회수로 착각해 낮추면 2건 만에 낙인이 찍힌다.
//
// ⚠️ 화면에 숫자를 노출하지 않는다. 점수를 그대로 보여주는 곳은 관리자 화면뿐이다
//    — 거기서는 판단의 근거가 필요하다.

export type Role = 'influencer' | 'advertiser'

// ⚠️ 이 파일이 유일한 원본이다. 화면에서 숫자를 다시 쓰지 않는다.
//
// 인플루언서와 광고주를 가른 이유 — 취소로 잃는 것이 다르다. 인플루언서가 취소하면
// 광고주는 다른 사람을 찾으면 되지만, 광고주가 취소하면 인플루언서는 그 날짜를 비워둔 채
// 기회를 잃는다. 광고주 취소는 참여자 전원에게 동시에 번지기도 한다.
const T = {
  influencer: { notify: 6, public: 12 },
  advertiser: { notify: 4, public: 6 },
} as const

// sql/migrations/0092 의 interval '60 days' 와 같은 값이어야 한다. 한쪽만 고치지 말 것.
export const RESET_DAYS = 60

export type CancelStage = 'none' | 'notify' | 'public'

export function cancelStage(role: Role, count: number): CancelStage {
  const t = T[role]
  if (count >= t.public) return 'public'
  if (count >= t.notify) return 'notify'
  return 'none'
}

// 본인 화면 안내 문구. 숫자를 넣지 않는다.
export function cancelNotice(role: Role, count: number): string | null {
  const s = cancelStage(role, count)
  if (s === 'none') return null
  if (s === 'notify') return '최근 취소 요청이 잦아요. 계속되면 프로필에 표시됩니다.'
  return `취소 요청이 잦아 프로필에 표시되고 있어요. ${RESET_DAYS}일 동안 취소가 없으면 사라집니다.`
}
