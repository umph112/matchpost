'use client'

// D30 [1] — 관리자 「오늘」 트래픽. 탭 두 개다.
//
// ⚠️ 두 탭은 원본이 다르다. 합치거나 서로의 숫자로 대신하지 말 것.
//    · 시간대 = page_views  — 조회수(연인원). 매 조회마다 한 행
//    · 일별   = user_visit_log — 하루 순방문자. 리워드 판정이 이 표 위에 선다
//    단위가 달라서 「오늘 조회수」와 「오늘 방문」은 원래 안 맞는다. 맞추려 들면 한쪽이 거짓이 된다.
//
// ⚠️ page_views 가 쌓이기 전 구간은 0 이 아니라 「모름」이다. 0 으로 그리면 그날 아무도 안 온 것처럼 보인다.

import { useState } from 'react'

type Traffic = {
  days: { date: string; count: number }[]
  today: number
  yesterday: number
  avg7: number
  sum30: number
  hours: { hour: number; views: number; visitors: number }[]
  firstViewAt: string | null
}

const CARD = 'bg-white border border-[#EAEAEE] rounded-[14px] overflow-hidden'
const HEAD = 'flex items-center px-5 py-[14px] border-b border-[#F1F1F4]'
const H2 = 'text-[14px] font-bold tracking-[-0.01em] text-[#17171B]'
const SEP = <span className="mx-[9px] text-[11.5px] text-[#E2E2E8]">|</span>

const won = (n: number) => n.toLocaleString('ko-KR')

/** KST 시(hour). 서버 TZ 를 타지 않게 +9h 밀고 UTC 시를 읽는다(todayStats.ts 와 같은 방식). */
const kstHour = (iso: string) => new Date(Date.parse(iso) + 9 * 60 * 60 * 1000).getUTCHours()
const kstDate = (iso: string) =>
  new Date(Date.parse(iso) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)

function Stat({ k, v, s }: { k: string; v: string; s: string }) {
  return (
    <div className="px-[18px] py-[13px] border-b border-r border-[#F5F5F7]">
      <div className="text-[11px] text-[#9A9AA5]">{k}</div>
      <div className="text-[18px] font-extrabold tracking-[-0.025em] tabular-nums mt-1">{v}</div>
      <div className="text-[10.5px] text-[#B0B0BB] mt-[3px]">{s}</div>
    </div>
  )
}

