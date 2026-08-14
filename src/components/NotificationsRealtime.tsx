'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bell } from 'lucide-react'

// 내 알림 새 행이 들어오면 서버 컴포넌트를 새로고침(router.refresh) → 배너·알림함 자동 갱신
export default function NotificationsRealtime({ userId }: { userId: string }) {
  const router = useRouter()
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notif-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as { title?: string }
          setToast(n?.title ?? '새 알림이 도착했어요')
          router.refresh()
          setTimeout(() => setToast(null), 3500)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, router])

  if (!toast) return null

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-[90%]">
      <div className="bg-gray-900 text-white text-sm px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
        <span><Bell size={16} strokeWidth={1.75} /></span>
        <span className="truncate">{toast}</span>
      </div>
    </div>
  )
}
