'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'influencer' | 'advertiser' | ''>('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async () => {
    if (!role) {
      setError('인플루언서 또는 광고주를 선택해주세요.')
      return
    }
    if (!name || !email || !password || !phone) {
      setError('모든 항목을 입력해주세요.')
      return
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 해요.')
      return
    }

    setLoading(true)
    setError('')

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
    })

    // 에러 상세 내용 확인
    if (signupError) {
      console.log('상세 에러:', JSON.stringify(signupError))
      setError(`에러: ${signupError.message}`)
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('회원가입에 실패했어요. 다시 시도해주세요.')
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      email,
      name,
      phone,
      role,
      status: 'pending',
    })

    if (profileError) {
      console.log('프로필 에러:', JSON.stringify(profileError))
      setError(`프로필 에러: ${profileError.message}`)
      setLoading(false)
      return
    }

    if (role === 'influencer') {
      await supabase.from('influencer_profiles').insert({ user_id: data.user.id })
    } else if (role === 'advertiser') {
      await supabase.from('advertiser_profiles').insert({ user_id: data.user.id })
    }

    router.push('/pending')
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-blue-600">MatchPost</h1>
        <p className="text-gray-500 mt-2">회원가입</p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          회원 유형 선택
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setRole('influencer')}
            className={`py-3 rounded-lg border-2 text-sm font-medium transition ${
              role === 'influencer'
                ? 'border-blue-600 bg-blue-50 text-blue-600'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            🎬 인플루언서
          </button>
          <button
            onClick={() => setRole('advertiser')}
            className={`py-3 rounded-lg border-2 text-sm font-medium transition ${
              role === 'advertiser'
                ? 'border-blue-600 bg-blue-50 text-blue-600'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            🏢 광고주
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="이름 입력"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="example@email.com"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="010-0000-0000"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="8자 이상 입력"
        />
      </div>

      <button
        onClick={handleSignup}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? '가입 중...' : '회원가입 신청'}
      </button>

      <p className="text-center text-xs text-gray-400 mt-3">
        가입 후 관리자 승인이 완료되면 서비스를 이용할 수 있어요.
      </p>

      <p className="text-center text-sm text-gray-500 mt-4">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="text-blue-600 font-medium hover:underline">
          로그인
        </Link>
      </p>
    </div>
  )
}