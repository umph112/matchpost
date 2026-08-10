import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { initial } from '@/lib/initial'

export const dynamic = 'force-dynamic'

// 인플루언서 대화 목록 — 전부 1:1이다(D6 A1). 옛 ?receiverId= 링크(알림함에 저장된 것 포함)는
// 그 자리에서 conversation을 찾거나 만들어 새 라우트로 넘겨준다.
export default async function InfluencerMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ receiverId?: string; proposalId?: string }>
}) {
  const { receiverId } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (receiverId) {
    const db = createServiceClient()
    const { data: convId } = await db.rpc('get_or_create_conversation', {
      p_advertiser_id: receiverId, p_kind: 'personal', p_campaign_id: null, p_other_id: user.id,
    })
    redirect(`/influencer/messages/${convId}`)
  }

  const { data: msgs } = await supabase
    .from('messages')
    .select('sender_id, receiver_id, content, is_read, created_at')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  const grouped: Record<string, { last: any; unread: boolean }> = {}
  for (const m of msgs ?? []) {
    const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id
    if (!grouped[otherId]) grouped[otherId] = { last: m, unread: false }
    if (m.receiver_id === user.id && !m.is_read) grouped[otherId].unread = true
  }

  const otherIds = Object.keys(grouped)
  const { data: profiles } = otherIds.length
    ? await supabase.from('profiles').select('id, name').in('id', otherIds)
    : { data: [] }
  const nameById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.name]))

  const db = createServiceClient()
  const rows = await Promise.all(
    otherIds.map(async (oid) => {
      const { data: convId } = await db.rpc('get_or_create_conversation', {
        p_advertiser_id: oid, p_kind: 'personal', p_campaign_id: null, p_other_id: user.id,
      })
      return { convId: convId as string, otherId: oid, name: nameById[oid] ?? '광고주', ...grouped[oid] }
    })
  )
  rows.sort((a, b) => (b.last?.created_at ?? '').localeCompare(a.last?.created_at ?? ''))

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center mb-8">
        <Link href="/influencer/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">← 뒤로</Link>
        <h1 className="text-xl font-bold text-gray-900">대화</h1>
      </div>

      {rows.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">💬</div>
          <p className="text-gray-500">아직 대화가 없어요</p>
        </div>
      )}

      {rows.map((r) => (
        <Link
          key={r.convId}
          href={`/influencer/messages/${r.convId}`}
          className="w-full bg-white rounded-2xl p-4 shadow-sm mb-3 flex items-center hover:shadow-md transition text-left"
        >
          <div className="w-11 h-11 bg-[#FEF3C7] rounded-full flex items-center justify-center text-[#B45309] font-bold mr-3">
            {initial(r.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800">{r.name}</p>
            <p className="text-sm text-gray-400 truncate">{r.last?.content}</p>
          </div>
          <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
            {r.unread && <span className="text-[10.5px] font-bold bg-red-100 text-red-500 px-2 py-0.5 rounded-full">미응답</span>}
            <p className="text-xs text-gray-300">{r.last ? new Date(r.last.created_at).toLocaleDateString('ko-KR') : ''}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}
