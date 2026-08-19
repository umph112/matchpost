import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import AdvertiserShell from '@/components/AdvertiserShell'
import { resolveCompany } from '@/lib/team/company'

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

  // 내 응답 대기 대화 수 — 안 읽은 메시지가 하나라도 있는 상대방 수.
  // 대화를 열면 그 대화는 읽음 처리되므로(A1), 이 배지·대시보드 요약 카드가 같은 값에서 파생된다.
  const { data: unreadMsgs } = await supabase
    .from('messages')
    .select('sender_id')
    .eq('receiver_id', user.id)
    .eq('is_read', false)
  const msgCount = new Set((unreadMsgs ?? []).map((m) => m.sender_id)).size

  const now = new Date()
  const sub = `광고주 콘솔 · ${now.getFullYear()}년 ${now.getMonth() + 1}월`

  // 모드 전환(내 업무/회사 관리) — D14 2절.
  // 대표이면서 활동중 팀원이 1명 이상일 때만 토글을 보여준다. 팀원 계정엔 토글 없음.
  const company = await resolveCompany(supabase, user.id)
  let canToggle = false
  if (company.isOwner) {
    const { count: teamCount } = await supabase
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('status', 'active')
    canToggle = (teamCount ?? 0) > 0
  }
  const cookieStore = await cookies()
  const initialView = cookieStore.get('adv_view')?.value === 'all' ? 'all' : 'me'

  return (
    <AdvertiserShell
      name={name}
      sub={sub}
      spend={spend}
      msgCount={msgCount}
      notifCount={notifCount ?? 0}
      canToggle={canToggle}
      isMember={company.isMember}
      initialView={initialView}
    >
      {children}
    </AdvertiserShell>
  )
}
