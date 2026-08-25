import type { SupabaseClient } from '@supabase/supabase-js'

// D31 [1] — 로그인한 사람이 가야 할 첫 화면 한 곳.
//
// 전에는 RoleLoginPanel 안에만 있었다. 그래서 /login 이 「이미 로그인함」을 확인하려 해도
// 보낼 곳을 스스로 다시 판단해야 했고, 두 곳이 어긋나면 로그인은 되는데 엉뚱한 데로 가는
// 상태가 된다. 판단은 여기 한 줄로 둔다.
//
// pending 을 먼저 본다 — 승인 대기 중인 광고주는 역할이 advertiser 여도 콘솔에 들어가면 안 된다.
export async function roleHome(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('role, status').eq('id', userId).single()
  if (data?.status === 'pending') return '/pending'
  if (data?.role === 'influencer') return '/influencer/dashboard'
  if (data?.role === 'advertiser') return '/advertiser/dashboard'
  if (data?.role === 'admin') return '/admin/dashboard'
  // 역할이 비어 있는 계정 — 예전에는 아무 데도 안 보내서 버튼이 「로그인 중…」에 멈춰 있었다.
  return '/'
}
