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

// D8 3 — 대화·알림 목록용 상대 시각. listDateLabel과 동일 규칙(오늘=시각 / 어제 / 올해=M/D / 그 전=YYYY. M/D).
export function listTime(iso: string | null | undefined): string {
  return listDateLabel(iso)
}

// D8 3 — 일정 표기용 「8/26 (수)」. 날짜만(YYYY-MM-DD)이면 그대로, 타임스탬프면 KST 달력일로 환산.
const DOW_KO = ['일', '월', '화', '수', '목', '금', '토']
export function dateWithDow(value: string | null | undefined): string {
  if (!value) return ''
  const ymd = value.length === 10 ? value : kstDateString(new Date(value))
  const [, m, d] = ymd.split('-').map(Number)
  const dow = DOW_KO[new Date(ymd + 'T00:00:00').getDay()]
  return `${m}/${d} (${dow})`
}

// D29 2-3 — 기간 오픈 표기. 하루면 「8/28 (금)」, 여러 날이면 「8/28 (금) – 8/29 (토)」.
// date_end 는 비어 있을 수도, date 와 같을 수도 있다(등록 폼이 「비우면 하루」라서).
// 두 경우 모두 하루로 본다 — 「8/28 (금) – 8/28 (금)」은 사람이 읽을 말이 아니다.
export function dateRangeWithDow(start: string | null | undefined, end?: string | null): string {
  const a = dateWithDow(start)
  if (!end || !start || end === start) return a
  return `${a} – ${dateWithDow(end)}`
}

// D29 2-3 — 달력이 기간 오픈을 시작~끝 전체에 그리게 하려면 걸친 날을 다 펴야 한다.
// 시작일에만 뜨면 광고주가 중간 날짜를 보다가 놓친다.
// clipFrom·clipTo 는 보고 있는 달 밖으로 새는 것을 막는다(지난달에 시작한 오픈도 들어온다).
export function eachDay(
  start: string | null | undefined,
  end?: string | null,
  clipFrom?: string,
  clipTo?: string,
): string[] {
  if (!start) return []
  let from = start
  let to = end && end > start ? end : start
  if (clipFrom && from < clipFrom) from = clipFrom
  if (clipTo && to > clipTo) to = clipTo
  if (from > to) return []

  const out: string[] = []
  const cur = new Date(from + 'T00:00:00')
  const last = new Date(to + 'T00:00:00')
  // 366일에서 끊는다. 종료일이 잘못 들어와도 무한 루프로 화면이 멈추지는 않게.
  for (let i = 0; cur <= last && i < 366; i++) {
    out.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`,
    )
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

// D20 §3 — 「8월 20일」 형태. 결제일 제안 모달의 "지금 X이에요"·카드 부제용.
// 날짜만(YYYY-MM-DD)이면 그대로, 타임스탬프면 KST 달력일로 환산.
export function monthDayKo(value: string | null | undefined): string {
  if (!value) return ''
  const ymd = value.length === 10 ? value : kstDateString(new Date(value))
  const [, m, d] = ymd.split('-').map(Number)
  return `${m}월 ${d}일`
}
