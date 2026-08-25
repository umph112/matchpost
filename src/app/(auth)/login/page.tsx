import Link from 'next/link'
import { redirect } from 'next/navigation'
import Logo from '@/components/Logo'
import RoleLoginPanel from '@/components/RoleLoginPanel'
import { createClient } from '@/lib/supabase/server'
import { roleHome } from '@/lib/auth/roleHome'

export const dynamic = 'force-dynamic'

// D7 부록 5 — 랜딩 우측 패널과 같은 구성으로 통일. 실패 문구는 RoleLoginPanel에서 그대로 유지.
export default async function LoginPage() {
  // D31 [1] — 로그인한 사람에게 로그인 폼을 보이지 않는다.
  // 이미 이력에 /login 이 남아 있는 사람(전에 push 로 들어온)도 이 확인에 걸려 되돌아간다.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect(await roleHome(supabase, user.id))

  return (
    <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-sm p-8">
      <Link href="/" className="block mb-6">
        <Logo size={20} />
      </Link>
      <RoleLoginPanel />
    </div>
  )
}
