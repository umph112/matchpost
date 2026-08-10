import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { MessageSquare } from 'lucide-react'

export const dynamic = 'force-dynamic'

// D6 A1/D7 3-1 — 목록은 layout.tsx가 그린다. 여기는 빈 오른쪽 상태 + 옛 ?receiverId= 링크 리다이렉트.
export default async function InfluencerMessagesEmptyPage({
  searchParams,
}: {
  searchParams: Promise<{ receiverId?: string }>
}) {
  const { receiverId } = await searchParams
  if (receiverId) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')
    const db = createServiceClient()
    const { data: convId } = await db.rpc('get_or_create_conversation', {
      p_advertiser_id: receiverId, p_kind: 'personal', p_campaign_id: null, p_other_id: user.id,
    })
    redirect(`/influencer/messages/${convId}`)
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
      <MessageSquare size={32} strokeWidth={1.5} className="text-gray-300 mb-3" />
      <p className="text-gray-400 text-sm">왼쪽에서 대화를 골라주세요</p>
    </div>
  )
}
