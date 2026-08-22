// D25 §2 — "등록했는데 왜 아무것도 없지?"를 없애는 단일 원본.
//
// 블로그 분석은 등록 즉시 돌지 않는다. vercel.json 크론 `0 13 * * *`(UTC) = 매일 밤 10시(KST)에
// runBlogAnalyzerBatch()가 한 번 돌면서 그날치를 모은다. 그래서 채널을 등록한 사람은
// 최대 하루를 기다린다 — 그 사실을 등록한 그 자리와 분석 화면 양쪽에서 같은 문구로 알려준다.
//
// 시각 계산은 lib/date.ts와 같은 방식(Intl + Asia/Seoul)으로 맞춘다. KST는 서머타임이 없어
// 항상 UTC+9이므로 KST 22:00 == 같은 날 UTC 13:00 으로 환산해도 어긋나지 않는다.

import { monthDayKo } from '@/lib/date'

/** 배치가 도는 시각(KST 기준 시). vercel.json 크론과 반드시 같이 움직여야 한다. */
export const COLLECT_HOUR_KST = 22

/** 주어진 시각을 KST 달력일(YYYY-MM-DD)과 KST 시(0~23)로 분해한다. */
function kstParts(d: Date): { ymd: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return { ymd: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}

/** YYYY-MM-DD 에 일수를 더한다(월말·연말 넘어가도 안전하도록 UTC 기준 산술). */
function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * 다음 수집이 도는 실제 시각.
 * 밤 10시 전이면 오늘 밤 10시, 그 이후면 내일 밤 10시.
 * (정각 22:00은 이미 배치가 출발한 것으로 보고 내일로 넘긴다 — 없는 걸 있다고 하지 않기 위해)
 */
export function nextCollectAt(now: Date = new Date()): Date {
  const { ymd, hour } = kstParts(now)
  const targetYmd = hour < COLLECT_HOUR_KST ? ymd : addDays(ymd, 1)
  return new Date(`${targetYmd}T13:00:00Z`) // KST 22:00
}

/**
 * 첫 리포트 시점을 사람 말로. 「오늘 밤 10시」 / 「내일(8월 23일) 밤 10시」
 * 내일인 경우 날짜를 같이 붙이는 이유 — 밤늦게 등록한 사람에게 "내일"만 주면
 * 하루를 더 기다리는 건지 몇 시간만 기다리는 건지 알 수 없다.
 */
export function firstReportLabel(now: Date = new Date()): string {
  const { ymd, hour } = kstParts(now)
  if (hour < COLLECT_HOUR_KST) return '오늘 밤 10시'
  return `내일(${monthDayKo(addDays(ymd, 1))}) 밤 10시`
}
