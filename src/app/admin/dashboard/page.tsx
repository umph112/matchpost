// D26 9-3 · 9-4절 — 「오늘」.
//
// 관리자가 로그인해서 처음 보는 화면. "지금 무엇이 밀려 있나" 한 화면에서 끝나야 한다.
//
// ⚠️ 숫자 하드코딩 금지(프로토타입 주석). 큐·배지는 getTodayQueue(), 나머지는 getTodayStats()
//    한 곳에서만 파생시킨다. 화면에서 다시 세면 사이드바 배지와 어긋난다.
// ⚠️ 간격은 14px 하나. 20·18·16 을 섞지 않는다.

import Link from 'next/link'
import { listTime, kstDateString } from '@/lib/date'
import { getTodayQueue } from '@/lib/admin/todayQueue'
import { getTodayStats } from '@/lib/admin/todayStats'
import { BATCH_ROUTES } from '@/lib/admin/batchRoutes'
import { createClient } from '@/lib/supabase/server'
import TrafficPanel from '@/components/admin/TrafficPanel'

export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<string, string> = {
  unpaid: '대금 미지급',
  cancel_unilateral: '일방적 취소·조건 변경',
  guide_mismatch_req: '가이드와 다른 요구',
  draft_late: '원고 미제출·게재 지연',
  guide_violation: '가이드 불이행',
  no_show: '무단 불참',
  abuse: '욕설·부적절한 요구',
  etc: '기타',
}

const won = (n: number) => n.toLocaleString('ko-KR')

/** 접수 시각으로부터 며칠째인지 — 오래된 것이 위험하다 */
function ageLabel(iso: string): { label: string; hot: boolean } {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return { label: '오늘', hot: false }
  return { label: `${days}일째`, hot: days >= 3 }
}

const CARD = 'bg-white border border-[#EAEAEE] rounded-[14px] overflow-hidden'
const HEAD = 'flex items-center px-5 py-[14px] border-b border-[#F1F1F4]'
const H2 = 'text-[14px] font-bold tracking-[-0.01em] text-[#17171B]'
const SEP = <span className="mx-[9px] text-[11.5px] text-[#E2E2E8]">|</span>

