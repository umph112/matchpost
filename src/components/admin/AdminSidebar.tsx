'use client'

// D26 9-2절 — 사이드바 12항목 · 4그룹.
//
// 배지 숫자는 전부 layout 이 todayQueue 에서 뽑아 내려준다. 여기서 세지 않는다.
// ⚠️ 제재(admin/sanctions)는 사이드바에 두지 않는다 — 프로토타입에서 신고 화면 안에 있고,
//    제재는 신고 판정의 결과라 목록에서 바로 들어가면 근거 없이 단계를 만지게 된다.

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type SidebarCounts = {
  reports: number
  settle: number
  members: number
  system: number
}

type Item = {
  icon: string
  label: string
  /** 아직 만들지 않은 화면은 href 가 없다 — 눌리지 않게 두고 다음 회차에 연결한다 */
  href?: string
  badge?: number
  /** 신고 배지만 붉은색 */
  danger?: boolean
  /** 이 경로들 아래에 있으면 선택 상태 */
  match?: (path: string) => boolean
}

type Row = Item | { divider: true }

function build(counts: SidebarCounts): Row[] {
  return [
    { icon: '◧', label: '오늘', href: '/admin/dashboard', match: (p) => p === '/admin/dashboard' },
    { divider: true },
    {
      icon: '⚠',
      label: '신고 접수',
      href: '/admin/reports',
      badge: counts.reports,
      danger: true,
      // 제재 화면은 신고에서 들어가므로 여기서 같이 켠다
      match: (p) => p.startsWith('/admin/reports') || p.startsWith('/admin/sanctions'),
    },
    { icon: '▽', label: '정산 모니터', badge: counts.settle },
    { icon: '◎', label: '크레딧', href: '/admin/credits', match: (p) => p === '/admin/credits' },
    {
      icon: '◐',
      label: '크레딧 정책',
      href: '/admin/credits/policy',
      match: (p) => p.startsWith('/admin/credits/policy'),
    },
    { divider: true },
    {
      icon: '◫',
      label: '회원',
      href: '/admin/users',
      badge: counts.members,
      match: (p) => p.startsWith('/admin/users'),
    },
    { icon: '▤', label: '캠페인 · 딜시트' },
    { icon: '▥', label: '오픈' },
    { divider: true },
    { icon: '◈', label: '시스템 상태', badge: counts.system },
    { icon: '▦', label: '데이터 운영' },
    { icon: '◇', label: '지면 · 제휴' },
    { icon: '△', label: '지표' },
  ]
}

export default function AdminSidebar({ counts }: { counts: SidebarCounts }) {
  const pathname = usePathname() ?? ''
  const rows = build(counts)

  return (
    <div className="flex flex-col gap-[2px]">
      {rows.map((row, i) => {
        if ('divider' in row) return <div key={i} className="h-px bg-[#F1F1F4] my-[9px] mx-[10px]" />

        const active = row.match?.(pathname) ?? false
        const badgeClass = row.danger
          ? 'bg-[#FEE2E2] text-[#DC2626]'
          : 'bg-[#F1F1F4] text-[#7C7C88]'

        const inner = (
          <>
            <span className="w-4 text-center opacity-75 shrink-0">{row.icon}</span>
            <span>{row.label}</span>
            {!!row.badge && row.badge > 0 && (
              <span
                className={`ml-auto text-[10.5px] font-bold rounded-[20px] px-[6px] py-px ${badgeClass}`}
              >
                {row.badge}
              </span>
            )}
          </>
        )

        const base = 'flex items-center gap-[10px] px-[10px] py-[9px] rounded-lg text-[13.5px]'

        if (!row.href) {
          // 다음 회차에 만들 화면 — 자리는 보이되 눌리지 않는다.
          // 숫자는 그대로 보여준다. 화면이 없다고 위험까지 감춰지면 안 된다.
          return (
            <div
              key={i}
              className={`${base} text-[#B0B0BB] font-semibold cursor-default`}
              title="다음 회차에 연결됩니다"
            >
              {inner}
            </div>
          )
        }

        return (
          <Link
            key={i}
            href={row.href}
            className={`${base} transition ${
              active
                ? 'bg-[#FEF3C7] text-[#B45309] font-bold'
                : 'text-[#5C5C68] font-semibold hover:bg-[#F6F6F7]'
            }`}
          >
            {inner}
          </Link>
        )
      })}
    </div>
  )
}
