'use client'

import { useState, useEffect, type ChangeEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Building2, User } from 'lucide-react'
import { INFLUENCER_CATEGORIES, CATEGORY_ETC } from '@/lib/categories'
import { inviteTeamMember } from '@/lib/team/actions'
import { signupCreditAmount } from '@/lib/creditConfig'
import Logo from '@/components/Logo'

const inputCls =
  'w-full border border-[#E2E2E8] rounded-[11px] px-[13px] h-[46px] text-[13.5px] focus:outline-none focus:ring-2 focus:ring-amber-400'

function useIsPc() {
  const [isPc, setIsPc] = useState<boolean | null>(null)
  useEffect(() => {
    const check = () => setIsPc(window.innerWidth >= 1024 && !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent))
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isPc
}

export default function SignupPage() {
  const [role, setRole] = useState<'influencer' | 'advertiser' | ''>('')
  const isPc = useIsPc()

  if (!role) return <RoleSelect onSelect={setRole} />
  if (role === 'advertiser') return <AdvertiserSignup onBack={() => setRole('')} />
  if (isPc) return <InfluencerQrGate onBack={() => setRole('')} />
  return <InfluencerSignup onBack={() => setRole('')} />
}

// ── 0. 역할 선택 ──
function RoleSelect({ onSelect }: { onSelect: (r: 'influencer' | 'advertiser') => void }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-3"><Logo size={20} /></div>
        <p className="text-gray-500 mt-2">회원가입</p>
      </div>
      <label className="block text-sm font-medium text-gray-700 mb-2">회원 유형 선택</label>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onSelect('influencer')}
          className="py-4 rounded-xl border-2 text-sm font-medium transition border-gray-200 text-gray-500 hover:border-[#F59E0B] hover:bg-[#FEF3C7] hover:text-[#B45309] flex flex-col items-center gap-1.5"
        >
          <User size={20} strokeWidth={1.75} />
          인플루언서
        </button>
        <button
          onClick={() => onSelect('advertiser')}
          className="py-4 rounded-xl border-2 text-sm font-medium transition border-gray-200 text-gray-500 hover:border-[#F59E0B] hover:bg-[#FEF3C7] hover:text-[#B45309] flex flex-col items-center gap-1.5"
        >
          <Building2 size={20} strokeWidth={1.75} />
          광고주
        </button>
      </div>
      <p className="text-center text-sm text-gray-500 mt-6">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="text-[#B45309] font-medium hover:underline">로그인</Link>
      </p>
    </div>
  )
}

// ── 1. 인플루언서 — PC는 QR 안내만 (D7 4-2) ──
function InfluencerQrGate({ onBack }: { onBack: () => void }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-8 max-w-[380px]">
      <button onClick={onBack} className="text-gray-400 hover:text-gray-600 mb-4"><ChevronLeft size={20} /></button>
      <h2 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.025em' }} className="text-[#17171B]">
        인플루언서 가입은 앱에서 해주세요
      </h2>
      <p className="mt-[9px]" style={{ fontSize: 12.5, color: '#5C5C68', lineHeight: 1.7 }}>
        채널 소유 확인과 오픈 등록이 폰에서 훨씬 빠릅니다.<br />
        아래 코드를 폰 카메라로 비추면 바로 가입 화면이 열려요.
      </p>
      <div className="mt-5 h-[180px] rounded-[14px] bg-[#17171B] flex flex-col items-center justify-center gap-2">
        <div className="w-[118px] h-[118px] border-2 border-white/80 rounded-lg bg-white/5" />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>matchpost.kr/app</span>
      </div>
    </div>
  )
}

