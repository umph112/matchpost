import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBalance } from '@/lib/credits/ledger'
import {
  CREDIT_ACTION_LABELS,
  CREDIT_POLICY,
  creditAmount,
  type CreditPolicyItem,
} from '@/lib/creditConfig'
import CreditsHistoryClient from '@/components/CreditsHistoryClient'

export const dynamic = 'force-dynamic'

// D10-2 §B — 크레딧 C 링크 마크(원본 SVG 그대로)
function CMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="30"
      height="30"
      fill="none"
      aria-label="크레딧"
      style={{ display: 'block', marginLeft: 5, flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="12" fill="#F59E0B" />
      <path d="M16.1 7.9A5.7 5.7 0 1 0 16.1 16.1" stroke="#17171B" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  )
}

// 단가표: 크레딧이 쓰이는 곳(차감 항목). 금액은 creditConfig 에서만 읽는다.
const PRICE_KEYS = ['open_schedule', 'create_campaign', 'send_proposal']
const PRICE_SUBTITLE: Record<string, string> = {
  open_schedule: '가능한 날짜를 검색에 공개',
  create_campaign: '모집 캠페인을 공개로 등록',
  send_proposal: '인플루언서에게 대시 보내기',
}

function PriceValue({ p }: { p: CreditPolicyItem }) {
  // D6 D2 — 베타 무료는 금액을 0으로 만들지 않는다. 원래 금액을 남긴 채 청구만 안 함.
  if (p.status === 'beta_free') {
    return (
      <div className="text-right shrink-0">
        <div className="text-[12.5px] font-bold text-[#15803D]">지금은 무료</div>
        <div className="text-[11px] text-[#B0B0BB] mt-0.5">원래 {p.amount.toLocaleString()}C</div>
      </div>
    )
  }
  const word = p.dir === 'grant' ? '적립' : '사용'
  const color = p.dir === 'grant' ? 'text-[#15803D]' : 'text-[#3C3C46]'
  return (
    <div className={`text-[12.5px] font-bold text-right shrink-0 ${color}`}>
      {p.amount.toLocaleString()} {word}
    </div>
  )
}

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

  // 베타 무료로 청구되지 않은 누계(원래 금액 기준) — 원장 reason_code 가 beta_free 항목인 것
  const BETA_KEYS = new Set(CREDIT_POLICY.filter((p) => p.status === 'beta_free').map((p) => p.key))
  const saved = (ledger ?? [])
    .filter((r) => BETA_KEYS.has(r.reason_code))
    .reduce((s, r) => s + creditAmount(r.reason_code), 0)

  const rows = (ledger ?? []).map((r) => ({
    ...r,
    label: CREDIT_ACTION_LABELS[r.reason_code] ?? r.reason_code,
  }))

  const priceRows = PRICE_KEYS
    .map((k) => CREDIT_POLICY.find((p) => p.key === k))
    .filter((p): p is CreditPolicyItem => Boolean(p))

  return (
    <div className="max-w-[1100px] mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center mb-2">
        <Link href={backHref} className="mr-4 text-gray-400 hover:text-gray-600">← 뒤로</Link>
        <h1 className="text-xl font-bold text-[#17171B]">크레딧</h1>
        <Link href="/credits/about" className="ml-auto text-xs text-[#B45309] hover:underline">크레딧이 뭔가요? →</Link>
      </div>
      <p className="text-[13px] text-[#7C7C88] mb-5">
        캠페인을 열고 대시를 보낼 때 쓰는 크레딧이에요. <span className="font-bold text-[#3C3C46]">1C = 1원</span>
      </p>

      {/* 본문: 좌 검은 잔액 카드(332px) + 우 단가표·이력 */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[332px_minmax(0,1fr)] lg:gap-4 lg:items-stretch">
        {/* 좌 — 검은 잔액 카드 */}
        <div className="bg-[#17171B] rounded-2xl px-6 py-[22px] flex flex-col">
          <div className="flex items-center gap-[7px]">
            <span className="w-[7px] h-[7px] rounded-full bg-[#F59E0B] inline-block shrink-0" />
            <span className="text-[11.5px] font-bold text-white/[0.62] tracking-[0.02em]">보유 크레딧</span>
          </div>

          <div className="flex items-baseline mt-2.5">
            <span className="text-[40px] font-extrabold text-white tracking-[-0.04em] leading-none tabular-nums">
              {balance.balance.toLocaleString()}
            </span>
            <CMark />
          </div>
          <p className="text-xs text-white/[0.42] mt-[7px]">{balance.balance.toLocaleString()}원 상당</p>

          <div className="h-px bg-white/10 mt-[18px] mb-[14px]" />

          <div className="flex flex-col gap-[9px]">
            <div className="flex items-baseline">
              <span className="text-[11.5px] text-white/50">이번 달 적립</span>
              <span className="ml-auto text-[12.5px] font-bold text-white tabular-nums">{monthIn.toLocaleString()} 적립</span>
            </div>
            <div className="flex items-baseline">
              <span className="text-[11.5px] text-white/50">이번 달 사용</span>
              <span className="ml-auto text-[12.5px] font-bold text-white tabular-nums">{monthOut.toLocaleString()} 사용</span>
            </div>
            <div className="flex items-baseline">
              <span className="text-[11.5px] text-white/50">남은 크레딧</span>
              <span className="ml-auto text-[12.5px] font-bold text-white tabular-nums">{balance.balance.toLocaleString()} 남음</span>
            </div>
          </div>

          {saved > 0 && (
            <p className="text-[11px] text-white/[0.42] mt-4">
              베타 기간이라 {saved.toLocaleString()}C 가 청구되지 않았어요
            </p>
          )}
        </div>

        {/* 우 — 단가표 + 이력 */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* 단가표 */}
          <div className="bg-white border border-[#EAEAEE] rounded-[14px] overflow-hidden">
            <div className="h-[52px] px-5 flex items-center border-b border-[#F1F1F4]">
              <h2 className="text-[14.5px] font-bold text-[#17171B] tracking-[-0.01em]">무엇에 쓰이나요</h2>
            </div>
            {priceRows.map((p) => (
              <div
                key={p.key}
                className="flex items-center justify-between gap-3 px-5 py-[13px] border-b border-[#F5F5F7] last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold text-[#2A2A33]">{p.label}</div>
                  <div className="text-[11px] text-[#9A9AA5] mt-0.5">{PRICE_SUBTITLE[p.key]}</div>
                </div>
                <PriceValue p={p} />
              </div>
            ))}
          </div>

          {/* 이력 */}
          <div>
            <h2 className="text-[13.5px] font-bold text-[#17171B] mb-2.5">사용 내역</h2>
            <CreditsHistoryClient rows={rows} />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 text-center mt-4">
        잔액은 거래 기록의 합계입니다. 개별 거래는 취소·수정되지 않고, 정정이 필요하면 반대 거래가 새로 추가됩니다.
      </p>
    </div>
  )
}
