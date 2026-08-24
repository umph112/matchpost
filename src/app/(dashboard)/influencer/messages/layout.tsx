import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import ConversationList, { type ConvRow } from '@/components/messages/ConversationList'
import MessagesSplit from '@/components/messages/MessagesSplit'
import { listDateLabel } from '@/lib/date'

export const dynamic = 'force-dynamic'

// D7 3-1 — 인플루언서는 전부 1:1(D6 A1)이라 탭 없이 목록만.
// 사이드바·헤더(프로필·매치스코어·블로그등급·배지)는 influencer/layout.tsx 가 씌운다.
// 여기서 같은 값을 다시 조회하던 네 건은 걷어냈다 — 셸이 이미 갖고 있다.
export default async function InfluencerMessagesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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

  // D10 §1-2 — 단계 배지: 내 제안들을 광고주별로 묶어 가장 앞선 확정 단계로.
  const { data: myProposals } = otherIds.length
    ? await supabase.from('proposals').select('advertiser_id, advertiser_confirmed, influencer_confirmed').eq('influencer_id', user.id)
    : { data: [] }
  const stageOf = (list: { advertiser_confirmed?: boolean; influencer_confirmed?: boolean }[]): 'talking' | 'inner' | 'both' => {
    let best: 'talking' | 'inner' | 'both' = 'talking'
    for (const p of list) {
      const a = !!p.advertiser_confirmed, i = !!p.influencer_confirmed
      if (a && i) return 'both'
      if (a || i) best = 'inner'
    }
    return best
  }
  const personalStage: Record<string, 'talking' | 'inner' | 'both'> = {}
  for (const oid of otherIds) personalStage[oid] = stageOf((myProposals ?? []).filter((p) => p.advertiser_id === oid))

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
        stage: personalStage[oid],
      }
    })
  )
  personalRows.sort((a, b) => b.time.localeCompare(a.time))

  // 셸은 influencer/layout.tsx 가 씌운다(여기서 또 부르면 두 겹).
  // 3단(사이드바 · 대화목록 · 대화)의 바깥 한 단은 셸이, 안쪽 두 단은 MessagesSplit 이 맡는다.
  return (
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
  )
}
