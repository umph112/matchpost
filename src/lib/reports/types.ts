// 신고 유형 목록 — 화면(선택지)과 서버액션(검증)이 함께 쓰는 값이다.
//
// ⚠️ 이 값을 'use server' 파일에 두면 안 된다.
// 이유는 src/lib/cancellations/reasons.ts 주석과 같다 — 상수 하나가
// 그 파일이 섞인 페이지의 서버액션 번들을 통째로 죽인다.
// (이 상수 때문에 대화 헤더 「문제 신고」와 관리자 신고 처리가 같이 죽어 있었다)
export const REPORT_TYPES = [
  'unpaid', 'cancel_unilateral', 'guide_mismatch_req',
  'draft_late', 'guide_violation', 'no_show',
  'abuse', 'etc',
] as const
export type ReportType = (typeof REPORT_TYPES)[number]
