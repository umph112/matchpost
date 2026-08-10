'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// D7 부록 3-3/5 — 랜딩 우측 패널과 /login이 공유하는 로그인 UI(역할 탭 + 소셜 + 이메일).
const ROLE_COPY = {
  advertiser: {
    title: '광고주 콘솔',
    desc: '브랜드 · 대행사 · 매장 누구나 씁니다. 캠페인을 열고 진행 단계와 정산을 관리해요.',
  },
  influencer: {
    title: '인플루언서 콘솔',
    desc: '폰에서 더 편하게 쓰실 수 있어요. PC에서는 채널 분석과 매출 관리를 권합니다.',
  },
} as const

const SOCIAL_BUTTONS = [
  { label: '카카오로 계속하기', bg: '#FEE500', color: '#191600' },
  { label: '네이버로 계속하기', bg: '#03C75A', color: '#fff' },
  { label: 'Apple로 계속하기', bg: '#000', color: '#fff' },
]

export default function RoleLoginPanel() {
  const [role, setRole] = useState<'advertiser' | 'influencer'>('advertiser')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError('이메일 또는 비밀번호가 올바르지 않아요.')
      setLoading(false)
      return
    }
    const { data: profile } = await supabase.from('profiles').select('role, status').eq('id', data.user.id).single()
    if (profile?.status === 'pending') { router.push('/pending'); return }
    if (profile?.role === 'influencer') router.push('/influencer/dashboard')
    else if (profile?.role === 'advertiser') router.push('/advertiser/dashboard')
    else if (profile?.role === 'admin') router.push('/admin/dashboard')
  }

  const copy = ROLE_COPY[role]

  return (
    <>
      <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.035em' }} className="text-[#17171B]">{copy.title}</h2>
      <p className="mt-[9px] text-[13.5px] leading-[1.7] text-[#7C7C88]">{copy.desc}</p>

      <div className="flex gap-[7px] mt-[26px]">
        {(['advertiser', 'influencer'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className="h-11 px-4 rounded-[11px] border text-[13.5px] font-bold flex items-center gap-2 transition"
            style={role === r
              ? { borderColor: '#17171B', background: '#17171B', color: '#fff' }
              : { borderColor: '#E2E2E8', background: '#fff', color: '#7C7C88' }}
          >
            <span
              className="w-[22px] h-[22px] flex items-center justify-center text-[10px]"
              style={{
                borderRadius: r === 'advertiser' ? 6 : 999,
                background: role === r ? 'rgba(255,255,255,0.16)' : '#F1F1F4',
                color: role === r ? '#fff' : '#9A9AA5',
              }}
            >
              {r === 'advertiser' ? '□' : '○'}
            </span>
            {r === 'advertiser' ? '광고주' : '인플루언서'}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-[9px] mt-[22px]">
        {SOCIAL_BUTTONS.map((s) => (
          <button
            key={s.label}
            disabled
            title="준비 중이에요"
            className="h-[50px] rounded-xl px-4 text-[14px] font-bold flex items-center opacity-60 cursor-not-allowed"
            style={{ background: s.bg, color: s.color }}
          >
            <span className="flex-1 text-center" style={{ marginLeft: -26 }}>{s.label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 my-[22px]">
        <div className="flex-1 h-px bg-[#EAEAEE]" />
        <span className="text-[12px] text-[#B0B0BB]">또는</span>
        <div className="flex-1 h-px bg-[#EAEAEE]" />
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-3">{error}</div>}

      <div className="flex flex-col gap-2.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          placeholder="이메일"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          placeholder="비밀번호"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      <button
        onClick={handleLogin}
        disabled={loading}
        className="w-full bg-[#17171B] text-white h-[50px] rounded-xl font-bold mt-3 hover:opacity-90 transition disabled:opacity-50"
      >
        {loading ? '로그인 중...' : '로그인'}
      </button>

      <p className="text-center text-sm text-gray-500 mt-4">
        아직 계정이 없으신가요?{' '}
        <Link href="/signup" className="text-[#B45309] font-medium hover:underline">
          회원가입
        </Link>
      </p>

      <p className="text-center mt-[18px]" style={{ fontSize: 11, color: '#B0B0BB', lineHeight: 1.7 }}>
        계속하면{' '}
        <Link href="/terms" className="text-[#7C7C88] underline">이용약관</Link>
        과{' '}
        <Link href="/privacy" className="text-[#7C7C88] underline">개인정보 처리방침</Link>
        에 동의하는 것으로 봅니다.
      </p>
    </>
  )
}
