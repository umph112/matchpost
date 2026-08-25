import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { roleHome } from '@/lib/auth/roleHome'
import SignupClient from './SignupClient'

export const dynamic = 'force-dynamic'

// D31 [1] — 로그인한 사람에게 가입 폼을 보이지 않는다.
// 가입 직후 뒤로가기로 이 화면에 돌아오면 「가입이 안 된 건가」 싶게 되는데,
// 그때는 이미 계정이 있으니 역할 홈으로 돌려보낸다. 승인 대기면 /pending 으로 간다.
export default async function SignupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect(await roleHome(supabase, user.id))

  return <SignupClient />
}
