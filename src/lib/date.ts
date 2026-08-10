// D6 C7 — 광고주·인플루언서·관리자 세 콘솔이 같은 "오늘"을 쓰게 하는 단일 원본.
// 서버는 UTC로 돌아도 사용자는 KST를 보므로, 달력의 달·D-day·상단바 기간을 전부 여기서 파생시킨다.

export function kstToday(): Date {
  const kstString = new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
  return new Date(kstString)
}

export function kstDateString(d: Date = kstToday()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d)
}

export function dDay(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T00:00:00')
  const today = new Date(kstDateString() + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

export function dDayLabel(dateStr: string | null | undefined): string {
  const d = dDay(dateStr)
  if (d === null) return '-'
  if (d === 0) return 'D-day'
  return d > 0 ? `D-${d}` : `D+${Math.abs(d)}`
}
