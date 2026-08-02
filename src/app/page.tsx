import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import HomeCalendar from '@/components/HomeCalendar'

export const dynamic = 'force-dynamic'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default async function HomePage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const start = `${year}-${pad(month)}-01`
  const end = `${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 오픈(인플루언서 일정)
  const { data: opens } = await supabase
    .from('schedules')
    .select('date')
    .eq('is_public', true)
    .eq('status', 'open')
    .gte('date', start)
    .lte('date', end)

  // 캠페인(광고주) — 테이블 없으면 error로 빈 배열 처리
  const { data: campsData, error: campErr } = await supabase
    .from('campaigns')
    .select('date')
    .eq('is_public', true)
    .eq('status', 'open')
    .gte('date', start)
    .lte('date', end)
  const camps = campErr ? [] : campsData ?? []

  const countsByDate: Record<string, { open: number; campaign: number }> = {}
  for (const r of opens ?? []) {
    ;(countsByDate[r.date as string] ??= { open: 0, campaign: 0 }).open++
  }
  for (const r of camps) {
    ;(countsByDate[(r as { date: string }).date] ??= { open: 0, campaign: 0 }).campaign++
  }

  const totalOpen = (opens ?? []).length
  const totalCampaign = camps.length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단바 */}
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-[#17171B]">
            MatchPost
          </Link>
          {user ? (
            <Link
              href="/influencer/dashboard"
              className="text-sm font-medium text-gray-600 hover:text-[#B45309]"
            >
              내 대시보드 →
            </Link>
          ) : (
            <div className="flex gap-2">
              <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-[#B45309] px-3 py-1.5">
                로그인
              </Link>
              <Link
                href="/signup"
                className="text-sm font-medium bg-[#F59E0B] text-white rounded-lg px-3 py-1.5 hover:bg-[#D97706]"
              >
                시작하기
              </Link>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* 이달 요약 */}
        <div className="mb-4">
          <h1 className="text-lg font-bold text-gray-900">이달의 매칭 캘린더</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            이번 달 <span className="text-amber-600 font-medium">캠페인 {totalCampaign}</span> ·{' '}
            <span className="text-blue-600 font-medium">오픈 {totalOpen}</span>
          </p>
        </div>

        {/* 달력 */}
        <HomeCalendar year={year} month={month} countsByDate={countsByDate} isLoggedIn={!!user} />

        {!user && (
          <p className="text-center text-xs text-gray-400 mt-3">
            날짜를 누르면 그날의 캠페인·오픈 일정을 볼 수 있어요 (로그인 필요)
          </p>
        )}

        {/* 하단: 공지 · 최신 동향 */}
        <section className="mt-8">
          <h2 className="text-sm font-bold text-gray-800 mb-3">📢 공지사항</h2>
          <div className="bg-white rounded-2xl p-4 shadow-sm text-sm text-gray-500">
            등록된 공지가 없어요.
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-bold text-gray-800 mb-3">✨ 매치포스트 최신 동향</h2>
          <div className="bg-white rounded-2xl p-4 shadow-sm text-sm text-gray-500">
            곧 다양한 소식으로 찾아올게요.
          </div>
        </section>
      </main>
    </div>
  )
}
