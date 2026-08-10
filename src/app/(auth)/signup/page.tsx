'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { INFLUENCER_CATEGORIES, CATEGORY_ETC } from '@/lib/categories'

export default function SignupPage() {
  const [role, setRole] = useState<'influencer' | 'advertiser' | ''>('')
  const [name, setName] = useState('')
  const [activityName, setActivityName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [managerPhone, setManagerPhone] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [majorCategory, setMajorCategory] = useState('')
  const [subCategories, setSubCategories] = useState<string[]>([])
  const [etcText, setEtcText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const etcSelected = majorCategory === CATEGORY_ETC || subCategories.includes(CATEGORY_ETC)

  const selectMajor = (c: string) => {
    setMajorCategory((prev) => (prev === c ? '' : c))
    // 메이저로 고른 분야는 서브에서 제거
    setSubCategories((prev) => prev.filter((x) => x !== c))
  }

  const toggleSub = (c: string) => {
    setSubCategories((prev) => {
      if (prev.includes(c)) return prev.filter((x) => x !== c)
      if (prev.length >= 2) return prev // 서브 최대 2개
      return [...prev, c]
    })
  }

  const buildCategories = () => {
    const major = majorCategory === CATEGORY_ETC ? etcText.trim() : majorCategory
    const subs = subCategories.map((s) => (s === CATEGORY_ETC ? etcText.trim() : s))
    return [major, ...subs].filter(Boolean)
  }

  const handleSignup = async () => {
    if (!role) {
      setError('인플루언서 또는 광고주를 선택해주세요.')
      return
    }
    if (role === 'influencer') {
      if (!name || !activityName || !email || !phone || !password) {
        setError('필수 항목을 모두 입력해주세요.')
        return
      }
      if (!majorCategory) {
        setError('메이저 분야를 1개 선택해주세요.')
        return
      }
      if (etcSelected && !etcText.trim()) {
        setError('기타 분야를 직접 입력해주세요.')
        return
      }
    } else {
      if (!name || !email || !phone || !managerPhone || !password) {
        setError('필수 항목을 모두 입력해주세요.')
        return
      }
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 해요.')
      return
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않아요.')
      return
    }

    setLoading(true)
    setError('')

    const isInfluencer = role === 'influencer'

    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role,
        name,
        activityName,
        email,
        phone,
        managerPhone: !isInfluencer ? managerPhone : undefined,
        companyPhone: !isInfluencer ? companyPhone : undefined,
        password,
        categories: isInfluencer ? buildCategories() : [], // index 0 = 메이저
      }),
    })
    const result = await res.json()
    if (!res.ok) {
      setError(result.error ?? '회원가입에 실패했어요. 다시 시도해주세요.')
      setLoading(false)
      return
    }

    // 세션 로그인 후 이동
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      router.push('/login')
      return
    }
    router.push(isInfluencer ? '/influencer/dashboard' : '/pending')
  }

  const inputCls =
    'w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-[#17171B]">MatchPost</h1>
        <p className="text-gray-500 mt-2">회원가입</p>
      </div>

      {/* 회원 유형 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">회원 유형 선택</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setRole('influencer')}
            className={`py-3 rounded-lg border-2 text-sm font-medium transition ${
              role === 'influencer'
                ? 'border-[#F59E0B] bg-[#FEF3C7] text-[#B45309]'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            🎬 인플루언서
          </button>
          <button
            onClick={() => setRole('advertiser')}
            className={`py-3 rounded-lg border-2 text-sm font-medium transition ${
              role === 'advertiser'
                ? 'border-[#F59E0B] bg-[#FEF3C7] text-[#B45309]'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            🏢 광고주
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>
      )}

      {role && (
        <>
          {/* 이름 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 {role === 'influencer' && <span className="text-gray-400 font-normal">(실명)</span>}
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className={inputCls} placeholder="이름 입력" />
          </div>

          {/* 활동명 (인플루언서 전용) */}
          {role === 'influencer' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                활동명 <span className="text-gray-400 font-normal">(공개 표시 이름)</span>
              </label>
              <input type="text" value={activityName} onChange={(e) => setActivityName(e.target.value)}
                className={inputCls} placeholder="예: 여행하는 지니" />
            </div>
          )}

          {/* 카테고리 (인플루언서 전용) */}
          {role === 'influencer' && (
            <div className="mb-4">
              {/* 메이저 */}
              <label className="block text-sm font-medium text-gray-700 mb-2">
                메이저 분야 <span className="text-[#B45309] font-normal">(1개 필수)</span>
              </label>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {INFLUENCER_CATEGORIES.map((cat) => (
                  <button key={cat} onClick={() => selectMajor(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                      majorCategory === cat
                        ? 'bg-[#F59E0B] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>{cat}</button>
                ))}
              </div>

              {/* 서브 */}
              <label className="block text-sm font-medium text-gray-700 mb-2">
                서브 분야 <span className="text-gray-400 font-normal">(최대 2개 · 선택)</span>
                <span className="ml-1 text-gray-400">{subCategories.length}/2</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {INFLUENCER_CATEGORIES.filter((c) => c !== majorCategory).map((cat) => {
                  const on = subCategories.includes(cat)
                  const disabled = !on && subCategories.length >= 2
                  return (
                    <button key={cat} onClick={() => toggleSub(cat)} disabled={disabled}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                        on
                          ? 'bg-[#F59E0B] text-white'
                          : disabled
                          ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>{cat}</button>
                  )
                })}
              </div>

              {etcSelected && (
                <input type="text" value={etcText} onChange={(e) => setEtcText(e.target.value)}
                  className={`${inputCls} mt-2`} placeholder="기타 분야 직접 입력" />
              )}
            </div>
          )}

          {/* 이메일 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className={inputCls} placeholder="example@email.com" />
          </div>

          {/* 전화번호 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className={inputCls} placeholder="010-0000-0000" />
            <p className="text-xs text-gray-400 mt-1">추후 본인인증(네이버·카카오·PASS)에 사용될 예정이에요.</p>
          </div>

          {/* 담당자 연락처 (광고주 전용) */}
          {role === 'advertiser' && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">담당자 휴대폰</label>
                <input type="tel" value={managerPhone} onChange={(e) => setManagerPhone(e.target.value)}
                  className={inputCls} placeholder="010-0000-0000" />
                <p className="text-xs text-gray-400 mt-1">
                  캠페인 등록 시 기본값으로 쓰여요. 미수금 발생 시 인플루언서에게 이 번호가 먼저 안내됩니다.
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  회사 대표번호 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <input type="tel" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)}
                  className={inputCls} placeholder="02-000-0000" />
              </div>
            </>
          )}

          {/* 비밀번호 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className={inputCls} placeholder="8자 이상 입력" />
          </div>

          {/* 비밀번호 확인 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
            <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
              className={`${inputCls} ${
                passwordConfirm && password !== passwordConfirm ? 'border-red-400 focus:ring-red-400' : ''
              }`} placeholder="비밀번호 재입력" />
            {passwordConfirm && password !== passwordConfirm && (
              <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않아요.</p>
            )}
          </div>

          <button onClick={handleSignup} disabled={loading}
            className="w-full bg-[#F59E0B] text-white py-2.5 rounded-lg font-medium hover:bg-[#D97706] transition disabled:opacity-50">
            {loading ? '가입 중...' : '회원가입'}
          </button>

          <p className="text-center text-[11px] text-gray-400 mt-3 leading-relaxed">
            가입하면{' '}
            <Link href="/terms" target="_blank" className="underline hover:text-gray-600">이용약관</Link>
            {' '}과{' '}
            <Link href="/privacy" target="_blank" className="underline hover:text-gray-600">개인정보처리방침</Link>
            에 동의하는 것으로 간주됩니다.
          </p>

          <p className="text-center text-xs text-gray-400 mt-3">
            {role === 'influencer'
              ? '가입 즉시 이용 가능해요. 오픈(가능일정) 등록은 마이페이지에서 채널·소개를 먼저 작성하면 활성화됩니다.'
              : '광고주는 서류 확인 후 관리자 승인이 완료되면 이용할 수 있어요.'}
          </p>
        </>
      )}

      <p className="text-center text-sm text-gray-500 mt-4">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="text-[#B45309] font-medium hover:underline">
          로그인
        </Link>
      </p>
    </div>
  )
}
