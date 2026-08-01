import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TopBar from '@/components/TopBar'
import { BlogAnalyticsFull } from '@/components/BlogAnalyticsCard'

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

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar name={profile?.name} />

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* 뒤로가기 */}
        <Link href="/influencer/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition">
          ← 대시보드
        </Link>

        <h1 className="text-lg font-bold text-gray-900">내 채널 분석</h1>

        <BlogAnalyticsFull data={blogAnalytics} />

        {!blogAnalytics?.blog_id && (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-2">
            <p className="text-gray-500">아직 블로그 분석 데이터가 없어요.</p>
            <p className="text-sm text-gray-400">
              프로필에서 네이버 블로그 URL을 등록하면 매일 자동으로 분석됩니다.
            </p>
            <Link
              href="/influencer/profile"
              className="inline-block mt-2 text-sm text-blue-600 hover:underline"
            >
              프로필 설정하기 →
            </Link>
          </div>
        )}

        <p className="text-[11px] text-gray-400 text-center pb-4">
          분석 데이터는 매일 자동 수집됩니다 · 광고주에게도 공개됩니다
        </p>
      </main>
    </div>
  )
}
