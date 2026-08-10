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

// D7 4-4 — 목록(대화·알림 등)용 상대 날짜 표기. 오늘=시각 / 어제=「어제」 / 올해=M/D / 그 전=YYYY. M/D
export function listDateLabel(iso: string | null | undefined): string {
  if (!iso) return ''
  const target = new Date(iso)
  const targetDateStr = kstDateString(target)
  const todayStr = kstDateString()
  if (targetDateStr === todayStr) {
    return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit', hour12: true }).format(target)
  }
  const yesterday = new Date(kstToday())
  yesterday.setDate(yesterday.getDate() - 1)
  if (targetDateStr === kstDateString(yesterday)) return '어제'

  const [ty, tm, td] = targetDateStr.split('-').map(Number)
  const [cy] = todayStr.split('-').map(Number)
  return ty === cy ? `${tm}/${String(td).padStart(2, '0')}` : `${ty}. ${tm}/${String(td).padStart(2, '0')}`
}
