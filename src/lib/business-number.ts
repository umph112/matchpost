// 사업자등록번호 유틸 — PROMPT-8
//
// 저장은 항상 숫자 10자리로 통일한다. '123-45-67890'과 '1234567890'이 서로 다른 값으로
// 들어가면 중복 검사가 무의미해지기 때문. 화면에는 formatBizNo로 하이픈을 넣어 보여준다.

/** 하이픈·공백 등 비숫자 제거 후 최대 10자리로 자른다. 저장·비교는 언제나 이 값 기준. */
export function normalizeBizNo(v: string | null | undefined): string {
  return (v ?? '').replace(/\D/g, '').slice(0, 10)
}

/** 3-2-5 형태로 하이픈을 넣어 표시한다. 10자리 미만이면 들어온 만큼만 포맷. */
export function formatBizNo(v: string | null | undefined): string {
  const d = normalizeBizNo(v)
  if (d.length <= 3) return d
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
}

/**
 * 국세청 사업자등록번호 체크섬 검증.
 *   가중치 [1,3,7,1,3,7,1,3,5]를 앞 9자리에 각각 곱해 합산
 *   + 9번째 자리(index 8) × 5 를 10으로 나눈 몫을 더함
 *   (10 - 합계 % 10) % 10 === 10번째 자리(index 9) 이면 유효.
 * 아무 10자리나 통과하지 않는다.
 */
export function isValidBizNo(v: string | null | undefined): boolean {
  const d = normalizeBizNo(v)
  if (d.length !== 10) return false
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5]
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * weights[i]
  sum += Math.floor((Number(d[8]) * 5) / 10)
  const check = (10 - (sum % 10)) % 10
  return check === Number(d[9])
}
