'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Home, CalendarDays, MessageSquare, BarChart3, Wallet, Search, Bell } from 'lucide-react'
import LogoutButton from './LogoutButton'
import MatchScore from './MatchScore'
import { creditAmount } from '@/lib/creditConfig'

// 인플루언서 셸 — 광고주 AdvertiserShell과 같은 PC/모바일 전환 패턴.
// 지금은 /influencer/dashboard 페이지에만 적용(다른 페이지는 아직 기존 TopBar 유지).
const MOBILE_TABS = [
  { href: '/influencer/dashboard', label: '홈', Icon: Home },
  { href: '/influencer/schedule/list', label: '오픈', Icon: CalendarDays },
  { href: '/influencer/messages', label: '대시', Icon: MessageSquare, badge: 'msg' as const },
  { href: '/influencer/channel-analytics', label: '내 채널', Icon: BarChart3 },
  { href: '/influencer/earnings', label: '수익', Icon: Wallet },
]

const PC_NAV = [
  { href: '/influencer/dashboard', label: '홈', Icon: Home, badge: '' as 'msg' | 'notif' | '' },
  { href: '/influencer/schedule/list', label: '오픈 일정', Icon: CalendarDays, badge: '' as 'msg' | 'notif' | '' },
  { href: '/influencer/messages', label: '대시', Icon: MessageSquare, badge: 'msg' as const },
  { href: '/influencer/search', label: '캠페인 찾기', Icon: Search, badge: '' as 'msg' | 'notif' | '' },
  { href: '/influencer/channel-analytics', label: '내 채널', Icon: BarChart3, badge: '' as 'msg' | 'notif' | '' },
  { href: '/influencer/earnings', label: '수익', Icon: Wallet, badge: '' as 'msg' | 'notif' | '' },
  { href: '/influencer/notifications', label: '알림', Icon: Bell, badge: 'notif' as const },
]

export default function InfluencerShell({
  name,
  matchScore,
  reviewCount = 0,
  blogGrade,
  msgCount = 0,
  notifCount = 0,
  children,
}: {
  name: string
  matchScore: number | null
  reviewCount?: number
  blogGrade?: string | null
  msgCount?: number
  notifCount?: number
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [mode, setMode] = useState<'pc' | 'mobile'>('mobile')
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const badgeVal = (key: string) => (key === 'msg' ? msgCount : key === 'notif' ? notifCount : 0)

  useEffect(() => {
    const detectMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    const saved = localStorage.getItem('infViewMode')
    if (saved === 'mobile' || saved === 'pc') setMode(saved)
    else setMode(detectMobile() ? 'mobile' : 'pc')
  }, [])

  useEffect(() => {
    fetch('/api/credits/balance')
      .then((r) => r.json())
      .then((d) => setCreditBalance(d.balance ?? 0))
      .catch(() => {})
  }, [])

  const toggleMode = () => {
    const next = mode === 'pc' ? 'mobile' : 'pc'
    setMode(next)
    localStorage.setItem('infViewMode', next)
  }

  const modeToggle = (
    <div className="flex bg-[#F1F1F4] rounded-lg p-[3px]">
      <button
        onClick={() => mode !== 'pc' && toggleMode()}
        className={`text-[11.5px] px-[11px] py-[5px] rounded-md ${mode === 'pc' ? 'bg-white text-[#17171B] font-bold shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-[#8A8A96] font-semibold'}`}
      >
        PC
      </button>
      <button
        onClick={() => mode !== 'mobile' && toggleMode()}
        className={`text-[11.5px] px-[11px] py-[5px] rounded-md ${mode === 'mobile' ? 'bg-white text-[#17171B] font-bold shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-[#8A8A96] font-semibold'}`}
      >
        모바일
      </button>
    </div>
  )

  if (mode === 'mobile') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="h-[52px] bg-white border-b border-gray-100 flex items-center gap-2 px-4 sticky top-0 z-40">
          <Link href="/influencer/dashboard" className="text-lg font-bold text-[#17171B]">
            MatchPost
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {modeToggle}
            <LogoutButton />
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-5 pb-24 space-y-6">{children}</main>
        <nav className="fixed bottom-0 left-0 right-0 h-[58px] bg-white border-t border-gray-100 flex items-center z-40">
          {MOBILE_TABS.map((t) => {
            const active = isActive(t.href)
            const b = t.badge ? badgeVal(t.badge) : 0
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex-1 h-full flex flex-col items-center justify-center gap-0.5 relative ${
                  active ? 'text-[#F59E0B]' : 'text-[#9A9AA5]'
                }`}
              >
                <t.Icon size={17} strokeWidth={active ? 2.25 : 1.75} />
                <span className="text-[10.5px] font-medium">{t.label}</span>
                {b > 0 && (
                  <span className="absolute top-1.5 right-[26%] w-[15px] h-[15px] text-[9px] font-bold bg-[#EF4444] text-white rounded-full flex items-center justify-center">
                    {b}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    )
  }

  // ── PC 버전 ──
  return (
    <div className="flex min-h-screen min-w-[1360px] bg-[#F6F6F7] text-[#1A1A1F]">
      <aside className="w-[236px] shrink-0 bg-white border-r border-[#EAEAEE] sticky top-0 h-screen flex flex-col">
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
        <nav className="flex flex-col gap-0.5 p-3">
          <div className="text-[10px] font-bold text-[#B0B0BB] tracking-[0.06em] px-2.5 pt-2 pb-1.5">활동</div>
          {PC_NAV.map((n) => {
            const b = badgeVal(n.badge)
            const active = isActive(n.href)
            return (
              <Link
                key={n.href}
                href={n.href}
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
        </nav>
        <div className="mt-auto border-t border-[#F1F1F4] px-4 py-3.5 flex flex-col gap-2.5">
          <Link href="/credits" className="block hover:opacity-80">
            <div className="text-[11px] text-[#9A9AA5] leading-relaxed">보유 크레딧</div>
            <div className="text-base font-extrabold tracking-[-0.02em] mt-0.5">
              {creditBalance === null ? '—' : creditBalance.toLocaleString()}
              <span className="text-xs font-semibold text-[#F59E0B]"> C</span>
            </div>
            <div className="text-[10px] text-[#B0B0BB] mt-0.5">오픈 등록 1건당 {creditAmount('open_schedule').toLocaleString()}C</div>
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
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-[-0.01em]">{name}</span>
            <MatchScore score={matchScore} reviewCount={reviewCount} />
            {blogGrade && (
              <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309]">
                블로그 {blogGrade}
              </span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            {modeToggle}
            <Link
              href="/influencer/notifications"
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
        <main className="inf-pc flex-1 flex flex-col gap-5 pt-[26px] px-7 pb-10">{children}</main>
      </div>
    </div>
  )
}
