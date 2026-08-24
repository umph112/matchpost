// 취소 사유 목록 — 화면(선택지)과 서버액션(검증)이 함께 쓰는 값이다.
//
// ⚠️ 이 값을 'use server' 파일에 두면 안 된다.
// Next 16 은 'use server' 파일이 async 함수 외의 것을 export 하면
// 「A "use server" file can only export async functions, found object」로
// 모듈 평가 자체를 실패시킨다. 그러면 그 파일이 섞인 페이지의 서버액션 번들이
// 통째로 죽는다 — 다른 파일에 있는 액션까지 같이 500 이 된다.
// (D23 실측: 이 상수 하나 때문에 대화 화면의 진행일 수락 · 결제일 제안 ·
//  협업 시간 설정 · 취소 수락/철회 · 문제 신고가 전부 죽어 있었다)
export const CANCEL_REASONS = ['개인 사정', '일정 중복', '조건 불일치', '건강 문제', '기타'] as const
export type CancelReason = (typeof CANCEL_REASONS)[number]
