'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Megaphone, Users, UserCheck, MessageSquare, Bell, Wallet, CreditCard, UserPlus, Menu } from 'lucide-react'
import LogoutButton from './LogoutButton'
import Logo from './Logo'
import { initial } from '@/lib/initial'

// 광고주 셸 — PC(사이드바) / 모바일(앱형)을 화면폭·UA로 자동 감지(사용자 토글 없음, D7 4-8).
// PC 모드 비주얼은 design/mypage-pc/README.md 스펙 기준.
const NAV_GROUPS: {
  group: string
  items: { href: string; label: string; Icon: typeof LayoutDashboard; badge?: 'msg' | 'notif' }[]
}[] = [
  {
    group: '캠페인 열기',
    items: [
      { href: '/advertiser/dashboard', label: '대시보드', Icon: LayoutDashboard },
      { href: '/advertiser/campaigns', label: '캠페인', Icon: Megaphone },
    ],
  },
  {
    group: '사람 찾기',
    items: [
      { href: '/advertiser/search', label: '인플루언서', Icon: Users },
      { href: '/advertiser/connections', label: '내 인플루언서', Icon: UserCheck },
    ],
  },
  {
    group: '이야기하기',
    items: [{ href: '/advertiser/messages', label: '대시', Icon: MessageSquare, badge: 'msg' }],
  },
  {
    group: '정산하기',
    items: [
      { href: '/advertiser/settlements', label: '정산', Icon: Wallet },
      { href: '/credits', label: '크레딧', Icon: CreditCard },
    ],
  },
  {
    group: '계정',
    items: [
      { href: '/advertiser/team', label: '팀 멤버', Icon: UserPlus },
      { href: '/advertiser/team/workload', label: '팀원 현황', Icon: Users },
      { href: '/advertiser/notifications', label: '알림', Icon: Bell, badge: 'notif' },
    ],
  },
]

