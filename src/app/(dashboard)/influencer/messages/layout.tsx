import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import InfluencerShell from '@/components/InfluencerShell'
import ConversationList, { type ConvRow } from '@/components/messages/ConversationList'
import MessagesSplit from '@/components/messages/MessagesSplit'
import { listDateLabel } from '@/lib/date'

export const dynamic = 'force-dynamic'

// D7 3-1 — 인플루언서는 전부 1:1(D6 A1)이라 탭 없이 목록만. InfluencerShell로 감싸서
// 대시 페이지도 PC 2단 골격(홈과 같은 사이드바·헤더)을 갖게 한다.
export default async function InfluencerMessagesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
  const { data: ip } = await supabase.from('influencer_profiles').select('match_score, review_count').eq('user_id', user.id).single()
  const { data: blogAnalytics } = await supabase
    .from('blog_analytics').select('blog_grade').eq('user_id', user.id).order('crawled_at', { ascending: false }).limit(1).maybeSingle()
  const { count: unreadNotif } = await supabase
    .from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false)

  const { data: msgs } = await supabase
    .from('messages')
    .select('sender_id, receiver_id, content, is_read, created_at')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  type Preview = { last: { content: string; created_at: string; sender_id: string } | null; unreadCount: number }
  const grouped: Record<string, Preview> = {}
  for (const m of msgs ?? []) {
    const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id
    if (!grouped[otherId]) grouped[otherId] = { last: m, unreadCount: 0 }
    if (m.receiver_id === user.id && !m.is_read) grouped[otherId].unreadCount++
  }
  const otherIds = Object.keys(grouped)
  const { data: profiles } = otherIds.length
    ? await supabase.from('profiles').select('id, name').in('id', otherIds)
    : { data: [] }
  const nameById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.name]))

  const db = createServiceClient()
  const OVERDUE_MS = 2 * 24 * 60 * 60 * 1000
  const personalRows: (ConvRow & { time: string })[] = await Promise.all(
    otherIds.map(async (oid) => {
      const { data: convId } = await db.rpc('get_or_create_conversation', {
        p_advertiser_id: oid, p_kind: 'personal', p_campaign_id: null, p_other_id: user.id,
      })
      const p = grouped[oid]
      return {
        convId: convId as string,
        title: nameById[oid] ?? '광고주',
        subtitle: p.last?.content || null,
        time: p.last?.created_at ?? '',
        timeLabel: p.last?.created_at ? listDateLabel(p.last.created_at) : '',
        unreadCount: p.unreadCount,
        overdue: !!(p.last && p.last.sender_id !== user.id && Date.now() - new Date(p.last.created_at).getTime() >= OVERDUE_MS),
      }
    })
  )
  personalRows.sort((a, b) => b.time.localeCompare(a.time))
  const msgUnreadCount = personalRows.filter((r) => r.unreadCount > 0).length

  return (
    <InfluencerShell
      name={profile?.name ?? '인플루언서'}
      sub={`인플루언서 콘솔 · ${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월`}
      matchScore={ip?.match_score ?? null}
      reviewCount={ip?.review_count ?? 0}
      blogGrade={blogAnalytics?.blog_grade ?? null}
      msgCount={msgUnreadCount}
      notifCount={unreadNotif ?? 0}
    >
      <div className="flex flex-col gap-3 h-full">
        <h1 className="text-lg font-bold text-gray-900 [.inf-pc_&]:text-[19px] [.inf-pc_&]:font-extrabold px-1 pt-3 [.inf-pc_&]:pt-0">대시</h1>
        <MessagesSplit
          basePath="/influencer/messages"
          pcClass="inf-pc"
          list={
            <ConversationList
              hrefPrefix="/influencer/messages/"
              personalRows={personalRows}
              emptyActionHref="/influencer/schedule"
              emptyActionLabel="오픈 일정 열기"
            />
          }
        >
          {children}
        </MessagesSplit>
      </div>
    </InfluencerShell>
  )
}
