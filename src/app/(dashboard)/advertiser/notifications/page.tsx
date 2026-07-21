'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const ICON: Record<string, string> = {
  campaign_created: '📣', campaign_updated: '📝', campaign_completed: '✅', campaign_cancelled: '🚫',
  open_created: '📅', open_completed: '✅', open_cancelled: '🚫',
  deal_made: '🤝', dash_received: '💬', settlement_due: '💰',
  deal_confirm_request: '⏳', deal_confirm_self: '☑️',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return new Date(iso).toLocaleDateString('ko-KR')
}

export default function AdvertiserNotificationsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const markAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    load()
  }

  const openItem = async (n: any) => {
    if (!n.is_read) await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
    if (n.link) router.push(n.link)
    else load()
  }

  const unread = items.filter((n) => !n.is_read).length

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href="/advertiser/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">← 뒤로</Link>
          <h1 className="text-xl font-bold text-gray-900">알림</h1>
          {unread > 0 && <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">{unread}</span>}
        </div>
        {unread > 0 && <button onClick={markAllRead} className="text-sm text-amber-600 hover:underline">모두 읽음</button>}
      </div>

      {loading && <p className="text-center text-gray-400 py-16">불러오는 중...</p>}
      {!loading && items.length === 0 && (
        <div className="text-center py-16"><div className="text-5xl mb-4">🔔</div><p className="text-gray-500">아직 알림이 없어요</p></div>
      )}

      <div className="space-y-2">
        {items.map((n) => (
          <button key={n.id} onClick={() => openItem(n)}
            className={`w-full text-left flex items-start gap-3 rounded-2xl p-4 shadow-sm transition ${n.is_read ? 'bg-white' : 'bg-amber-50 hover:bg-amber-100'}`}>
            <span className="text-xl shrink-0">{ICON[n.type] ?? '🔔'}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${n.is_read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title}</p>
              {n.body && <p className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</p>}
              <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
            </div>
            {!n.is_read && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />}
          </button>
        ))}
      </div>
    </div>
  )
}
