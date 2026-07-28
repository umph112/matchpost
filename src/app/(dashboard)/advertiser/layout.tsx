import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdvertiserShell from '@/components/AdvertiserShell'

// 광고주 전용 데스크탑 셸 레이아웃 (모든 /advertiser/* 페이지를 감쌈)
// 사이드바/상단바에 쓸 요약값(집행 예정액·미확인 카운트)을 계산해 셸에 전달.
export default async function AdvertiserLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adv } = await supabase.from('advertiser_profiles').select('company_name').eq('user_id', user.id).single()
  const { data: prof } = await supabase.from('profiles').select('name').eq('id', user.id).single()
  const name = adv?.company_name || prof?.name || '광고주'

  // 확정 집행 예정액 (양쪽 확정된 제안의 예산 합)
  const { data: props } = await supabase
    .from('proposals')
    .select('budget, advertiser_confirmed, influencer_confirmed')
    .eq('advertiser_id', user.id)
  let spend = 0
  for (const p of props ?? []) if (p.advertiser_confirmed && p.influencer_confirmed) spend += p.budget || 0

  // 미읽음 알림
  const { count: notifCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  // 내 응답 대기 대화 수 (최근 메시지가 나에게 온 대화)
  const { data: msgs } = await supabase
    .from('messages')
    .select('sender_id, receiver_id, created_at')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(80)
  const seen = new Set<string>()
  let msgCount = 0
  for (const m of msgs ?? []) {
    const other = m.sender_id === user.id ? m.receiver_id : m.sender_id
    if (seen.has(other)) continue
    seen.add(other)
    if (m.receiver_id === user.id) msgCount++
  }

  return (
    <AdvertiserShell name={name} spend={spend} msgCount={msgCount} notifCount={notifCount ?? 0}>
      {children}
    </AdvertiserShell>
  )
}
