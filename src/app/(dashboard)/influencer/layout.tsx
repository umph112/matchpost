import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InfluencerShell from '@/components/InfluencerShell'

export const dynamic = 'force-dynamic'

// 인플루언서 공통 셸 — 화면 12개 전부를 여기서 감싼다.
//
// 왜 레이아웃으로 올렸나.
//   전에는 dashboard/page.tsx 와 messages/layout.tsx 두 곳만 InfluencerShell 을 직접 불렀다.
//   그래서 나머지 9개 화면(매출·오픈·제안·프로필·알림·캠페인찾기·내채널 등)은
//   ① 사이드바가 없어 다른 곳으로 갈 길이 없었고,
//   ② 그 화면들이 써 둔 [.inf-pc_&]: 변형이 전부 죽은 코드였다.
//      inf-pc 클래스는 셸의 <main> 에서만 나오는데 그 조상이 없었기 때문이다.
//      결과: 1440px 화면에서도 내용이 가운데 480px 에 갇혀 있었다.
//   화면마다 손으로 붙이는 방식이면 화면이 늘 때마다 또 빠진다. 그래서 레이아웃이 맞다.
export default async function InfluencerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: ip }, { data: blogAnalytics }, { count: notifCount }, { data: unreadMsgs }] =
    await Promise.all([
      supabase.from('profiles').select('name').eq('id', user.id).single(),
      supabase.from('influencer_profiles').select('match_score, review_count').eq('user_id', user.id).single(),
      supabase
        .from('blog_analytics')
        .select('blog_grade')
        .eq('user_id', user.id)
        .order('crawled_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
      // 배지는 「안 읽은 대화가 몇 개」다. 안 읽은 쪽지 수가 아니라 상대 수로 센다
      // — 걷어낸 두 곳(대시보드·대시 목록)이 둘 다 그렇게 세고 있었다.
      supabase.from('messages').select('sender_id').eq('receiver_id', user.id).eq('is_read', false),
    ])

  const msgCount = new Set((unreadMsgs ?? []).map((m) => m.sender_id)).size
  const now = new Date()

  return (
    <InfluencerShell
      name={profile?.name ?? '인플루언서'}
      sub={`인플루언서 콘솔 · ${now.getFullYear()}년 ${now.getMonth() + 1}월`}
      matchScore={ip?.match_score ?? null}
      reviewCount={ip?.review_count ?? 0}
      blogGrade={blogAnalytics?.blog_grade ?? null}
      msgCount={msgCount}
      notifCount={notifCount ?? 0}
    >
      {children}
    </InfluencerShell>
  )
}
