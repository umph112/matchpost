'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Megaphone, Users, MessageSquare, Bell, Wallet } from 'lucide-react'
import LogoutButton from './LogoutButton'

// 광고주 셸 — PC(사이드바) / 모바일(앱형)을 사용자가 선택(환경 자동 감지 기본, localStorage 우선).
// PC 모드 비주얼은 design/mypage-pc/README.md 스펙 기준.
const NAV = [
  { href: '/advertiser/dashboard', label: '대시보드', Icon: LayoutDashboard, badge: '' as 'msg' | 'notif' | '' },
  { href: '/advertiser/campaigns', label: '캠페인', Icon: Megaphone, badge: '' as 'msg' | 'notif' | '' },
  { href: '/advertiser/search', label: '인플루언서', Icon: Users, badge: '' as 'msg' | 'notif' | '' },
  { href: '/advertiser/messages', label: '메시지', Icon: MessageSquare, badge: 'msg' as const },
  { href: '/advertiser/notifications', label: '알림', Icon: Bell, badge: 'notif' as const },
]

export default function AdvertiserShell({
  name,
  sub = '광고주 콘솔',
  spend = 0,
  msgCount = 0,
  notifCount = 0,
  children,
}: {
  name: string
  sub?: string
  spend?: number
  msgCount?: number
  notifCount?: number
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [mode, setMode] = useState<'pc' | 'mobile'>('pc')
  const [open, setOpen] = useState(false)
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const badgeVal = (key: string) => (key === 'msg' ? msgCount : key === 'notif' ? notifCount : 0)

  useEffect(() => {
    const detectMobile = () =>
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    const apply = () => {
      const saved = localStorage.getItem('advViewMode')
      if (saved === 'mobile' || saved === 'pc') setMode(saved)
      else setMode(detectMobile() ? 'mobile' : 'pc')
    }
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [])

  const toggleMode = () => {
    const next = mode === 'pc' ? 'mobile' : 'pc'
    setMode(next)
    localStorage.setItem('advViewMode', next)
    setOpen(false)
  }

  const brand = (
    <div className="h-16 flex items-center gap-[10px] px-5 border-b border-[#F1F1F4]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo/matchpost-mark.svg" width={24} height={24} alt="" aria-hidden />
      <span
        style={{ fontFamily: 'Archivo, ui-sans-serif, system-ui, sans-serif', fontWeight: 900, fontSize: 19, letterSpacing: '0.055em' }}
        className="text-[#17171B] leading-none"
      >
        MATCH<span className="text-[#F59E0B]">·</span>POST
      </span>
    </div>
  )

  const navList = (
    <nav className="flex flex-col gap-0.5 p-3">
      <div className="text-[10px] font-bold text-[#B0B0BB] tracking-[0.06em] px-2.5 pt-2 pb-1.5">운영</div>
      {NAV.map((n) => {
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
      <div className="flex items-center gap-2.5 px-2.5 py-[9px] rounded-lg text-[13.5px] font-semibold text-[#C4C4CE] cursor-not-allowed">
        <Wallet size={16} strokeWidth={1.75} className="opacity-75 shrink-0" />
        <span>정산</span>
        <span className="ml-auto text-[10px] font-bold bg-[#F1F1F4] text-[#9A9AA5] rounded px-1.5 py-0.5">곧</span>
      </div>
    </nav>
  )

  const modeToggle = (
    <div className="flex bg-[#F1F1F4] rounded-lg p-[3px]">
      <button
        onClick={() => mode !== 'pc' && toggleMode()}
        className={`text-[11.5px] px-[11px] py-[5px] rounded-md ${
          mode === 'pc' ? 'bg-white text-[#17171B] font-bold shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-[#8A8A96] font-semibold'
        }`}
      >
        PC
      </button>
      <button
        onClick={() => mode !== 'mobile' && toggleMode()}
        className={`text-[11.5px] px-[11px] py-[5px] rounded-md ${
          mode === 'mobile' ? 'bg-white text-[#17171B] font-bold shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-[#8A8A96] font-semibold'
        }`}
      >
        모바일
      </button>
    </div>
  )

  // ── 모바일 버전 (앱형) ──
  if (mode === 'mobile') {
    return (
      <div className="min-h-screen bg-[#F6F6F7]">
        <header className="h-14 bg-white border-b border-[#EAEAEE] flex items-center gap-3 px-4 sticky top-0 z-30">
          <button className="text-[#5C5C68] text-lg" onClick={() => setOpen(true)} aria-label="메뉴">
            ☰
          </button>
          <span className="text-sm font-semibold text-[#17171B] truncate">{name}</span>
          <div className="ml-auto flex items-center gap-3">
            {modeToggle}
            <LogoutButton />
          </div>
        </header>
        {open && (
          <div className="fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-60 bg-white shadow-xl flex flex-col">
              {brand}
              {navList}
            </aside>
          </div>
        )}
        <main className="adv-mobile max-w-lg mx-auto p-4">{children}</main>
      </div>
    )
  }

  // ── PC 버전 (좌측 고정 사이드바 + 넓은 콘텐츠) ──
  return (
    <div className="flex min-h-screen min-w-[1360px] bg-[#F6F6F7] text-[#1A1A1F]">
      <aside className="w-[236px] shrink-0 bg-white border-r border-[#EAEAEE] sticky top-0 h-screen flex flex-col">
        {brand}
        {navList}
        <div className="mt-auto border-t border-[#F1F1F4] px-4 py-3.5">
          <div className="text-[11px] text-[#9A9AA5] leading-relaxed">이번 달 집행 예정</div>
          <div className="text-base font-extrabold tracking-[-0.02em] mt-0.5">
            {spend.toLocaleString()}
            <span className="text-xs font-semibold text-[#7C7C88]">원</span>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white/[.88] backdrop-blur-[10px] border-b border-[#EAEAEE] flex items-center gap-3.5 px-7 sticky top-0 z-30">
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-[-0.01em]">{name}</span>
            <span className="text-[11px] text-[#9A9AA5] mt-px">{sub}</span>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            {modeToggle}
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
            <div className="w-[34px] h-[34px] rounded-full bg-[#FEF3C7] text-[#B45309] text-[13px] font-extrabold flex items-center justify-center">
              {name[0]}
            </div>
            <LogoutButton />
          </div>
        </header>
        <main className="adv-pc flex-1 flex flex-col gap-5 pt-[26px] px-7 pb-10">{children}</main>
      </div>
    </div>
  )
}
