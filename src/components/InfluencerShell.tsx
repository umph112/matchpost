'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Home, CalendarDays, MessageSquare, BarChart3, Wallet, Search, Bell, ChevronLeft } from 'lucide-react'
import LogoutButton from './LogoutButton'
import MatchScore from './MatchScore'
import Logo from './Logo'
import { creditAmount } from '@/lib/creditConfig'
import { initial } from '@/lib/initial'

// 인플루언서 셸 — 광고주 AdvertiserShell과 같은 PC/모바일 자동 감지 패턴(D7 4-8, 토글 없음).
// influencer/layout.tsx 가 /influencer/** 전체에 씌운다 — 페이지에서 이걸 직접 부르면 두 겹이 된다.
// (전에는 dashboard·messages 두 곳만 직접 불렀고, 나머지 9개 화면은 사이드바도 [.inf-pc_&] 변형도 없었다.)
const MOBILE_TABS = [
  { href: '/influencer/dashboard', label: '홈', Icon: Home },
  { href: '/influencer/schedule/list', label: '오픈', Icon: CalendarDays },
  { href: '/influencer/messages', label: '대시', Icon: MessageSquare, badge: 'msg' as const },
  // D31 8절 — 「내 채널」 자리에 「캠페인 찾기」. 인플루언서에게 가장 중요한 건 일을 찾는 것이고,
  // 내 채널은 밤 10시 배치라 하루 한 번 갱신된다(매일 볼 화면이 아니다 — 홈 카드로 들어간다).
  { href: '/influencer/search', label: '캠페인 찾기', Icon: Search },
  { href: '/influencer/earnings', label: '매출', Icon: Wallet },
]

// D31 4절 — 모바일 상단바의 「현재 화면 이름」과 뒤로가기가 갈 곳.
// 하위 화면의 상위는 「어디서 왔든 같은 곳」으로 고정한다 — back() 은 온 길에 따라 달라져 예측할 수 없다.
// 이름은 하단 탭 라벨과 같은 말을 쓴다(홈·오픈·대시·캠페인 찾기·매출) — 다른 말을 쓰면 같은 곳인지 알 수 없다.
const SCREENS: { match: (p: string) => boolean; title: string; parent?: string }[] = [
  { match: (p) => p === '/influencer/dashboard', title: '홈' },
  { match: (p) => p === '/influencer/schedule/list', title: '오픈' },
  { match: (p) => p === '/influencer/messages', title: '대시' },
  { match: (p) => p === '/influencer/search', title: '캠페인 찾기' },
  { match: (p) => p === '/influencer/earnings', title: '매출' },
  { match: (p) => p === '/influencer/schedule', title: '오픈 등록', parent: '/influencer/schedule/list' },
  { match: (p) => p.startsWith('/influencer/schedule/'), title: '오픈 상세', parent: '/influencer/schedule/list' },
  { match: (p) => p.startsWith('/influencer/messages/'), title: '대화', parent: '/influencer/messages' },
  // 딜시트만 예외 — 뒤로가기를 셸이 갖지 않는다(parent 없음).
  // DealSheet 안 빵부스러기가 데이터를 보고 갈라진다: 오픈에서 온 딜이면 「이 날 일정」으로 돌아간다.
  // 셸은 화면 이름만 알 뿐 그 협업이 오픈에서 왔는지 캠페인에서 왔는지 모른다 —
  // 여기서 받은 대시로 보내면 방금 보던 하루 일정에서 튕겨 나간다.
  { match: (p) => p.startsWith('/influencer/deals/'), title: '딜시트' },
  { match: (p) => p === '/influencer/proposals', title: '받은 대시', parent: '/influencer/messages' },
  { match: (p) => p === '/influencer/channel-analytics', title: '내 채널 분석', parent: '/influencer/dashboard' },
  { match: (p) => p === '/influencer/profile', title: '내 정보 수정', parent: '/influencer/dashboard' },
  { match: (p) => p === '/influencer/notifications', title: '알림', parent: '/influencer/dashboard' },
]
const screenOf = (p: string) => SCREENS.find((s) => s.match(p))

