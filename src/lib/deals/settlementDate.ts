// D20 §2-1 — 매출 시점 · 미수 판정 · 지연 알림이 전부 이 함수를 지난다.
// 사람별 합의(proposals.settlement_date)가 캠페인 기본값(campaigns.settlement_date)을 덮는다.
// D9 「기본 일정 + 사람별 변경」과 같은 구조.
//
// ⚠️ campaigns.settlement_date 를 직접 읽어 "매출/미수/지연"을 판정하는 곳이 하나라도
//    남으면 그 화면만 옛 날짜를 본다. 반드시 이 함수를 지나게 한다.
//    (팀 휴가/인수인계처럼 "캠페인 일정"을 캠페인 grain 으로 보여주는 곳은 대상이 아니다.)
export function settlementDateOf(
  p: { settlement_date?: string | null },
  c: { settlement_date?: string | null } | null | undefined,
): string | null {
  return p.settlement_date ?? c?.settlement_date ?? null
}

// 사람별 합의 날짜가 캠페인 기본값과 달라 "(변경)" 파란 표시를 붙여야 하는지(D20 §4 · D9 §3).
export function isSettlementDateChanged(
  p: { settlement_date?: string | null },
): boolean {
  return !!p.settlement_date
}