// ── 2. 인플루언서 — 모바일: 기존 단일 폼 유지(카테고리 로직 이미 스펙과 일치) ──
function InfluencerSignup({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState('')
  const [activityName, setActivityName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
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
    setSubCategories((prev) => prev.filter((x) => x !== c))
  }
  const toggleSub = (c: string) => {
    setSubCategories((prev) => {
      if (prev.includes(c)) return prev.filter((x) => x !== c)
      if (prev.length >= 2) return prev
      return [...prev, c]
    })
  }
  const buildCategories = () => {
    const major = majorCategory === CATEGORY_ETC ? etcText.trim() : majorCategory
    const subs = subCategories.map((s) => (s === CATEGORY_ETC ? etcText.trim() : s))
    return [major, ...subs].filter(Boolean)
  }

  const handleSignup = async () => {
    if (!name || !activityName || !email || !phone || !password) {
      setError('필수 항목을 모두 입력해주세요.')
      return
    }
    if (!majorCategory) { setError('메이저 분야를 1개 선택해주세요.'); return }
    if (etcSelected && !etcText.trim()) { setError('기타 분야를 직접 입력해주세요.'); return }
    if (password.length < 8) { setError('비밀번호는 8자 이상이어야 해요.'); return }
    if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않아요.'); return }

    setLoading(true)
    setError('')
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'influencer', name, activityName, email, phone, password, categories: buildCategories() }),
    })
    const result = await res.json()
    if (!res.ok) { setError(result.error ?? '회원가입에 실패했어요.'); setLoading(false); return }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) { router.push('/login'); return }
    router.push('/influencer/dashboard')
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <button onClick={onBack} className="text-gray-400 hover:text-gray-600 mb-3"><ChevronLeft size={20} /></button>
      <div className="text-center mb-6"><Logo size={20} className="mx-auto" /></div>

      {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">이름 <span className="text-gray-400 font-normal">(실명)</span></label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="이름 입력" />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">활동명 <span className="text-gray-400 font-normal">(공개 표시 이름)</span></label>
        <input type="text" value={activityName} onChange={(e) => setActivityName(e.target.value)} className={inputCls} placeholder="예: 여행하는 지니" />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">메이저 분야 <span className="text-[#B45309] font-normal">(1개 필수)</span></label>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {INFLUENCER_CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => selectMajor(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${majorCategory === cat ? 'bg-[#F59E0B] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{cat}</button>
          ))}
        </div>
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
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${on ? 'bg-[#F59E0B] text-white' : disabled ? 'bg-gray-50 text-gray-300 cursor-not-allowed' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{cat}</button>
            )
          })}
        </div>
        {etcSelected && (
          <input type="text" value={etcText} onChange={(e) => setEtcText(e.target.value)} className={`${inputCls} mt-2`} placeholder="기타 분야 직접 입력" />
        )}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="example@email.com" />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="010-0000-0000" />
        <p className="text-xs text-gray-400 mt-1">추후 본인인증(네이버·카카오·PASS)에 사용될 예정이에요.</p>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="8자 이상 입력" />
      </div>
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
        <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
          className={`${inputCls} ${passwordConfirm && password !== passwordConfirm ? 'border-red-400 focus:ring-red-400' : ''}`} placeholder="비밀번호 재입력" />
        {passwordConfirm && password !== passwordConfirm && <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않아요.</p>}
      </div>

      <button onClick={handleSignup} disabled={loading}
        className="w-full bg-[#F59E0B] text-white py-2.5 rounded-lg font-medium hover:bg-[#D97706] transition disabled:opacity-50">
        {loading ? '가입 중...' : '회원가입'}
      </button>
      <p className="text-center text-[11px] text-gray-400 mt-3 leading-relaxed">
        가입하면{' '}
        <Link href="/terms" target="_blank" className="underline hover:text-gray-600">이용약관</Link>
        과{' '}
        <Link href="/privacy" target="_blank" className="underline hover:text-gray-600">개인정보처리방침</Link>
        에 동의하는 것으로 간주됩니다.
      </p>
      <p className="text-center text-xs text-gray-400 mt-3">
        가입 즉시 이용 가능해요. 오픈(가능일정) 등록은 마이페이지에서 채널·소개를 먼저 작성하면 활성화됩니다.
      </p>
    </div>
  )
}

