import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import AdvertiserShell from '@/components/AdvertiserShell'
import { resolveCompany } from '@/lib/team/company'

// 광고주 셸 + 셸이 쓸 요약값 계산.
//
// D33 — advertiser/layout.tsx 본문을 그대로 옮겼다(로직 변경 없음).
// 옮긴 이유: /day/[date] 는 광고주·인플루언서가 함께 쓰는 경로라 어느 역할 레이아웃에도
// 안 들어가고, 그래서 셸이 없어 사이드바도 하단 탭도 없었다 — 막다른 길이었다.
// 그 화면에서 같은 셸을 쓰려면 계산이 레이아웃 밖에 있어야 한다.
// 복사가 아니라 이동인 이유: 배지 숫자(집행 예정액·미읽음 대화·이관 건수)를 두 벌 두면
// 한쪽만 고쳐져 화면마다 다른 숫자가 나온다.
export default async function AdvertiserShellServer({ children }: { children: React.ReactNode }) {
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

  // 이관 nav — 회사의 퇴사 예정(leaving) 팀원별 남은 담당 건수(D14 5절).
  // resolveCompany 는 leaving 멤버를 본인 회사로 오인하므로, 내가 퇴사 예정이면 그 소속(owner_id)을 우선한다.
  const { data: meLeaving } = await supabase
    .from('team_members')
    .select('owner_id')
    .eq('member_id', user.id)
    .eq('status', 'leaving')
    .maybeSingle()
  const ownerScope = meLeaving?.owner_id ?? company.advertiserId
  const { data: leavingRows } = await supabase
    .from('team_members')
    .select('member_id, leave_on')
    .eq('owner_id', ownerScope)
    .eq('status', 'leaving')
  const leaving = (leavingRows ?? []).filter((r) => r.member_id)
  let handovers: { leaverId: string; label: string; badge: number }[] = []
  if (leaving.length) {
    const ids = leaving.map((r) => r.member_id as string)
    const { data: pf } = await supabase.from('profiles').select('id, name').in('id', ids)
    const nameById = Object.fromEntries((pf ?? []).map((p) => [p.id, p.name as string | null]))
    handovers = await Promise.all(
      leaving.map(async (r) => {
        const lid = r.member_id as string
        const { count: cc } = await supabase
          .from('campaigns')
          .select('id', { count: 'exact', head: true })
          .eq('advertiser_id', ownerScope)
          .eq('manager_id', lid)
        const { count: vc } = await supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('advertiser_id', ownerScope)
          .eq('kind', 'personal')
          .eq('manager_id', lid)
        return {
          leaverId: lid,
          label: `${nameById[lid] || '이름 미설정'}님 이관`,
          badge: (cc ?? 0) + (vc ?? 0),
        }
      }),
    )
  }

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
      handovers={handovers}
    >
      {children}
    </AdvertiserShell>
  )
}
