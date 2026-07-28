'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import LogoutButton from './LogoutButton'

// 광고주 셸 — PC(사이드바) / 모바일(앱형) 버전을 사용자가 직접 선택.
// 선택값은 localStorage('advViewMode')에 저장. 화면 크기와 무관하게 적용.
// ⚠️ 뼈대(구조)만 잡음. 세부 비주얼은 Claude Design 핸드오프. (design/advertiser-desktop.md)
const NAV = [
  { href: '/advertiser/dashboard', label: '대시보드', icon: '🏠' },
  { href: '/advertiser/campaigns', label: '캠페인', icon: '📣' },
  { href: '/advertiser/search', label: '인플루언서', icon: '👥' },
  { href: '/advertiser/messages', label: '메시지', icon: '💬' },
  { href: '/advertiser/notifications', label: '알림', icon: '🔔' },
]

export default function AdvertiserShell({ name, children }: { name: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const [mode, setMode] = useState<'pc' | 'mobile'>('pc')
  const [open, setOpen] = useState(false) // 모바일 드로어
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // 기본: 환경 자동 감지(모바일 접속=모바일, PC=PC). 사용자가 토글로 고른 값이 있으면 그걸 우선.
  useEffect(() => {
    const detectMobile = () =>
      window.matchMedia('(max-width: 1023px)').matches ||
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
    <div className="h-14 flex items-center px-5 border-b border-gray-100">
      <span className="font-bold text-amber-500 text-lg">MATCHPOST</span>
    </div>
  )

  const navList = (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          onClick={() => setOpen(false)}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
            isActive(n.href) ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>{n.icon}</span>
          <span>{n.label}</span>
        </Link>
      ))}
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 cursor-not-allowed">
        <span>💰</span>
        <span>정산</span>
        <span className="ml-auto text-[10px] bg-gray-100 text-gray-400 rounded px-1.5 py-0.5">곧</span>
      </div>
    </nav>
  )

  // PC ↔ 모바일 전환 버튼
  const modeToggle = (
    <button
      onClick={toggleMode}
      className="text-xs text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50"
      title="PC / 모바일 버전 전환"
    >
      {mode === 'pc' ? '📱 모바일' : '💻 PC'}
    </button>
  )

  // ── 모바일 버전 (앱형: 사이드바 없음, 상단 헤더 + 드로어) ──
  if (mode === 'mobile') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center gap-3 px-4 sticky top-0 z-30">
          <button className="text-gray-500 text-lg" onClick={() => setOpen(true)} aria-label="메뉴">☰</button>
          <span className="text-sm font-semibold text-gray-800 truncate">{name}</span>
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
    <div className="min-h-screen flex bg-gray-50">
      <aside className="flex flex-col w-60 bg-white border-r border-gray-200 shrink-0">
        {brand}
        {navList}
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center gap-3 px-4 sticky top-0 z-30">
          <span className="text-sm font-semibold text-gray-800 truncate">{name}</span>
          <div className="ml-auto flex items-center gap-4">
            {modeToggle}
            <Link href="/advertiser/notifications" className="text-gray-400 hover:text-gray-700">🔔</Link>
            <LogoutButton />
          </div>
        </header>
        <main className="adv-pc flex-1 p-4 lg:p-6 w-full max-w-6xl mx-auto">{children}</main>
      </div>
    </div>
  )
}