// ── 3. 광고주 — PC 3단계(D7 부록 4-1) ──
function AdvertiserSignup({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [companyName, setCompanyName] = useState('')
  const [bizRegNumber, setBizRegNumber] = useState('')
  const [name, setName] = useState('')
  const [managerPhone, setManagerPhone] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [bizDocFile, setBizDocFile] = useState<File | null>(null)

  const [inviteEmails, setInviteEmails] = useState<string[]>([])
  const [inviteInput, setInviteInput] = useState('')

  const router = useRouter()
  const supabase = createClient()

  const validateStep1 = () => {
    if (!companyName.trim() || !bizRegNumber.trim() || !name || !managerPhone || !email || !phone || !password) {
      setError('필수 항목을 모두 입력해주세요.')
      return false
    }
    if (!bizDocFile) { setError('사업자등록증 파일을 첨부해주세요.'); return false }
    if (password.length < 8) { setError('비밀번호는 8자 이상이어야 해요.'); return false }
    if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않아요.'); return false }
    return true
  }

  const goStep2 = () => {
    setError('')
    if (!validateStep1()) return
    setStep(2)
  }

  const addInvite = () => {
    const v = inviteInput.trim()
    if (!v || inviteEmails.includes(v)) return
    setInviteEmails((prev) => [...prev, v])
    setInviteInput('')
  }

  const finishSignup = async () => {
    setLoading(true)
    setError('')

    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'advertiser', name, email, phone, managerPhone, companyPhone, password,
        companyName, bizRegNumber,
      }),
    })
    const result = await res.json()
    if (!res.ok) { setError(result.error ?? '회원가입에 실패했어요.'); setLoading(false); setStep(1); return }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) { router.push('/login'); return }

    if (bizDocFile) {
      const fd = new FormData()
      fd.append('file', bizDocFile)
      await fetch('/api/signup/biz-doc', { method: 'POST', body: fd }).catch(() => {})
    }
    for (const inviteEmail of inviteEmails) {
      await inviteTeamMember(inviteEmail, '담당자').catch(() => {})
    }

    setLoading(false)
    setStep(3)
  }

  const StepHeader = ({ n, title, desc }: { n: 1 | 2 | 3; title: string; desc: string }) => (
    <>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => (n === 1 ? onBack() : setStep((n - 1) as 1 | 2))} className="text-gray-400 hover:text-gray-600"><ChevronLeft size={20} /></button>
        <span className="text-xs font-semibold text-gray-400">{n} / 3</span>
      </div>
      <div className="h-1 rounded-full bg-[#F1F1F4] mb-4">
        <div className="h-1 rounded-full bg-[#F59E0B] transition-all" style={{ width: `${(n / 3) * 100}%` }} />
      </div>
      <h2 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.035em' }} className="text-[#17171B]">{title}</h2>
      <p style={{ fontSize: 13, color: '#7C7C88', lineHeight: 1.7 }} className="mt-2 mb-5">{desc}</p>
    </>
  )

  if (step === 1) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8">
        <StepHeader n={1} title="어디에서 오셨나요?" desc="브랜드 · 대행사 · 매장 누구나 광고주로 시작할 수 있어요." />
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

        <div className="grid grid-cols-2 gap-3.5">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">상호 <span className="text-[#DC2626]">필수</span></label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} placeholder="예: 컨텐츠플레이스" />
            <p className="text-[11px] text-gray-400 mt-1.5">인플루언서에게 이 이름으로 보여요.</p>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">사업자등록번호 <span className="text-[#DC2626]">필수</span></label>
            <input value={bizRegNumber} onChange={(e) => setBizRegNumber(e.target.value)} className={inputCls} placeholder="000-00-00000" />
            <p className="text-[11px] text-gray-400 mt-1.5">조직 계정은 이 번호로 하나만 만들어집니다.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">담당자 이름 <span className="text-[#DC2626]">필수</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="이름" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">담당자 휴대폰 <span className="text-[#DC2626]">필수</span></label>
            <input value={managerPhone} onChange={(e) => setManagerPhone(e.target.value)} className={inputCls} placeholder="010-0000-0000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">회사 대표번호 <span className="text-[#B0B0BB]">선택</span></label>
            <input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} className={inputCls} placeholder="02-000-0000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">이메일 <span className="text-[#DC2626]">필수</span></label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="example@email.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">전화번호 <span className="text-[#DC2626]">필수</span></label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="010-0000-0000" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">비밀번호 <span className="text-[#DC2626]">필수</span></label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="8자 이상" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">비밀번호 확인 <span className="text-[#DC2626]">필수</span></label>
            <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} className={inputCls} placeholder="비밀번호 재입력" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">사업자등록증 파일 <span className="text-[#DC2626]">필수</span></label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setBizDocFile(e.target.files?.[0] ?? null)}
              className="w-full text-[12.5px] text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-600 file:text-xs"
            />
            <p className="text-[11px] text-gray-400 mt-1.5">승인 심사에만 쓰이고, 확인 즉시 삭제돼요.</p>
          </div>
        </div>

        <button onClick={goStep2} className="w-full bg-[#F59E0B] text-white py-3 rounded-xl font-bold mt-6 hover:bg-[#D97706] transition">
          다음
        </button>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8">
        <StepHeader n={2} title="함께 쓸 분이 있으신가요?" desc="캠페인과 크레딧은 회사 계정에 쌓입니다. 담당자가 바뀌어도 기록은 그대로 남아요." />
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

        <div className="flex flex-col gap-2 mb-3">
          {inviteEmails.map((em) => (
            <div key={em} className="flex items-center gap-2.5 border border-[#EAEAEE] rounded-[11px] px-3.5 py-3">
              <span className="w-8 h-8 rounded-full bg-[#F1F1F4] text-[#9A9AA5] flex items-center justify-center text-xs font-bold shrink-0">
                {em[0]?.toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-bold truncate">{em}</p>
                <p className="text-[11px] text-[#9A9AA5]">담당자</p>
              </div>
              <button onClick={() => setInviteEmails((prev) => prev.filter((x) => x !== em))} className="text-gray-300 hover:text-red-500 text-xs">✕</button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-3">
          <input
            value={inviteInput}
            onChange={(e) => setInviteInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addInvite()}
            placeholder="이메일 입력"
            className={inputCls}
          />
          <button onClick={addInvite} className="shrink-0 h-[46px] px-4 rounded-[11px] border border-dashed border-[#D4D4DC] text-[#B45309] text-sm font-semibold">
            ＋ 초대
          </button>
        </div>

        <div className="bg-[#FAFAFB] rounded-[11px] px-3.5 py-3 text-[11.5px] text-[#7C7C88] mb-6">
          지금 안 하셔도 됩니다. 가입 후 「팀」 메뉴에서 언제든 초대할 수 있어요.
        </div>

        <button onClick={finishSignup} disabled={loading} className="w-full bg-[#F59E0B] text-white py-3 rounded-xl font-bold hover:bg-[#D97706] transition disabled:opacity-50">
          {loading ? '가입 처리 중...' : '가입 완료'}
        </button>
      </div>
    )
  }

  // step === 3 — 완료
  const amount = signupCreditAmount('advertiser')
  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <div className="flex items-center justify-between mb-2">
        <span />
        <span className="text-xs font-semibold text-gray-400">3 / 3</span>
      </div>
      <div className="h-1 rounded-full bg-[#F59E0B] mb-4" />
      <h2 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.035em' }} className="text-[#17171B]">준비됐어요!</h2>
      <p style={{ fontSize: 13, color: '#7C7C88', lineHeight: 1.7 }} className="mt-2 mb-5">
        이제 캠페인을 등록하거나, 날짜로 인플루언서를 찾아 대시할 수 있어요.
      </p>

      <div className="rounded-[14px] px-[18px] py-[17px]" style={{ background: '#17171B' }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>웰컴 크레딧</span>
          <span className="text-[10.5px] font-bold rounded-full px-2 py-0.5" style={{ background: 'rgba(245,158,11,0.2)', color: '#F59E0B' }}>지급 완료</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span style={{ fontSize: 29, fontWeight: 800, letterSpacing: '-0.035em', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
            {amount.toLocaleString()}
          </span>
          <span className="w-[23px] h-[23px] rounded-full bg-[#F59E0B] text-[#17171B] text-[13px] font-extrabold flex items-center justify-center">C</span>
        </div>
        <p className="mt-1.5" style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>
          캠페인 개설은 베타 기간 무료, 협업이 성사되면 10,000C를 더 드려요.
        </p>
      </div>

      <div className="flex flex-col gap-2 mt-4">
        {['첫 캠페인을 등록하거나, 날짜로 인플루언서를 찾아보세요', '사업자등록증은 승인 심사에 쓰이고, 확인 즉시 삭제됩니다', '대시 · 딜시트 확인 · 정산 기록은 폰에서도 됩니다'].map((t) => (
          <div key={t} className="flex items-start gap-2">
            <span className="w-[5px] h-[5px] rounded-full bg-[#F59E0B] mt-[7px] shrink-0" />
            <p style={{ fontSize: 12.5, color: '#3C3C46', lineHeight: 1.65 }}>{t}</p>
          </div>
        ))}
      </div>

      <button
        onClick={() => router.push('/advertiser/dashboard')}
        className="w-full bg-[#F59E0B] text-white py-3 rounded-xl font-bold mt-6 hover:bg-[#D97706] transition"
      >
        캠페인 등록하러 가기
      </button>
    </div>
  )
}
