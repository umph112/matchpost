'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { listTime } from '@/lib/date'
import { Megaphone, PencilLine, CircleCheck, CircleSlash, CalendarDays, Handshake, MessageSquare, Wallet, Clock, SquareCheck, Bell, type LucideIcon } from 'lucide-react'

const ICON: Record<string, { Comp: LucideIcon; className: string }> = {
  campaign_created: { Comp: Megaphone, className: '' },
  campaign_updated: { Comp: PencilLine, className: '' },
  campaign_completed: { Comp: CircleCheck, className: 'text-[#15803D]' },
  campaign_cancelled: { Comp: CircleSlash, className: 'text-[#9A9AA5]' },
  open_created: { Comp: CalendarDays, className: 'text-[#3B82F6]' },
  open_completed: { Comp: CircleCheck, className: 'text-[#15803D]' },
  open_cancelled: { Comp: CircleSlash, className: 'text-[#9A9AA5]' },
  deal_made: { Comp: Handshake, className: 'text-[#15803D]' },
  dash_received: { Comp: MessageSquare, className: 'text-[#F59E0B]' },
  settlement_due: { Comp: Wallet, className: 'text-[#F59E0B]' },
  deal_confirm_request: { Comp: Clock, className: 'text-[#F59E0B]' },
  deal_confirm_self: { Comp: SquareCheck, className: '' },
  // D32 2절 — 광고주가 지원을 반려했을 때. 나쁜 소식이라 색은 빼고 회색으로 둔다.
  campaign_rejected: { Comp: CircleSlash, className: 'text-[#9A9AA5]' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return listTime(iso)
}

export default function NotificationsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const load = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, link, is_read, state, created_at')
      .eq('user_id', user.id)
      .neq('state', 'done')
      .order('created_at', { ascending: false })
      .limit(100)
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const markAllRead = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications')
      .update({ is_read: true, state: 'read', read_at: new Date().toISOString() })
      .eq('user_id', user.id).eq('is_read', false).neq('state', 'done')
    load()
  }

  const openItem = async (n: any) => {
    if (!n.is_read) {
      await supabase.from('notifications')
        .update({ is_read: true, state: 'read', read_at: new Date().toISOString() })
        .eq('id', n.id).neq('state', 'done')
    }
    if (n.link) router.push(n.link)
    else load()
  }

  const unread = items.filter((n) => !n.is_read).length

  return (
    <div className="max-w-lg mx-auto px-4 py-8 [.inf-pc_&]:max-w-none [.inf-pc_&]:px-0 [.inf-pc_&]:py-0">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href="/influencer/dashboard" className="hidden [.inf-pc_&]:inline-block mr-4 text-gray-400 hover:text-gray-600">
            ← 뒤로
          </Link>
          <h1 className="text-xl font-bold text-gray-900">알림</h1>
          {unread > 0 && (
            <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">{unread}</span>
          )}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-sm text-[#B45309] hover:underline">
            모두 읽음
          </button>
        )}
      </div>

      {loading && <p className="text-center text-gray-400 py-16">불러오는 중...</p>}

      {!loading && items.length === 0 && (
        <div className="text-center py-16">
          <Bell size={32} className="text-[#C4C4CE] mx-auto mb-4" />
          <p className="text-gray-500">아직 알림이 없어요</p>
        </div>
      )}

      <div className="space-y-2">
        {items.map((n) => (
          <button
            key={n.id}
            onClick={() => openItem(n)}
            className={`w-full text-left flex items-start gap-3 rounded-2xl p-4 shadow-sm transition ${
              n.is_read ? 'bg-white' : 'bg-[#FEF3C7] hover:bg-[#FDE68A]'
            }`}
          >
            {(() => { const c = ICON[n.type] ?? { Comp: Bell, className: '' }; const I = c.Comp; return <I size={16} strokeWidth={1.75} className={`shrink-0 mt-0.5 ${c.className}`} /> })()}
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${n.is_read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title}</p>
              {n.body && <p className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</p>}
              <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
            </div>
            {!n.is_read && <span className="w-2 h-2 rounded-full bg-[#F59E0B] shrink-0 mt-1.5" />}
          </button>
        ))}
      </div>
    </div>
  )
}