export default function AdvertiserShell({
  name,
  sub = '광고주 콘솔',
  spend = 0,
  msgCount = 0,
  notifCount = 0,
  canToggle = false,
  isMember = false,
  initialView = 'me',
  children,
}: {
  name: string
  sub?: string
  spend?: number
  msgCount?: number
  notifCount?: number
  canToggle?: boolean // 대표 + 활동중 팀원 1명 이상일 때만 모드 토글 노출
  isMember?: boolean // 팀원 계정 (팀·크레딧 메뉴 숨김)
  initialView?: 'me' | 'all'
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const fullBleed = pathname.startsWith('/advertiser/messages')
  const [mode, setMode] = useState<'pc' | 'mobile'>('pc')
  const [open, setOpen] = useState(false)
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [view, setView] = useState<'me' | 'all'>(initialView) // 내 업무 / 회사 관리
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const badgeVal = (key?: 'msg' | 'notif') => (key === 'msg' ? msgCount : key === 'notif' ? notifCount : 0)
  const [subLine1, subLine2] = sub.split(' · ')

  // 모드 전환 — 쿠키(adv_view)에 저장하고 서버 컴포넌트를 새로고침해 데이터 범위를 다시 계산한다.
  const changeView = (v: 'me' | 'all') => {
    if (v === view) return
    setView(v)
    document.cookie = `adv_view=${v}; path=/; max-age=${60 * 60 * 24 * 365}`
    router.refresh()
  }

  // 팀·크레딧 메뉴 노출 규칙:
  //  - 팀원: 숨김 (팀 관리 권한 없음)
  //  - 대표 + 토글 가능(팀 있음): 「회사 관리」 모드일 때만
  //  - 대표 + 토글 불가(솔로): 항상 (첫 팀원 초대·크레딧 구매 경로 유지)
  const showCompanyMenu = isMember ? false : canToggle ? view === 'all' : true
  const COMPANY_HREFS = ['/advertiser/team', '/advertiser/team/workload', '/credits']
  const visibleGroups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((n) => (COMPANY_HREFS.includes(n.href) ? showCompanyMenu : true)) }))
    .filter((g) => g.items.length > 0)

  // 모드 전환 칩 (스펙 값 그대로)
  const viewToggle = canToggle ? (
    <div style={{ display: 'inline-flex', gap: 2, background: '#F1F1F4', borderRadius: 9, padding: 3 }}>
      {([['me', '내 업무'], ['all', '회사 관리']] as const).map(([v, label]) => {
        const on = view === v
        return (
          <button
            key={v}
            type="button"
            onClick={() => changeView(v)}
            style={{
              padding: '5px 12px',
              borderRadius: 7,
              fontSize: 12.5,
              fontWeight: on ? 700 : 600,
              color: on ? '#17171B' : '#7C7C88',
              background: on ? '#fff' : 'transparent',
              boxShadow: on ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
              transition: 'all .12s',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  ) : null

  useEffect(() => {
    const detectMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    const apply = () => setMode(detectMobile() ? 'mobile' : 'pc')
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [])

  useEffect(() => {
    fetch('/api/credits/balance')
      .then(r => r.json())
      .then(d => setCreditBalance(d.balance ?? 0))
      .catch(() => {})
  }, [])

  const brand = (
    <div className="h-16 flex items-center px-5 border-b border-[#F1F1F4]">
      <Logo size={19} />
    </div>
  )

  const navList = (
    <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 p-3">
      {visibleGroups.map((g) => (
        <div key={g.group}>
          <div className="text-[10px] font-bold text-[#B0B0BB] tracking-[0.06em] px-2.5 pt-2.5 pb-1.5">{g.group}</div>
          {g.items.map((n) => {
            const b = badgeVal(n.badge)
            const active = isActive(n.href)
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-2.5 py-[9px] rounded-lg text-[13.5px] font-semibold transition ${
                  active ? 'bg-[#FEF3C7] text-[#B45309] font-bold' : 'text-[#5C5C68] hover:bg-[#F6F6F7]'
                }`}
              >
                <n.Icon size={16} strokeWidth={1.75} className="opacity-75 shrink-0" />
                <span>{n.label}</span>
                {b > 0 && (
                  <span className="ml-auto text-[10.5px] font-bold bg-[#FEE2E2] text-[#DC2626] rounded-full px-1.5 min-w-[18px] text-center">
                    {b}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )

  // ── 모바일 버전 (앱형) ──
  if (mode === 'mobile') {
    return (
      <div className="min-h-screen bg-[#F6F6F7]">
        <header className="h-14 bg-white border-b border-[#EAEAEE] flex items-center gap-3 px-4 sticky top-0 z-30">
          <button className="text-[#5C5C68]" onClick={() => setOpen(true)} aria-label="메뉴">
            <Menu size={20} strokeWidth={1.75} />
          </button>
          <span className="text-sm font-semibold text-[#17171B] truncate">{name}</span>
          <div className="ml-auto flex items-center gap-3">
            {viewToggle}
            <LogoutButton />
          </div>
        </header>
        {open && (
          <div className="fixed inset-0 z-40">
            <div className="absolute inset-0 bg-[rgba(0,0,0,0.3)]" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-60 bg-white shadow-xl flex flex-col">
              {brand}
              {navList}
            </aside>
          </div>
        )}
        {/* 광고주 콘솔은 PC 우선(D14 7절). 앱/모바일에선 정밀 관리를 PC로 안내한다. */}
        {!fullBleed && (
          <div className="max-w-lg mx-auto px-4 pt-3">
            <div className="text-[11.5px] text-[#7C7C88] bg-[#FEF3C7] border border-[#FDE68A] rounded-lg px-3 py-2 leading-relaxed">
              광고주 콘솔은 <b className="text-[#B45309]">PC에서 확인</b>하면 딜시트·정산·팀 관리를 더 정확하게 다룰 수 있어요.
            </div>
          </div>
        )}
        <main className={fullBleed ? 'adv-mobile h-[calc(100vh-56px)] flex flex-col' : 'adv-mobile max-w-lg mx-auto p-4'}>{children}</main>
      </div>
    )
  }

  // ── PC 버전 (좌측 고정 사이드바 + 넓은 콘텐츠) ──
  return (
    <div className="flex min-h-screen min-w-[1360px] bg-[#F6F6F7] text-[#1A1A1F]">
      <aside className="w-[236px] shrink-0 bg-white border-r border-[#EAEAEE] sticky top-0 h-screen flex flex-col">
        {brand}
        {navList}
        <div className="mt-auto border-t border-[#F1F1F4] px-4 py-3.5 flex flex-col gap-2.5">
          <div>
            <div className="text-[11px] text-[#9A9AA5] leading-relaxed">이번 달 집행 예정</div>
            <div className="text-base font-extrabold tracking-[-0.02em] mt-0.5">
              {spend.toLocaleString()}
              <span className="text-xs font-semibold text-[#7C7C88]">원</span>
            </div>
          </div>
          <Link href="/credits" className="block hover:opacity-80">
            <div className="text-[11px] text-[#9A9AA5] leading-relaxed">보유 크레딧</div>
            <div className="text-base font-extrabold tracking-[-0.02em] mt-0.5">
              {creditBalance === null ? '—' : creditBalance.toLocaleString()}
              <span className="text-xs font-semibold text-[#F59E0B]"> C</span>
            </div>
          </Link>
          <div className="flex gap-2 text-[10px] text-[#B9B9C2] pt-1">
            <Link href="/terms" target="_blank" className="hover:text-[#7C7C88]">이용약관</Link>
            <span>·</span>
            <Link href="/privacy" target="_blank" className="hover:text-[#7C7C88]">개인정보처리방침</Link>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white/[.88] backdrop-blur-[10px] border-b border-[#EAEAEE] flex items-center gap-3.5 px-7 sticky top-0 z-30">
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-[-0.01em]">{subLine1}</span>
            {subLine2 && <span className="text-[11px] text-[#9A9AA5] mt-px">{subLine2}</span>}
          </div>
          {viewToggle}
          <div className="ml-auto flex items-center gap-2.5">
            <Link
              href="/advertiser/notifications"
              className="relative w-[34px] h-[34px] rounded-lg border border-[#EAEAEE] flex items-center justify-center text-[#5C5C68] hover:bg-[#F6F6F7]"
            >
              <Bell size={16} strokeWidth={1.75} />
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#EF4444] text-white text-[9.5px] font-bold rounded-full px-[5px] border-2 border-white">
                  {notifCount}
                </span>
              )}
            </Link>
            <span className="text-[13px] font-semibold text-[#3C3C46] max-w-[140px] truncate">{name}</span>
            <div className="w-[34px] h-[34px] rounded-full bg-[#FEF3C7] text-[#B45309] text-[13px] font-extrabold flex items-center justify-center shrink-0">
              {initial(name)}
            </div>
            <LogoutButton />
          </div>
        </header>
        <main className="adv-pc flex-1 flex flex-col gap-[14px] pt-[26px] px-7 pb-10">{children}</main>
      </div>
    </div>
  )
}