// D31 2절 — 누른 즉시 「먹었다」를 보여준다.
// pathname 은 화면이 실제로 바뀐 뒤에야 바뀐다 — 그게 3초 뒤였고, 그동안 탭은 아무 반응이 없었다.
// useLinkStatus 는 Link 의 자손에서만 읽을 수 있어서 안쪽을 따로 뺐다.
function TabInner({
  Icon,
  label,
  active,
  badge,
}: {
  Icon: typeof Home
  label: string
  active: boolean
  badge: number
}) {
  const { pending } = useLinkStatus()
  const on = active || pending
  return (
    <span className={`w-full h-full flex flex-col items-center justify-center gap-0.5 relative transition-colors ${on ? 'text-[#F59E0B]' : 'text-[#9A9AA5]'}`}>
      <Icon size={17} strokeWidth={on ? 2.25 : 1.75} />
      <span className={`text-[10.5px] ${on ? 'font-bold' : 'font-medium'}`}>{label}</span>
      {badge > 0 && (
        <span className="absolute top-1.5 right-[26%] w-[15px] h-[15px] text-[9px] font-bold bg-[#EF4444] text-white rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}
    </span>
  )
}
const TAB_HREFS = new Set(['/influencer/dashboard', '/influencer/schedule/list', '/influencer/messages', '/influencer/search', '/influencer/earnings'])
const LAST_TAB_KEY = 'inf:lastTab'

const PC_NAV_GROUPS: {
  group: string
  items: { href: string; label: string; Icon: typeof Home; badge?: 'msg' | 'notif' }[]
}[] = [
  {
    group: '일정 열기',
    items: [
      { href: '/influencer/dashboard', label: '홈', Icon: Home },
      { href: '/influencer/schedule/list', label: '오픈 일정', Icon: CalendarDays },
    ],
  },
  {
    group: '기회 찾기',
    items: [{ href: '/influencer/search', label: '캠페인 찾기', Icon: Search }],
  },
  {
    group: '이야기하기',
    items: [{ href: '/influencer/messages', label: '대시', Icon: MessageSquare, badge: 'msg' }],
  },
  {
    group: '성과 보기',
    items: [
      { href: '/influencer/channel-analytics', label: '내 채널', Icon: BarChart3 },
      { href: '/influencer/earnings', label: '매출', Icon: Wallet },
    ],
  },
  {
    group: '계정',
    items: [{ href: '/influencer/notifications', label: '알림', Icon: Bell, badge: 'notif' }],
  },
]

export default function InfluencerShell({
  name,
  sub = '인플루언서 콘솔',
  matchScore,
  reviewCount = 0,
  blogGrade,
  msgCount = 0,
  notifCount = 0,
  children,
}: {
  name: string
  sub?: string
  matchScore: number | null
  reviewCount?: number
  blogGrade?: string | null
  msgCount?: number
  notifCount?: number
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const fullBleed = pathname.startsWith('/influencer/messages')
  const [mode, setMode] = useState<'pc' | 'mobile'>('mobile')
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const badgeVal = (key?: 'msg' | 'notif') => (key === 'msg' ? msgCount : key === 'notif' ? notifCount : 0)
  const [subLine1, subLine2] = sub.split(' · ')

  // D31 4절 — 탭에서의 뒤로가기는 「직전에 있던 탭」. 이력 전체가 아니라 하나만 담아둔다.
  // 셸은 layout 이라 화면을 옮겨도 살아 있지만 새로고침에는 죽는다 — sessionStorage 로 받친다.
  const [prevTab, setPrevTab] = useState<string | null>(null)
  useEffect(() => {
    if (!TAB_HREFS.has(pathname)) return
    const stored = sessionStorage.getItem(LAST_TAB_KEY)
    // 첫 화면이거나 같은 탭으로 되돌아온 것이면 갈 곳이 없다 — 뒤로가기를 감춘다
    setPrevTab(stored && stored !== pathname ? stored : null)
    sessionStorage.setItem(LAST_TAB_KEY, pathname)
  }, [pathname])

  const screen = screenOf(pathname)
  const backHref = screen?.parent ?? (TAB_HREFS.has(pathname) ? prevTab : null)

  useEffect(() => {
    const detectMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    setMode(detectMobile() ? 'mobile' : 'pc')
  }, [])

  useEffect(() => {
    fetch('/api/credits/balance')
      .then((r) => r.json())
      .then((d) => setCreditBalance(d.balance ?? 0))
      .catch(() => {})
  }, [])

  if (mode === 'mobile') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* D31 4절 — [←] 로고 | 현재 화면 이름 … [계정].
            높이 52px 은 아래 main 의 h-calc 이 그대로 쓴다 — 바꾸려면 두 곳을 같이 바꿔야 한다. */}
        <header className="h-[52px] bg-white border-b border-gray-100 flex items-center px-1.5 sticky top-0 z-40">
          {backHref ? (
            <Link
              href={backHref}
              aria-label="뒤로"
              className="w-11 h-11 shrink-0 flex items-center justify-center text-[#5C5C68] active:bg-[#F6F6F7] rounded-lg"
            >
              <ChevronLeft size={20} strokeWidth={2} />
            </Link>
          ) : (
            <div className="w-[10px] shrink-0" />
          )}
          <Link href="/influencer/dashboard" className="shrink-0 flex items-center" aria-label="MATCHPOST 홈">
            <Logo size={20} markOnly />
          </Link>
          {screen && (
            <>
              <span aria-hidden className="shrink-0 w-px h-[14px] bg-[#EAEAEE] mx-[9px]" />
              <span className="min-w-0 truncate text-[13px] font-bold text-[#17171B] tracking-[-0.01em]">
                {screen.title}
              </span>
            </>
          )}
          <div className="ml-auto flex items-center gap-2 pr-2.5 pl-2">
            <div className="w-7 h-7 shrink-0 rounded-full bg-[#FEF3C7] text-[#B45309] text-[11.5px] font-extrabold flex items-center justify-center">
              {initial(name)}
            </div>
            <LogoutButton />
          </div>
        </header>
        <main className={fullBleed ? 'h-[calc(100vh-52px-58px)] flex flex-col' : 'max-w-lg mx-auto px-4 py-5 pb-24 space-y-6'}>{children}</main>
        <nav className="fixed bottom-0 left-0 right-0 h-[58px] bg-white border-t border-gray-100 flex items-center z-40">
          {MOBILE_TABS.map((t) => (
            // prefetch="auto" — 다음 화면 「코드」를 미리 받아둔다.
            // 이 라우트들은 전부 동적이라 auto 는 loading.tsx 경계까지만 가져온다(데이터는 안 건드린다).
            // true 로 두면 화면을 열 때마다 탭 다섯 곳의 서버 렌더가 같이 돌아간다.
            <Link key={t.href} href={t.href} prefetch="auto" className="flex-1 h-full active:bg-[#FAFAFB]">
              <TabInner Icon={t.Icon} label={t.label} active={isActive(t.href)} badge={t.badge ? badgeVal(t.badge) : 0} />
            </Link>
          ))}
        </nav>
      </div>
    )
  }

  // ── PC 버전 ──
  return (
    <div className="flex min-h-screen min-w-[1360px] bg-[#F6F6F7] text-[#1A1A1F]">
      <aside className="w-[236px] shrink-0 bg-white border-r border-[#EAEAEE] sticky top-0 h-screen flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-[#F1F1F4]">
          <Logo size={19} />
        </div>
        <nav className="flex flex-col gap-0.5 p-3">
          {PC_NAV_GROUPS.map((g) => (
            <div key={g.group}>
              <div className="text-[10px] font-bold text-[#B0B0BB] tracking-[0.06em] px-2.5 pt-2.5 pb-1.5">{g.group}</div>
              {g.items.map((n) => {
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
            </div>
          ))}
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
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-[-0.01em]">{subLine1}</span>
            {subLine2 && <span className="text-[11px] text-[#9A9AA5] mt-px">{subLine2}</span>}
          </div>
          <div className="ml-auto flex items-center gap-2.5">
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
            <MatchScore score={matchScore} reviewCount={reviewCount} />
            {blogGrade && (
              <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309]">
                블로그 {blogGrade}
              </span>
            )}
            <span className="text-[13px] font-semibold text-[#3C3C46] max-w-[120px] truncate">{name}</span>
            <div className="w-[34px] h-[34px] rounded-full bg-[#FEF3C7] text-[#B45309] text-[13px] font-extrabold flex items-center justify-center shrink-0">
              {initial(name)}
            </div>
            <LogoutButton />
          </div>
        </header>
        <main className="inf-pc flex-1 flex flex-col gap-[14px] pt-[26px] px-7 pb-10">{children}</main>
      </div>
    </div>
  )
}
