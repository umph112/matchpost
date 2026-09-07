import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdvertiserShellServer from '@/components/shells/AdvertiserShellServer'
import InfluencerShellServer from '@/components/shells/InfluencerShellServer'

export const dynamic = 'force-dynamic'

// /day/[date] 는 광고주·인플루언서가 함께 쓰는 경로라 어느 역할 폴더에도 안 들어간다.
// 그래서 지금까지 셸이 없었다 — 폭이 512px 에 갇힌 것보다 그게 더 문제였다.
// 사이드바도 하단 탭도 없어 이 화면에 들어오면 나갈 길이 없는 막다른 길이었다(D33).
//
// 셸이 붙으면 폭 문제도 같이 풀린다. page.tsx 81행의 lg:[.adv-pc_&]:max-w-none 해제는
// 원래 있었지만 .adv-pc 마커를 주는 조상이 없어 한 번도 발동한 적이 없었다.
// (세 번 되돌아온 버그와 같은 부류 — 폭 클래스가 아니라 판정이 없던 것)
export default async function DayLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  // 관리자에게는 대응하는 셸이 없다. 「내 하루」 화면이라 관리자 골격에 넣을 것이 아니고,
  // 관리자가 협업 건을 볼 때는 관리자 화면에서 그 건으로 들어가는 게 맞다.
  if (profile?.role === 'admin') redirect('/admin/dashboard')

  // role 은 advertiser · influencer · admin 셋뿐이다(가입이 앞의 둘만 만든다).
  // 그래서 admin 을 걸러낸 뒤 남는 것은 인플루언서다.
  if (profile?.role === 'advertiser') return <AdvertiserShellServer>{children}</AdvertiserShellServer>
  return <InfluencerShellServer>{children}</InfluencerShellServer>
}