export default async function AdminTodayPage() {
  const [queue, stats] = await Promise.all([getTodayQueue(), getTodayStats()])

  // 0102 로 관리자 SELECT 정책이 생겼다 — service 키로 우회하지 않는다.
  // 이 화면은 admin/layout.tsx:32 에서 role='admin' 을 확인하고 들어온다.
  const db = await createClient()
  const { data: openReports } = await db
    .from('reports')
    .select(
      'id, type, status, stage, created_at, reporter:profiles!reports_reporter_id_fkey(name), counterpart:profiles!reports_counterpart_id_fkey(name)',
    )
    .eq('status', 'open')
    .order('created_at', { ascending: true })
    .limit(8)

  // ── 처리 대기 큐 4칸 ──────────────────────────────────
  // 4번째는 건수가 아니라 시스템 현황 — 장애를 문의로 알게 되면 늦다.
  const cronBad = queue.unregistered.length
  const cards: {
    k: string
    n: number
    sub: string
    hot: boolean
    href?: string
    sys?: boolean
  }[] = [
    {
      k: '미입금 신고',
      n: queue.unpaidReports,
      sub: '대금 미지급으로 접수돼 열려 있는 건',
      hot: queue.unpaidReports > 0,
      href: '/admin/reports?status=open',
    },
    {
      k: '사업자 확인',
      n: queue.bizPending,
      sub: '서류를 올리고 승인을 기다리는 광고주',
      hot: false,
      href: '/admin/users',
    },
    {
      k: '결제 지연',
      n: queue.overdue,
      sub: '예정일이 지났는데 정산 기록이 없는 건',
      hot: queue.overdue > 0,
    },
    {
      k: '시스템 현황',
      n: cronBad,
      sub: cronBad ? '코드에는 있는데 아무도 부르지 않는 자동 처리' : `자동 처리 ${BATCH_ROUTES.length}개 정상`,
      hot: cronBad > 0,
      sys: true,
    },
  ]

  const todayLabel = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date())


  return (
    <>
      {/* 처리 대기 큐 */}
      <div className="grid grid-cols-4 gap-[14px]">
        {cards.map((q) => {
          const body = (
            <>
              <div className="flex items-center gap-[7px]">
                <span
                  className={`w-[7px] h-[7px] rounded-full block shrink-0 ${q.hot ? 'bg-[#EF4444]' : 'bg-[#D4D4DC]'}`}
                />
                <span className="text-[11.5px] font-bold text-[#5C5C68]">{q.k}</span>
              </div>
              <div className="flex items-baseline gap-[5px] mt-[9px]">
                {q.sys && q.hot ? (
                  <>
                    <span className="text-[19px] font-extrabold tracking-[-0.03em] text-[#DC2626]">
                      크론 미등록
                    </span>
                    <span className="text-[12px] font-bold text-[#9A9AA5]">{q.n}건</span>
                  </>
                ) : q.sys ? (
                  <>
                    <span className="text-[19px] font-extrabold tracking-[-0.03em] text-[#15803D]">
                      정상
                    </span>
                    <span className="text-[12px] font-bold text-[#9A9AA5]">이상 없음</span>
                  </>
                ) : (
                  <>
                    <span
                      className={`text-[26px] font-extrabold tracking-[-0.03em] tabular-nums ${q.hot ? 'text-[#DC2626]' : 'text-[#17171B]'}`}
                    >
                      {q.n}
                    </span>
                    <span className="text-[12px] font-bold text-[#9A9AA5]">건</span>
                  </>
                )}
              </div>
              <div className="text-[11px] text-[#9A9AA5] leading-[1.5] mt-[6px]">{q.sub}</div>
            </>
          )
          // bg 를 두 번 적으면 Tailwind 에서 어느 쪽이 이길지 클래스 순서로 정해지지 않는다 — 한 번만 적는다
          const cls = `rounded-[14px] px-[17px] pt-[15px] pb-4 border ${q.hot ? 'border-[#FECACA] bg-[#FEF2F2]' : 'border-[#EAEAEE] bg-white'}`
          return q.href ? (
            <Link key={q.k} href={q.href} className={`${cls} block hover:border-[#D4D4DC] transition`}>
              {body}
            </Link>
          ) : (
            <div key={q.k} className={cls} title="화면은 다음 회차에 연결됩니다">
              {body}
            </div>
          )
        })}
      </div>

      {/* 회원 현황 */}
      <section className={CARD}>
        <div className={HEAD}>
          <h2 className={H2}>회원 현황</h2>
          {SEP}
          <span className="text-[11.5px] text-[#9A9AA5]">{todayLabel}</span>
        </div>
        <div className="grid grid-cols-3 items-stretch">
          {stats.members.rows.map((m) => {
            const diff = m.today - m.prev
            return (
              <div key={m.role} className="px-5 pt-4 pb-[17px] border-r border-[#F1F1F4]">
                <div className="flex items-center gap-[7px]">
                  <span
                    className={`w-2 h-2 shrink-0 ${m.role === '광고주' ? 'rounded-[2px] bg-[#17171B]' : 'rounded-full bg-[#F59E0B]'}`}
                  />
                  <span className="text-[12px] font-bold text-[#5C5C68]">{m.role}</span>
                </div>
                <div className="flex items-baseline gap-2 mt-[10px]">
                  <span className="text-[26px] font-extrabold tracking-[-0.03em] tabular-nums text-[#F59E0B]">
                    +{m.today}
                  </span>
                  <span className="text-[11.5px] font-bold text-[#9A9AA5]">오늘</span>
                  <span
                    className={`text-[11px] font-bold shrink-0 ${diff > 0 ? 'text-[#15803D]' : diff < 0 ? 'text-[#DC2626]' : 'text-[#B0B0BB]'}`}
                  >
                    {diff > 0 ? '▲ ' : diff < 0 ? '▼ ' : '– '}
                    {Math.abs(diff)}
                  </span>
                </div>
                <div className="flex items-baseline gap-[6px] mt-[11px] pt-[11px] border-t border-[#F5F5F7]">
                  <span className="text-[11.5px] text-[#9A9AA5]">누적</span>
                  <span className="text-[16px] font-extrabold tracking-[-0.02em] tabular-nums">
                    {won(m.total)}
                  </span>
                  <span className="text-[11.5px] text-[#9A9AA5]">명</span>
                </div>
              </div>
            )
          })}
          <div className="px-5 pt-4 pb-[17px] bg-[#FBFBFC]">
            <div className="text-[12px] font-bold text-[#5C5C68]">전체</div>
            <div className="flex items-baseline gap-2 mt-[10px]">
              <span className="text-[26px] font-extrabold tracking-[-0.03em] tabular-nums">
                {won(stats.members.total)}
              </span>
              <span className="text-[11.5px] font-bold text-[#9A9AA5]">명</span>
            </div>
            <div className="text-[11.5px] font-bold text-[#B45309] mt-[11px] pt-[11px] border-t border-[#EFEFF2]">
              오늘 +{stats.members.today}명
            </div>
          </div>
        </div>
      </section>

      {/* 트래픽 — 시간대(page_views) / 일별(user_visit_log) 두 탭. 탭 상태라 클라이언트 컴포넌트다. */}
      <TrafficPanel traffic={stats.traffic} today={kstDateString()} />

      {/* 진행중인 오픈 */}
      <section className={CARD}>
        <div className={HEAD}>
          <h2 className={H2}>진행중인 오픈</h2>
          {SEP}
          <span className="text-[11.5px] text-[#9A9AA5]">공개로 열려 있는 일정만</span>
        </div>
        <div className="grid grid-cols-3">
          {[
            { kind: '오늘 협업 가능', n: stats.opens.today, sub: '오늘 날짜로 열려 있는 오픈' },
            { kind: '이번 주', n: stats.opens.week, sub: '오늘부터 7일 안의 오픈' },
            { kind: '앞으로 전체', n: stats.opens.upcoming, sub: '오늘 이후 공개된 오픈' },
          ].map((o) => (
            <div key={o.kind} className="px-5 pt-[14px] pb-[15px] border-r border-[#F1F1F4]">
              <div className="flex items-center gap-[7px]">
                <span className="w-[7px] h-[7px] rounded-full shrink-0 bg-[#D4D4DC]" />
                <span className="text-[11.5px] font-bold text-[#5C5C68]">{o.kind}</span>
              </div>
              <div className="flex items-baseline gap-[5px] mt-2">
                <span className="text-[22px] font-extrabold tracking-[-0.03em] tabular-nums text-[#17171B]">
                  {o.n}
                </span>
                <span className="text-[11.5px] font-bold text-[#9A9AA5]">건</span>
              </div>
              <div className="text-[10.5px] text-[#9A9AA5] mt-1">{o.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 진행중인 캠페인 */}
      <section className={CARD}>
        <div className={HEAD}>
          <h2 className={H2}>진행중인 캠페인</h2>
          {SEP}
          <span className="text-[11.5px] text-[#9A9AA5]">모집중 캠페인 기준</span>
        </div>
        <div className="grid grid-cols-3">
          {[
            { kind: '모집중', n: String(stats.campaigns.open), unit: '건', sub: '지금 지원받고 있는 캠페인' },
            {
              kind: '대시 / 확정',
              n: `${stats.campaigns.dash} / ${stats.campaigns.confirmed}`,
              unit: '명',
              sub: '지원한 인플루언서 · 양쪽 수락된 인원',
            },
            { kind: '오늘 등록됨', n: String(stats.campaigns.newToday), unit: '건', sub: '오늘 새로 열린 캠페인' },
          ].map((w) => (
            <div key={w.kind} className="px-5 pt-[14px] pb-[15px] border-r border-[#F1F1F4]">
              <div className="flex items-center gap-[7px]">
                <span className="w-[7px] h-[7px] rounded-full shrink-0 bg-[#D4D4DC]" />
                <span className="text-[11.5px] font-bold text-[#5C5C68]">{w.kind}</span>
              </div>
              <div className="flex items-baseline gap-[5px] mt-2">
                <span className="text-[22px] font-extrabold tracking-[-0.03em] tabular-nums text-[#17171B]">
                  {w.n}
                </span>
                <span className="text-[11.5px] font-bold text-[#9A9AA5]">{w.unit}</span>
              </div>
              <div className="text-[10.5px] text-[#9A9AA5] mt-1">{w.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 지금 처리할 것 + 우측(시스템 · 오늘 지표) */}
      <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-[14px] items-stretch">
        <section className={`${CARD} flex flex-col`}>
          <div className={`${HEAD} shrink-0`}>
            <h2 className={H2}>지금 처리할 것</h2>
            <span className="ml-[9px] text-[11.5px] text-[#9A9AA5]">오래된 순</span>
            <Link
              href="/admin/reports?status=open"
              className="ml-auto text-[11px] font-bold text-[#B45309]"
            >
              신고 전체
            </Link>
          </div>

          {(openReports ?? []).length === 0 && queue.bizPending === 0 && queue.overdue === 0 && (
            <div className="px-5 py-12 text-center text-[12.5px] text-[#B0B0BB]">
              지금 밀려 있는 건이 없어요.
            </div>
          )}

          {(openReports ?? []).map((r) => {
            const age = ageLabel(r.created_at)
            const rep = r.reporter as unknown as { name: string } | null
            const cp = r.counterpart as unknown as { name: string } | null
            const unpaid = r.type === 'unpaid'
            return (
              <Link
                key={r.id}
                href={`/admin/reports/${r.id}`}
                className="flex items-center gap-3 px-5 py-[13px] border-b border-[#F5F5F7] hover:bg-[#FAFAFB] transition"
              >
                <span
                  className={`text-[10.5px] font-extrabold rounded-[5px] px-2 py-[3px] shrink-0 ${unpaid ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-[#F1F1F4] text-[#5C5C68]'}`}
                >
                  {unpaid ? '미입금' : '신고'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-bold text-[#2A2A33] truncate">
                    {TYPE_LABELS[r.type] ?? r.type}
                    {r.stage && ` · ${r.stage} 단계`}
                  </div>
                  <div className="text-[11px] text-[#9A9AA5] mt-[3px]">
                    {rep?.name ?? '알 수 없음'} → {cp?.name ?? '알 수 없음'} · {listTime(r.created_at)}
                  </div>
                </div>
                <span
                  className={`text-[11.5px] font-bold shrink-0 ${age.hot ? 'text-[#DC2626]' : 'text-[#9A9AA5]'}`}
                >
                  {age.label}
                </span>
              </Link>
            )
          })}

          {queue.bizPending > 0 && (
            <Link
              href="/admin/users"
              className="flex items-center gap-3 px-5 py-[13px] border-b border-[#F5F5F7] hover:bg-[#FAFAFB] transition"
            >
              <span className="text-[10.5px] font-extrabold rounded-[5px] px-2 py-[3px] shrink-0 bg-[#F1F1F4] text-[#5C5C68]">
                확인
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-bold text-[#2A2A33] truncate">
                  사업자등록증 확인 대기 {queue.bizPending}건
                </div>
                <div className="text-[11px] text-[#9A9AA5] mt-[3px]">
                  가입 승인이 늦으면 첫 캠페인이 밀립니다
                </div>
              </div>
              <span className="text-[11.5px] font-bold text-[#9A9AA5] shrink-0">확인</span>
            </Link>
          )}

          {queue.overdueRows.slice(0, 5).map((o) => (
            <div
              key={o.proposalId}
              className="flex items-center gap-3 px-5 py-[13px] border-b border-[#F5F5F7]"
              title="정산 모니터 화면은 다음 회차에 연결됩니다"
            >
              <span className="text-[10.5px] font-extrabold rounded-[5px] px-2 py-[3px] shrink-0 bg-[#FEF3C7] text-[#B45309]">
                지연
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-bold text-[#2A2A33] truncate">
                  {o.campaignTitle}
                </div>
                <div className="text-[11px] text-[#9A9AA5] mt-[3px]">
                  예정일 {o.settlementDate}
                  {o.budget != null && ` · ${won(o.budget)}원`}
                </div>
              </div>
              <span className="text-[11.5px] font-bold text-[#DC2626] shrink-0">미수</span>
            </div>
          ))}
        </section>

        <div className="flex flex-col gap-[14px] min-w-0 min-h-0">
          {/* 시스템 상태 — 배치가 실제로 등록돼 있는가 */}
          <section className={CARD}>
            <div className="flex items-center gap-2 px-[18px] py-[14px] border-b border-[#F1F1F4]">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${cronBad ? 'bg-[#EF4444]' : 'bg-[#22C55E]'}`}
              />
              <h2 className="text-[13.5px] font-bold text-[#17171B]">
                {cronBad ? '자동 처리 점검 필요' : '자동 처리 정상'}
              </h2>
            </div>

            {queue.unregistered.map((b) => (
              <div key={b.path} className="px-[18px] py-[13px] border-b border-[#F5F5F7]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold rounded-[4px] px-[6px] py-[2px] shrink-0 bg-[#FEE2E2] text-[#DC2626]">
                    미등록
                  </span>
                  <span className="text-[12.5px] font-bold text-[#2A2A33] flex-1 min-w-0 truncate">
                    {b.label}
                  </span>
                </div>
                <div className="text-[11.5px] text-[#3C3C46] mt-[6px] leading-[1.5]">{b.risk}</div>
                <div className="text-[10.5px] text-[#9A9AA5] mt-[3px] truncate">{b.path}</div>
              </div>
            ))}

            <div className="flex items-center gap-2 px-[18px] py-[11px]">
              <span className="w-2 h-2 rounded-full shrink-0 bg-[#22C55E]" />
              <span className="text-[11.5px] text-[#7C7C88] flex-1 min-w-0">
                {BATCH_ROUTES.length - cronBad}개는 크론에 등록돼 있어요
              </span>
            </div>
          </section>

          {/* 오늘 지표 */}
          <section className={`${CARD} flex-1 min-h-0 flex flex-col`}>
            <div className="flex items-center px-[18px] py-[14px] border-b border-[#F1F1F4] shrink-0">
              <h2 className="text-[13.5px] font-bold text-[#17171B]">오늘 지표</h2>
              <span className="ml-auto text-[11px] text-[#B0B0BB]">어제 대비</span>
            </div>
            <div className="px-[18px] pt-[6px] pb-[14px] flex-1 min-h-0">
              {stats.stats.map((s) => (
                <div
                  key={s.k}
                  className="flex items-center gap-[10px] py-[9px] border-b border-[#F5F5F7]"
                >
                  <span className="text-[12px] text-[#5C5C68] flex-1 min-w-0">{s.k}</span>
                  <span className="text-[13px] font-extrabold tabular-nums">
                    {s.v}
                    <span className="text-[11px] font-bold text-[#B0B0BB] ml-[2px]">{s.suffix}</span>
                  </span>
                  <span
                    className={`text-[11px] font-bold w-16 text-right shrink-0 tabular-nums ${s.d > 0 ? 'text-[#15803D]' : s.d < 0 ? 'text-[#DC2626]' : 'text-[#B0B0BB]'}`}
                  >
                    {s.d > 0 ? `+${s.d}` : s.d < 0 ? `${s.d}` : '–'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
