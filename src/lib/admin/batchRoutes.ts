// D26 6-1절 — 자동 배치가 13개 있는데 관리자 화면에 하나도 없었다.
//
// 「시스템 현황」 칸(9-3 네 번째)은 원래 "배치 실패 건수"를 띄우기로 돼 있었다. 그런데
// 배치 실행 결과를 남기는 테이블이 레포에 없다 — 라우트들은 RPC를 부르고 결과를 응답으로만
// 돌려주고 끝난다. 그래서 "실패 N건"은 지금 산출할 원본이 없다.
//
// 대신 **지금 코드로 실제 산출되는 위험** 하나를 띄운다: vercel.json 크론에 등록되지 않아
// 아무도 부르지 않는 배치. 이건 조용히 나쁘다 — 예를 들어 cancellation-count-reset 이 안 돌면
// 취소 누적 3회에 닿은 사람이 영구히 제한된 채로 남는다.
//
// ⚠️ 배치를 새로 만들면 BATCH_ROUTES 에 한 줄 추가한다. 여기 없으면 감시 대상에서 빠진다.

import vercel from '../../../vercel.json'

export type BatchRoute = {
  /** vercel.json 의 path 와 같은 형식(/api/...) */
  path: string
  label: string
  /** 안 돌면 무엇이 막히는지 — 관리자가 급한지 판단하는 근거 */
  risk: string
}

export const BATCH_ROUTES: BatchRoute[] = [
  { path: '/api/cron/blog-analytics', label: '블로그 수집', risk: '인플루언서 등급·리포트가 갱신되지 않음' },
  { path: '/api/cron/purge-attachments', label: '첨부 7일 삭제', risk: '지난 첨부가 계속 남음' },
  { path: '/api/admin/batch/payment-reminders', label: '정산 지연 알림', risk: '미수 알림이 나가지 않음' },
  { path: '/api/admin/batch/settlement-reminder', label: '정산 예정일 알림', risk: '예정일 안내가 나가지 않음' },
  { path: '/api/admin/batch/dormant-decay', label: '휴면 처리', risk: '60일 규칙이 적용되지 않음' },
  { path: '/api/admin/batch/comeback', label: '복귀 처리', risk: '돌아온 계정이 휴면인 채로 남음' },
  { path: '/api/admin/batch/trust-score-recalc', label: '신뢰 점수 재계산', risk: '제재 판정 근거가 옛 값' },
  { path: '/api/admin/batch/visit-weekly', label: '방문 집계(주)', risk: '지표 화면의 주간 값이 멈춤' },
  { path: '/api/admin/batch/visit-monthly', label: '방문 집계(월)', risk: '지표 화면의 월간 값이 멈춤' },
  { path: '/api/admin/batch/report-autoclose', label: '신고 자동 종결', risk: '종결 조건을 넘긴 신고가 계속 열려 있음' },
  { path: '/api/admin/batch/sanction-recalc', label: '제재 단계 재계산', risk: '제재 단계가 옛 지연율에 머무름' },
  { path: '/api/admin/batch/cancellation-autoconfirm', label: '취소 자동 확정', risk: '취소 요청이 확정되지 않고 쌓임' },
  { path: '/api/admin/batch/cancellation-count-reset', label: '취소 누적 초기화', risk: '3회에 닿은 계정이 영구히 제한됨' },
]

/** vercel.json 에 등록돼 실제로 도는 배치 경로. */
export function registeredCronPaths(): Set<string> {
  const crons = (vercel as { crons?: { path: string }[] }).crons ?? []
  return new Set(crons.map((c) => c.path))
}

/** 코드에는 있는데 크론에 없는 배치 — 아무도 부르지 않는다. */
export function unregisteredBatches(): BatchRoute[] {
  const registered = registeredCronPaths()
  return BATCH_ROUTES.filter((b) => !registered.has(b.path))
}
