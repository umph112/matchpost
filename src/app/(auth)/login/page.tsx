import Link from 'next/link'
import Logo from '@/components/Logo'
import RoleLoginPanel from '@/components/RoleLoginPanel'

// D7 부록 5 — 랜딩 우측 패널과 같은 구성으로 통일. 실패 문구는 RoleLoginPanel에서 그대로 유지.
export default function LoginPage() {
  return (
    <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-sm p-8">
      <Link href="/" className="block mb-6">
        <Logo size={20} />
      </Link>
      <RoleLoginPanel />
    </div>
  )
}