export default function TrafficPanel({ traffic, today }: { traffic: Traffic; today: string }) {
  const [tab, setTab] = useState<'hour' | 'day'>('hour')

  const dayMax = Math.max(1, ...traffic.days.map((d) => d.count))
  const hourMax = Math.max(1, ...traffic.hours.map((h) => h.views))
  const hourViews = traffic.hours.reduce((s, h) => s + h.views, 0)
  const peak = traffic.hours.reduce((a, b) => (b.views > a.views ? b : a), traffic.hours[0])

  // 기록이 오늘 시작됐으면 그 시각 이전은 「모름」이다 — 0 막대로 그리지 않는다.
  const startedToday = traffic.firstViewAt ? kstDate(traffic.firstViewAt) === today : false
  const knownFrom = startedToday && traffic.firstViewAt ? kstHour(traffic.firstViewAt) : 0
  const noHourData = traffic.firstViewAt === null

  const TabBtn = ({ id, label }: { id: 'hour' | 'day'; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={`px-[11px] h-[26px] rounded-[7px] text-[11.5px] font-bold transition whitespace-nowrap ${
        tab === id ? 'bg-[#17171B] text-white' : 'text-[#7C7C88] hover:bg-[#F6F6F7]'
      }`}
    >
      {label}
    </button>
  )

  return (
    <section className={CARD}>
      <div className={HEAD}>
        <h2 className={H2}>트래픽</h2>
        <span className="ml-[9px] text-[11.5px] text-[#9A9AA5]">
          {tab === 'hour' ? '오늘 24시간' : '최근 14일'}
        </span>
        {SEP}
        <span className="text-[11.5px] text-[#B0B0BB]">
          {tab === 'hour' ? '페이지 조회 기준 · 연인원' : '방문 로그는 날짜 단위로만 쌓입니다'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <TabBtn id="hour" label="시간대" />
          <TabBtn id="day" label="일별" />
        </div>
      </div>

      {tab === 'hour' ? (
        <div className="grid grid-cols-[minmax(0,1fr)_420px] items-stretch">
          <div className="px-5 pt-4 pb-[14px] border-r border-[#F1F1F4]">
            {noHourData ? (
              <div className="h-[100px] flex flex-col items-center justify-center gap-[6px]">
                <div className="text-[12px] font-bold text-[#7C7C88]">
                  이 날짜 이전은 시간 정보가 없어요
                </div>
                <div className="text-[11px] text-[#B0B0BB]">
                  방문 시각 기록을 켠 뒤부터 쌓입니다
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-[2px] h-[76px]">
                  {traffic.hours.map((h) => {
                    const unknown = h.hour < knownFrom
                    return (
                      <div
                        key={h.hour}
                        title={
                          unknown
                            ? `${h.hour}시 · 기록 없음`
                            : `${h.hour}시 · 조회 ${h.views}회 · 로그인 ${h.visitors}명`
                        }
                        className={`flex-1 min-w-0 rounded-t-[2px] ${
                          unknown
                            ? 'bg-[#F5F5F7]'
                            : h.hour === peak?.hour && h.views > 0
                              ? 'bg-[#F59E0B]'
                              : 'bg-[#D4D4DC]'
                        }`}
                        style={{
                          height: unknown
                            ? '2%'
                            : `${Math.max(Math.round((h.views / hourMax) * 100), 2)}%`,
                        }}
                      />
                    )
                  })}
                </div>
                <div className="flex justify-between mt-[7px] text-[10px] text-[#B0B0BB]">
                  <span>0시</span>
                  <span>6시</span>
                  <span>12시</span>
                  <span>18시</span>
                  <span>23시</span>
                </div>
                {knownFrom > 0 && (
                  <div className="mt-[7px] text-[10.5px] text-[#B0B0BB]">
                    이 날짜 이전은 시간 정보가 없어요 — {knownFrom}시부터 기록됐습니다
                  </div>
                )}
              </>
            )}
          </div>
          <div className="grid grid-cols-2">
            <Stat k="오늘 조회" v={won(hourViews)} s="페이지 조회 · 연인원" />
            <Stat
              k="가장 붐빈 시간"
              v={hourViews > 0 && peak ? `${peak.hour}시` : '—'}
              s={hourViews > 0 && peak ? `${won(peak.views)}회` : '기록 없음'}
            />
            <Stat k="오늘 방문" v={won(traffic.today)} s="순방문자 · 일별 기준" />
            <Stat
              k="기록 시작"
              v={traffic.firstViewAt ? kstDate(traffic.firstViewAt).slice(5).replace('-', '/') : '—'}
              s={traffic.firstViewAt ? '이 날부터 시각이 있음' : '아직 없음'}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_420px] items-stretch">
          <div className="px-5 pt-4 pb-[14px] border-r border-[#F1F1F4]">
            <div className="flex items-end gap-[2px] h-[76px]">
              {traffic.days.map((d, i) => (
                <div
                  key={d.date}
                  title={`${d.date} · ${d.count}명`}
                  className={`flex-1 min-w-0 rounded-t-[2px] ${i === traffic.days.length - 1 ? 'bg-[#F59E0B]' : 'bg-[#D4D4DC]'}`}
                  style={{ height: `${Math.max(Math.round((d.count / dayMax) * 100), 2)}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-[7px] text-[10px] text-[#B0B0BB]">
              <span>{traffic.days[0]?.date.slice(5).replace('-', '/')}</span>
              <span>{traffic.days[6]?.date.slice(5).replace('-', '/')}</span>
              <span>{traffic.days[13]?.date.slice(5).replace('-', '/')} (오늘)</span>
            </div>
          </div>
          <div className="grid grid-cols-2">
            <Stat k="오늘 방문" v={won(traffic.today)} s={`어제 ${won(traffic.yesterday)}명`} />
            <Stat k="어제 방문" v={won(traffic.yesterday)} s="전일 확정치" />
            <Stat k="최근 7일 평균" v={won(traffic.avg7)} s="하루 평균 방문자" />
            <Stat k="30일 누적" v={won(traffic.sum30)} s="연인원 · 중복 포함" />
          </div>
        </div>
      )}
    </section>
  )
}
