import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/TopBar'
import { BlogAnalyticsFull } from '@/components/BlogAnalyticsCard'
import { firstReportLabel } from '@/lib/blogAnalyzer/schedule'

export const dynamic = 'force-dynamic'

export default async function ChannelAnalyticsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, status')
    .eq('id', user.id)
    .single()

  if (profile?.status === 'pending') redirect('/pending')
  if (profile?.role !== 'influencer') redirect('/login')

  const { data: blogAnalytics } = await supabase
    .from('blog_analytics')
    .select('*')
    .eq('user_id', user.id)
    .order('crawled_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // D25 §2 — 빈 화면을 두 갈래로 나누기 위해 "URL을 등록했는지"를 따로 본다.
  // 등록한 사람에게 「채널을 등록하세요」가 뜨면 등록이 안 된 줄 알고 같은 일을 반복하게 된다.
  const { data: infProfile } = await supabase
    .from('influencer_profiles')
    .select('blog_url')
    .eq('user_id', user.id)
    .maybeSingle()
  const hasBlogUrl = !!infProfile?.blog_url?.trim()

  // D25 §3 — 첫 리포트는 얇다. 며칠치가 쌓였는지로 판단(1일차면 전일 대비 값이 아직 없다).
  const { count: historyCount } = await supabase
    .from('blog_analytics_history')
    .select('crawled_on', { count: 'exact', head: true })
    .eq('user_id', user.id)
  const isFirstReport = !!blogAnalytics?.blog_id && (historyCount ?? 0) <= 1
  const missingMetrics = (blogAnalytics?.missing_metrics as number | null) ?? 0

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar name={profile?.name} />

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 [.inf-pc_&]:max-w-none [.inf-pc_&]:px-0 [.inf-pc_&]:py-0">
        {/* 뒤로가기 */}
        <Link href="/influencer/dashboard" className="hidden [.inf-pc_&]:inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition">
          ← 대시보드
        </Link>

        <h1 className="text-lg font-bold text-gray-900">내 채널 분석</h1>

        <BlogAnalyticsFull data={blogAnalytics} />

        {/* D25 §3 — 첫 리포트에 빠진 값이 "고장"으로 보이지 않게, 왜 없는지만 덧붙인다.
            등급은 감추지 않는다 — 낮게라도 보여주고 바뀔 수 있다고 말하는 편이 낫다. */}
        {isFirstReport && (
          <div className="space-y-1 px-1">
            <p className="text-[11px] text-[#9A9AA5] leading-relaxed">
              방문자 증감은 내일부터 보여요 — 어제와 비교해야 하는 값이에요.
            </p>
            {missingMetrics > 0 && (
              <p className="text-[11px] text-[#9A9AA5] leading-relaxed">
                아직 모이지 않은 지표 {missingMetrics}개가 있어 등급이 바뀔 수 있어요.
              </p>
            )}
          </div>
        )}

        {!blogAnalytics?.blog_id &&
          (hasBlogUrl ? (
            // 등록은 끝났고 밤 10시 배치를 기다리는 중 — 할 일이 남은 것처럼 보이면 안 된다
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <BarChart3 size={32} strokeWidth={1.5} className="mx-auto text-[#C4C4CE]" />
              <p className="mt-3 text-sm font-bold text-[#3C3C46]">첫 리포트를 준비하고 있어요</p>
              <p className="mt-1.5 text-[11.5px] text-[#9A9AA5] leading-relaxed">
                {firstReportLabel()}에 만들어집니다. 매일 밤 10시에 갱신돼요.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-2">
              <p className="text-gray-500">채널을 등록하면 분석이 시작돼요.</p>
              <p className="text-sm text-gray-400">
                프로필에서 네이버 블로그 URL을 등록하면 매일 밤 10시에 자동으로 분석됩니다.
              </p>
              <Link
                href="/influencer/profile"
                className="inline-block mt-2 text-sm text-[#B45309] hover:underline"
              >
                프로필 설정하기 →
              </Link>
            </div>
          ))}

        <p className="text-[11px] text-gray-400 text-center pb-4">
          분석 데이터는 매일 자동 수집됩니다 · 광고주에게도 공개됩니다
        </p>
      </main>
    </div>
  )
}
