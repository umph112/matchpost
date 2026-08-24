'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { initial } from '@/lib/initial'
import { inviteTeamMember } from '@/lib/team/actions'
import { setLeaving, cancelLeaving } from '@/lib/team/transfers'

type Status = 'invited' | 'active' | 'inactive' | 'leaving'

type Member = {
  id: string
  email: string
  role: string
  status: Status
  invited_at: string
  joined_at: string | null
  member_id: string | null
  invite_token: string | null
  leave_on: string | null
  name?: string | null
}

const STATUS_STYLE: Record<Status, string> = {
  invited: 'bg-[#FEF3C7] text-[#B45309]',
  active: 'bg-[#DCFCE7] text-[#15803D]',
  inactive: 'bg-[#F1F1F4] text-[#7C7C88]',
  leaving: 'bg-[#FEF3C7] text-[#B45309]',
}
const STATUS_LABEL: Record<Status, string> = {
  invited: '초대 대기',
  active: '활동중',
  inactive: '비활성',
  leaving: '퇴사 예정',
}
// 역할 배지 색 — 대표/팀원 두 가지. 알 수 없는 값이 오면 팀원으로 폴백(색이 없어 화면이 죽는 걸 막는다).
const ROLE_COLOR: Record<string, { bg: string; fg: string }> = {
  '대표': { bg: '#17171B', fg: '#ffffff' },
  '팀원': { bg: '#F1F1F4', fg: '#5C5C68' },
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  // 퇴사 예정 전환 — active 행에서 퇴사 예정일을 입력하는 인라인 상태
  const [leavingId, setLeavingId] = useState<string | null>(null)
  const [leaveDate, setLeaveDate] = useState('')
  const [rowError, setRowError] = useState('')
  const today = new Date().toISOString().slice(0, 10)

  // 공개 프로필 — 마케팅 문의 연락처 공개 설정(대표만). 폴백: 이메일=user_private.email, 전화=profiles.manager_phone
  const [myId, setMyId] = useState<string | null>(null)
  const [mktPublic, setMktPublic] = useState(false)
  const [mktEmail, setMktEmail] = useState('')
  const [mktPhone, setMktPhone] = useState('')
  const [fallbackEmail, setFallbackEmail] = useState('')
  const [fallbackPhone, setFallbackPhone] = useState('')
  const [showContactInputs, setShowContactInputs] = useState(false)
  // 공개 프로필 — 직접 작성 항목(대표만). advertiser_profiles.one_line/intro/brands/history (0082)
  const [oneLine, setOneLine] = useState('')
  const [intro, setIntro] = useState('')
  const [brands, setBrands] = useState('')
  const [history, setHistory] = useState('')
  // 공개 프로필 저장이 0행으로 끝났을 때 띄우는 안내(자동 저장이라 누를 버튼이 없다)
  const [profileError, setProfileError] = useState('')
  // 이 카드는 onBlur 자동 저장이다 — 불러오기 전에 칸을 건드리면 빈 값이 저장된다.
  // 그래서 값이 도착하기 전에는 입력칸을 그리지 않는다.
  const [profileReady, setProfileReady] = useState(false)

  const supabase = createClient()

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('team_members')
      .select('id, email, role, status, invited_at, joined_at, member_id, invite_token, leave_on')
      .order('created_at', { ascending: false })

    const memberIds = [...new Set((data ?? []).filter((m) => m.member_id).map((m) => m.member_id as string))]
    const { data: profiles } = memberIds.length
      ? await supabase.from('profiles').select('id, name').in('id', memberIds)
      : { data: [] }
    const nameById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.name]))

    setMembers((data ?? []).map((m) => ({ ...m, name: m.member_id ? nameById[m.member_id] : null })))
    setLoading(false)
  }

  // 공개 프로필 값 로드 — 내 advertiser_profiles(마케팅 공개설정) + 폴백(user_private.email, profiles.manager_phone)
  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setProfileReady(true); return }
    setMyId(user.id)
    const { data: ap } = await supabase
      .from('advertiser_profiles')
      .select('marketing_contact_public, marketing_email, marketing_phone, one_line, intro, brands, history')
      .eq('user_id', user.id)
      .maybeSingle()
    if (ap) {
      setMktPublic(!!ap.marketing_contact_public)
      setMktEmail(ap.marketing_email ?? '')
      setMktPhone(ap.marketing_phone ?? '')
      setOneLine(ap.one_line ?? '')
      setIntro(ap.intro ?? '')
      setBrands(ap.brands ?? '')
      setHistory(ap.history ?? '')
    }
    // 본인 user_private는 RLS(본인·관리자)로 조회 가능
    const { data: priv } = await supabase
      .from('user_private')
      .select('email')
      .eq('user_id', user.id)
      .maybeSingle()
    setFallbackEmail(priv?.email ?? '')
    const { data: prof } = await supabase
      .from('profiles')
      .select('manager_phone')
      .eq('id', user.id)
      .maybeSingle()
    setFallbackPhone(prof?.manager_phone ?? '')
    setProfileReady(true)
  }

  useEffect(() => { load(); loadProfile() }, [])

  // ⚠️ RLS 에 걸려 한 행도 못 고치면 error 는 null 이고 data 는 [] 다. await 만 하고
  // 결과를 안 보면 「저장됐다」로 읽힌다 — 실제로 이 화면의 저장은 전부 버려지고 있었고
  // (intro·one_line·brands·history·marketing_phone 이 DB 에서 전부 비어 있었다)
  // 화면엔 아무 표시도 안 났다. 그래서 .select() 로 돌아온 행을 센다.
  const persistAdvProfile = async (
    patch: Record<string, string | boolean | null>,
  ): Promise<boolean> => {
    if (!myId) return false
    const { data, error } = await supabase
      .from('advertiser_profiles')
      .update(patch)
      .eq('user_id', myId)
      .select('user_id')
    const ok = !error && (data?.length ?? 0) > 0
    setProfileError(ok ? '' : '저장되지 않았어요. 새로고침 후 다시 시도해주세요.')
    return ok
  }

  const toggleMktPublic = async () => {
    if (!myId) return
    const next = !mktPublic
    setMktPublic(next)
    // 저장이 안 됐으면 토글도 되돌린다 — 켜진 채로 두면 공개된 줄 안다.
    if (!(await persistAdvProfile({ marketing_contact_public: next }))) setMktPublic(!next)
  }

  // 「다른 연락처로 받기」 입력 — 비우면 저장도 빈 값이라 미리보기가 폴백으로 돌아간다
  const persistContact = (patch: { marketing_email?: string | null; marketing_phone?: string | null }) =>
    persistAdvProfile(patch)

  // 직접 작성 항목 — 빈 값은 null로 저장(읽는 쪽 ap?.brands && 조건이 그대로 동작)
  const persistProfile = (patch: {
    one_line?: string | null; intro?: string | null; brands?: string | null; history?: string | null
  }) => persistAdvProfile(patch)

  const previewEmail = mktEmail.trim() || fallbackEmail
  const previewPhone = mktPhone.trim() || fallbackPhone
  // 한 줄 소개 비었을 때 안내용 — 읽는 쪽([id]/page.tsx:110)과 동일한 첫 문장 규칙
  const introFirst = intro.trim() ? intro.split(/(?<=[.!?。])\s|\n/)[0]?.trim() : ''

  const invite = async () => {
    if (!email.trim()) { setError('이메일을 입력해주세요.'); return }
    setSubmitting(true)
    setError('')
    const res = await inviteTeamMember(email)
    setSubmitting(false)
    if (!res.ok) { setError(res.error); return }
    setEmail('')
    load()
  }

  // 재발송 = 초대 링크(토큰) 재발급. 같은 이메일로 다시 초대하면 새 토큰이 발급된다.
  const resend = async (m: Member) => {
    setBusyId(m.id)
    setError('')
    // 위 최초 초대와 같이 결과를 받는다 — 예전엔 실패해도 조용해서 재발송이 된 줄 알았다(D23)
    try {
      const res = await inviteTeamMember(m.email)
      if (!res.ok) { setError(res.error); return }
    } catch {
      setError('초대를 다시 보내지 못했어요. 잠시 뒤 다시 시도해주세요.')
      return
    } finally {
      setBusyId(null)
    }
    load()
  }

  const copyLink = async (m: Member) => {
    if (!m.invite_token) return
    const url = `${window.location.origin}/signup?invite=${m.invite_token}`
    try { await navigator.clipboard.writeText(url) } catch { /* 클립보드 권한 없을 때 무시 */ }
    setCopiedId(m.id)
    setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 1500)
  }

  // 「해제」 대신 「퇴사 예정으로 전환」 — 합의한 퇴사일(leave_on)을 적고, 담당 건은 이관 화면에서 넘긴다.
  const submitLeaving = async (m: Member) => {
    if (!leaveDate) { setRowError('퇴사 예정일을 골라주세요.'); return }
    setRowError('')
    setBusyId(m.id)
    const res = await setLeaving(m.id, leaveDate)
    setBusyId(null)
    if (!res.ok) { setRowError(res.error); return }
    setLeavingId(null)
    setLeaveDate('')
    load()
  }

  // 퇴사 예정 전환 취소 → 활동중으로 되돌린다.
  const undoLeaving = async (m: Member) => {
    setRowError('')
    setBusyId(m.id)
    const res = await cancelLeaving(m.id)
    setBusyId(null)
    if (!res.ok) { setRowError(res.error); return }
    load()
  }

  // 비활성 팀원 다시 활성화(기존 동작 유지).
  const reactivate = async (m: Member) => {
    setRowError('')
    setBusyId(m.id)
    await supabase.from('team_members').update({ status: 'active' }).eq('id', m.id)
    setBusyId(null)
    load()
  }

  const kpiInvited = members.filter((m) => m.status === 'invited').length
  const kpiActive = members.filter((m) => m.status === 'active').length

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 [.adv-pc_&]:max-w-none [.adv-pc_&]:px-0 [.adv-pc_&]:py-0">
      <div className="flex items-center mb-6">
        <Link href="/advertiser/dashboard" className="mr-4 text-gray-400 hover:text-gray-600 [.adv-pc_&]:hidden">← 뒤로</Link>
        <h1 className="text-xl font-bold text-gray-900">팀 멤버</h1>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white border border-[#EAEAEE] rounded-xl px-4 py-3">
          <p className="text-xs text-[#7C7C88]">활동중</p>
          <p className="text-xl font-extrabold mt-0.5">{kpiActive}명</p>
        </div>
        <div className="bg-white border border-[#EAEAEE] rounded-xl px-4 py-3">
          <p className="text-xs text-[#7C7C88]">초대 대기</p>
          <p className="text-xl font-extrabold text-[#B45309] mt-0.5">{kpiInvited}명</p>
        </div>
      </div>

      {/* 초대 폼 */}
      <div className="bg-white border border-[#EAEAEE] rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-bold text-gray-800 mb-3">팀원 초대</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 주소"
            className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            onClick={invite}
            disabled={submitting}
            className="bg-[#F59E0B] text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-[#D97706] transition disabled:opacity-50"
          >
            {submitting ? '초대 중...' : '초대하기'}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        <p style={{ fontSize: 11.5, color: '#7C7C88', lineHeight: 1.65 }} className="mt-2">
          초대받은 분은 <b>팀원</b>이 되어 캠페인 등록 · 딜시트 · 정산 기록을 직접 할 수 있어요.
          회사의 사업자 정보 수정과 팀 초대는 <b>대표</b>만 할 수 있습니다.
        </p>
        <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
          초대하면 아래 목록에 &quot;초대 대기&quot;로 뜨고, <span className="text-[#B45309] font-medium">링크 복사</span> 버튼으로 초대 링크를 전달하세요.
          링크로 가입하면 사업자 정보를 다시 넣지 않아도 돼요. 링크는 7일간 유효합니다.
        </p>
      </div>

      {/* 공개 프로필 — 대표만. 팀원 로그인 배선이 붙는 차수에서 팀원 숨김 처리 예정 */}
      <div className="bg-white border border-[#EAEAEE] rounded-2xl p-5 mb-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h2 className="text-sm font-bold text-gray-800">공개 프로필</h2>
            <p className="text-xs text-[#7C7C88] mt-0.5">인플루언서가 보는 회사 페이지에요.</p>
          </div>
          {myId && (
            <Link
              href={`/advertiser/${myId}`}
              target="_blank"
              className="shrink-0 text-xs font-semibold text-[#B45309] hover:underline whitespace-nowrap"
            >
              회사 페이지 보기 →
            </Link>
          )}
        </div>

        {/* 자동 저장이라 누를 버튼이 없다 — 안 됐으면 이 자리에 뜬다 */}
        {profileError && (
          <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2 mb-2">{profileError}</div>
        )}

        {/* 값이 도착하기 전에는 입력칸을 그리지 않는다 — 이 카드는 onBlur 자동 저장이라
            빈 칸을 건드리는 순간 그대로 저장돼 기존 소개·브랜드·연혁이 날아간다. */}
        {!profileReady && (
          <p className="text-xs text-[#7C7C88] mt-4 py-6 text-center">불러오는 중…</p>
        )}

        {profileReady && (
        <>
        {/* 토글 — 마케팅 문의 연락처 공개 */}
        <div className="flex items-start justify-between gap-3 mt-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">마케팅 문의 연락처 공개</p>
            <p style={{ fontSize: 11.5, color: '#7C7C88', lineHeight: 1.6 }} className="mt-0.5">
              켜면 회사 페이지에 이메일과 전화가 보여요. 대행 문의를 받고 싶을 때 켜세요.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={mktPublic}
            onClick={toggleMktPublic}
            className="shrink-0 mt-0.5"
            style={{
              width: 44, height: 26, borderRadius: 13, position: 'relative',
              background: mktPublic ? '#F59E0B' : '#D8D8DE', transition: 'background .15s',
            }}
          >
            <span
              style={{
                position: 'absolute', top: 3, left: mktPublic ? 21 : 3, width: 20, height: 20,
                borderRadius: '50%', background: '#fff', transition: 'left .15s',
                boxShadow: '0 1px 2px rgba(0,0,0,.2)',
              }}
            />
          </button>
        </div>

        {mktPublic && (
          <>
            {/* 지금 공개되는 값 (미리보기) */}
            <div style={{ background: '#FBFBFC', border: '1px solid #EFEFF2', borderRadius: 10, padding: '12px 13px' }} className="mt-3">
              <p style={{ fontSize: 11, color: '#9A9AA5' }}>이메일</p>
              <p style={{ fontSize: 12.5, color: '#3C3C46' }} className="mb-2 break-all">{previewEmail || '—'}</p>
              <p style={{ fontSize: 11, color: '#9A9AA5' }}>전화</p>
              <p style={{ fontSize: 12.5, color: '#3C3C46' }}>{previewPhone || '—'}</p>
            </div>

            {/* 다른 연락처로 받기 (선택) */}
            <button
              type="button"
              onClick={() => setShowContactInputs((v) => !v)}
              className="text-xs font-medium text-[#B45309] hover:underline mt-3"
            >
              {showContactInputs ? '접기' : '다른 연락처로 받기'}
            </button>

            {showContactInputs && (
              <div className="mt-3 space-y-2">
                <input
                  type="email"
                  value={mktEmail}
                  onChange={(e) => setMktEmail(e.target.value)}
                  onBlur={() => persistContact({ marketing_email: mktEmail.trim() || null })}
                  placeholder={fallbackEmail || '마케팅 이메일'}
                  className="w-full"
                  style={{ height: 46, borderRadius: 11, padding: '0 13px', fontSize: 13.5, border: '1px solid #E2E2E8' }}
                />
                <input
                  type="tel"
                  value={mktPhone}
                  onChange={(e) => setMktPhone(e.target.value)}
                  onBlur={() => persistContact({ marketing_phone: mktPhone.trim() || null })}
                  placeholder={fallbackPhone || '마케팅 전화'}
                  className="w-full"
                  style={{ height: 46, borderRadius: 11, padding: '0 13px', fontSize: 13.5, border: '1px solid #E2E2E8' }}
                />
                <p style={{ fontSize: 11, color: '#7C7C88' }}>비우면 기본값으로 돌아가요.</p>
              </div>
            )}
          </>
        )}

        {/* ── 직접 작성 항목 (한 줄 소개·소개·브랜드·이력) — 읽는 쪽 /advertiser/[id] 에 그대로 노출 ── */}
        <div style={{ borderTop: '1px solid #EFEFF2' }} className="mt-5 pt-5">
          <p style={{ fontSize: 11.5, color: '#7C7C88', lineHeight: 1.65 }}>
            비워두면 회사 페이지에 그 항목이 안 보여요. 인플루언서가 처음 보는 화면이니 어떤 일을 하는 곳인지만 적어도 충분해요.
          </p>

          <div className="flex flex-col" style={{ gap: 14, marginTop: 14 }}>
            {/* 한 줄 소개 */}
            <div>
              <label className="flex items-center gap-1.5">
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#3C3C46' }}>한 줄 소개</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#B0B0BB' }}>선택</span>
              </label>
              <input
                value={oneLine}
                onChange={(e) => setOneLine(e.target.value)}
                onBlur={() => persistProfile({ one_line: oneLine.trim() || null })}
                placeholder="비우면 소개의 첫 문장이 쓰여요"
                className="w-full mt-1.5"
                style={{ border: '1px solid #E2E2E8', borderRadius: 10, padding: '0 13px', height: 46, fontSize: 12.5, fontFamily: 'inherit', color: '#17171B', outline: 'none' }}
              />
              {!oneLine.trim() && (
                <p style={{ fontSize: 11, color: '#9A9AA5', marginTop: 6 }}>
                  {introFirst
                    ? `지금은 소개의 첫 문장이 쓰여요 — "${introFirst}"`
                    : '소개를 적으면 첫 문장이 자동으로 쓰여요'}
                </p>
              )}
            </div>

            {/* 소개 */}
            <div>
              <label className="flex items-center gap-1.5">
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#3C3C46' }}>소개</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#B0B0BB' }}>선택</span>
              </label>
              <textarea
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                onBlur={() => persistProfile({ intro: intro.trim() || null })}
                placeholder="어떤 일을 하는 곳인지 적어주세요."
                className="w-full mt-1.5"
                style={{ border: '1px solid #E2E2E8', borderRadius: 10, padding: '12px 13px', minHeight: 110, fontSize: 12.5, fontFamily: 'inherit', color: '#17171B', outline: 'none', resize: 'vertical' }}
              />
            </div>

            {/* 함께 일하는 브랜드 */}
            <div>
              <label className="flex items-center gap-1.5">
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#3C3C46' }}>함께 일하는 브랜드</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#B0B0BB' }}>선택</span>
              </label>
              <textarea
                value={brands}
                onChange={(e) => setBrands(e.target.value)}
                onBlur={() => persistProfile({ brands: brands.trim() || null })}
                placeholder="한 줄에 하나씩 적어주세요."
                className="w-full mt-1.5"
                style={{ border: '1px solid #E2E2E8', borderRadius: 10, padding: '12px 13px', minHeight: 90, fontSize: 12.5, fontFamily: 'inherit', color: '#17171B', outline: 'none', resize: 'vertical' }}
              />
              <p style={{ fontSize: 11, color: '#7C7C88', lineHeight: 1.6, marginTop: 6 }}>
                한 줄에 하나씩. 인플루언서가 &quot;이 회사가 어떤 브랜드를 다루나&quot;를 봅니다.
              </p>
            </div>

            {/* 주요 이력 */}
            <div>
              <label className="flex items-center gap-1.5">
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#3C3C46' }}>주요 이력</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#B0B0BB' }}>선택</span>
              </label>
              <textarea
                value={history}
                onChange={(e) => setHistory(e.target.value)}
                onBlur={() => persistProfile({ history: history.trim() || null })}
                placeholder="한 줄에 하나씩 적어주세요."
                className="w-full mt-1.5"
                style={{ border: '1px solid #E2E2E8', borderRadius: 10, padding: '12px 13px', minHeight: 110, fontSize: 12.5, fontFamily: 'inherit', color: '#17171B', outline: 'none', resize: 'vertical' }}
              />
              <p style={{ fontSize: 11, color: '#7C7C88', lineHeight: 1.6, marginTop: 6 }}>
                한 줄에 하나씩. 예: 2025 성수 카페 오픈 캠페인 · 인플루언서 12명
              </p>
            </div>
          </div>
        </div>
        </>
        )}
      </div>

      {/* 표 */}
      {rowError && <p className="text-xs text-red-500 mb-2">{rowError}</p>}
      {loading ? (
        <p className="text-center text-gray-400 py-12">불러오는 중...</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-gray-400 bg-white rounded-2xl p-5 shadow-sm text-center">아직 초대한 팀원이 없어요.</p>
      ) : (
        <div className="bg-white border border-[#EAEAEE] rounded-2xl overflow-hidden">
          {members.map((m) => {
            const rc = ROLE_COLOR[m.role] ?? ROLE_COLOR['팀원']
            const roleLabel = m.role === '대표' ? '대표' : '팀원'
            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#F5F5F7] last:border-b-0">
                <div className="w-9 h-9 rounded-full bg-[#FEF3C7] text-[#B45309] text-xs font-extrabold flex items-center justify-center shrink-0">
                  {initial(m.name ?? m.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 truncate">{m.name ?? m.email}</p>
                  <p className="text-xs text-gray-400 truncate">{m.email}</p>
                </div>
                <span className="shrink-0" style={{ background: rc.bg, color: rc.fg, fontSize: 11.5, fontWeight: 800, borderRadius: 5, padding: '3px 8px' }}>
                  {roleLabel}
                </span>
                <span className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-full ${STATUS_STYLE[m.status]}`}>
                  {STATUS_LABEL[m.status]}
                </span>
                {m.status === 'leaving' && m.leave_on && (
                  <span className="shrink-0 text-[11px] text-[#B45309] font-medium">~{m.leave_on}</span>
                )}
                {m.status === 'invited' && (
                  <>
                    {m.invite_token && (
                      <button
                        onClick={() => copyLink(m)}
                        className="shrink-0 text-xs text-[#B45309] font-medium hover:underline"
                      >
                        {copiedId === m.id ? '복사됨' : '링크 복사'}
                      </button>
                    )}
                    <button
                      onClick={() => resend(m)}
                      disabled={busyId === m.id}
                      className="shrink-0 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    >
                      재발송
                    </button>
                  </>
                )}
                {/* 활동중 → 「퇴사 예정으로 전환」: 클릭하면 퇴사일 입력이 열린다 */}
                {m.status === 'active' && (
                  leavingId === m.id ? (
                    <div className="shrink-0 flex items-center gap-1.5">
                      <input
                        type="date"
                        value={leaveDate}
                        min={today}
                        onChange={(e) => setLeaveDate(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <button
                        onClick={() => submitLeaving(m)}
                        disabled={busyId === m.id}
                        className="text-xs font-bold text-[#B45309] hover:underline disabled:opacity-50"
                      >
                        확인
                      </button>
                      <button
                        onClick={() => { setLeavingId(null); setLeaveDate(''); setRowError('') }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setRowError(''); setLeaveDate(''); setLeavingId(m.id) }}
                      disabled={busyId === m.id}
                      className="shrink-0 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    >
                      퇴사 예정으로 전환
                    </button>
                  )
                )}
                {/* 퇴사 예정 → 이관 화면으로 넘어가 담당을 옮긴다 · 전환 취소 */}
                {m.status === 'leaving' && (
                  <>
                    {m.member_id && (
                      <Link
                        href={`/advertiser/team/handover/${m.member_id}`}
                        className="shrink-0 text-xs text-[#B45309] font-medium hover:underline"
                      >
                        이관 화면
                      </Link>
                    )}
                    <button
                      onClick={() => undoLeaving(m)}
                      disabled={busyId === m.id}
                      className="shrink-0 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    >
                      전환 취소
                    </button>
                  </>
                )}
                {m.status === 'inactive' && (
                  <button
                    onClick={() => reactivate(m)}
                    disabled={busyId === m.id}
                    className="shrink-0 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  >
                    다시 활성화
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
