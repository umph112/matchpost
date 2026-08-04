import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { recordVisit } from '@/lib/visits/track'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  recordVisit(user.id).catch(() => {})

  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}