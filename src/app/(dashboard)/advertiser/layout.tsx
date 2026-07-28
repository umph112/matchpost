import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdvertiserShell from '@/components/AdvertiserShell'

// 광고주 전용 데스크탑 셸 레이아웃 (모든 /advertiser/* 페이지를 감쌈)
export default async function AdvertiserLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adv } = await supabase.from('advertiser_profiles').select('company_name').eq('user_id', user.id).single()
  const { data: prof } = await supabase.from('profiles').select('name').eq('id', user.id).single()
  const name = adv?.company_name || prof?.name || '광고주'

  return <AdvertiserShell name={name}>{children}</AdvertiserShell>
}
