'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async () => {
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않아요.')
      setLoading(false)
      return
    }

    // 유저 role 확인 후 이동
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', data.user.id)
      .single()

    if (profile?.status === 'pending') {
      router.push('/pending')
      return
    }

    if (profile?.role === 'influencer') {
      router.push('/influencer/dashboard')
    } else if (profile?.role === 'advertiser') {
      router.push('/advertiser/dashboard')
    } else if (profile?.role === 'admin') {
      router.push('/admin/dashboard')
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      {/* 로고 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-[#17171B]">MatchPost</h1>
        <p className="text-gray-500 mt-2">인플루언서 · 광고주 매칭 플랫폼</p>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* 이메일 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          이메일
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          placeholder="example@email.com"
        />
      </div>

      {/* 비밀번호 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          비밀번호
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          placeholder="비밀번호 입력"
        />
      </div>

      {/* 로그인 버튼 */}
      <button
        onClick={handleLogin}
        disabled={loading}
        className="w-full bg-[#F59E0B] text-white py-2.5 rounded-lg font-medium hover:bg-[#D97706] transition disabled:opacity-50"
      >
        {loading ? '로그인 중...' : '로그인'}
      </button>

      {/* 회원가입 링크 */}
      <p className="text-center text-sm text-gray-500 mt-4">
        아직 계정이 없으신가요?{' '}
        <Link href="/signup" className="text-[#B45309] font-medium hover:underline">
          회원가입
        </Link>
      </p>
    </div>
  )
}