import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBalance } from '@/lib/credits/ledger'
import { CREDIT_ACTION_LABELS } from '@/lib/creditConfig'
import CreditsHistoryClient from '@/components/CreditsHistoryClient'

export const dynamic = 'force-dynamic'

export default async function CreditsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('name, role').eq('id', user.id).single()
  const backHref = profile?.role === 'advertiser' ? '/advertiser/dashboard' : '/influencer/dashboard'

  const balance = await getBalance(user.id)

  const { data: ledger } = await supabase
    .from('credit_ledger')
    .select('id, delta, kind, reason_code, memo, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  const now = new Date()
  const monthRows = (ledger ?? []).filter((r) => {
    const d = new Date(r.created_at)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const monthIn = monthRows.filter((r) => r.delta > 0).reduce((s, r) => s + r.delta, 0)
  const monthOut = monthRows.filter((r) => r.delta < 0).reduce((s, r) => s + Math.abs(r.delta), 0)

  const rows = (ledger ?? []).map((r) => ({
    ...r,
    label: CREDIT_ACTION_LABELS[r.reason_code] ?? r.reason_code,
  }))

  return (
    <div className="max-w-[920px] mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Link href={backHref} className="mr-4 text-gray-400 hover:text-gray-600">← 뒤로</Link>
        <h1 className="text-xl font-bold text-gray-900">크레딧 내역</h1>
        <Link href="/credits/about" className="ml-auto text-xs text-[#B45309] hover:underline">크레딧이 뭔가요? →</Link>
      </div>

      {/* 검정 잔액 카드 */}
      <div className="bg-[#17171B] text-white rounded-2xl p-6 mb-4">
        <p className="text-xs text-white/50">보유 크레딧</p>
        <p className="text-3xl font-extrabold mt-1">
          {balance.balance.toLocaleString()} <span className="text-lg text-[#F59E0B]">C</span>
        </p>
        <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-white/10">
          <div>
            <p className="text-[11px] text-white/50">이번 달 쌓임</p>
            <p className="text-sm font-bold text-emerald-400 mt-0.5">+{monthIn.toLocaleString()} C</p>
          </div>
          <div>
            <p className="text-[11px] text-white/50">이번 달 사용</p>
            <p className="text-sm font-bold text-white/80 mt-0.5">−{monthOut.toLocaleString()} C</p>
          </div>
        </div>
      </div>

      <CreditsHistoryClient rows={rows} />

      <p className="text-[11px] text-gray-400 text-center mt-4">
        잔액은 거래 기록의 합계입니다. 개별 거래는 취소·수정되지 않고, 정정이 필요하면 반대 거래가 새로 추가됩니다.
      </p>
    </div>
  )
}
