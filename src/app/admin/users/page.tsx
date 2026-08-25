'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { initial } from '@/lib/initial'
import { listTime } from '@/lib/date'
import { formatBizNo } from '@/lib/business-number'
import { cancelStage, type Role } from '@/lib/cancellation/thresholds'
import { Smartphone } from 'lucide-react'

// 관리자 화면에서만 점수를 그대로 보여준다 — 판단하려면 근거가 필요하다.
// cancellation_count는 횟수가 아니라 점수다(가이드 이후 취소 +2).
const CANCEL_STAGE_LABEL = { none: '기록만', notify: '본인 안내', public: '공개 표시' } as const
const CANCEL_STAGE_STYLE = {
  none: 'bg-gray-100 text-gray-500',
  notify: 'bg-[#FFFBEB] text-[#B45309]',
  public: 'bg-[#FEE2E2] text-[#DC2626]',
} as const

function UsersContent() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('전체')
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    if (searchParams.get('filter') === 'pending') setFilter('대기')
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('role', 'admin')
      .order('created_at', { ascending: false })

    // 민감정보(전화·이메일)는 user_private에서 (관리자만 조회 가능)
    const { data: privs } = await supabase
      .from('user_private')
      .select('user_id, phone, email')
    const privMap = Object.fromEntries((privs ?? []).map((p) => [p.user_id, p]))

    // 광고주 사업자정보 (사업자등록번호·상호) — 관리자 조회용
    const { data: advs } = await supabase
      .from('advertiser_profiles')
      .select('user_id, biz_reg_number, company_name')
    const advMap = Object.fromEntries((advs ?? []).map((a) => [a.user_id, a]))

    const merged = (data ?? []).map((u) => ({
      ...u,
      phone: privMap[u.id]?.phone ?? '',
      email: privMap[u.id]?.email ?? '',
      bizRegNumber: advMap[u.id]?.biz_reg_number ?? '',
      companyName: advMap[u.id]?.company_name ?? '',
    }))

    setUsers(merged)
    setLoading(false)
  }

  const deleteBizDoc = async (userId: string) => {
    await fetch('/api/admin/biz-doc', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
  }

  const viewBizDoc = async (userId: string) => {
    const res = await fetch(`/api/admin/biz-doc?userId=${userId}`)
    const j = await res.json()
    if (res.ok) window.open(j.url, '_blank')
    else alert(j.error ?? '서류를 열 수 없어요.')
  }

  const handleApprove = async (userId: string) => {
    await supabase
      .from('profiles')
      .update({ status: 'approved' })
      .eq('id', userId)
    // D7 5-2 — 승인 즉시 서류 원본 삭제, 확인 결과(사업자등록번호)만 남긴다
    await deleteBizDoc(userId)
    fetchUsers()
  }

  const handleReject = async (userId: string) => {
    const reason = prompt('거절 사유를 입력해주세요:')
    if (!reason) return
    await supabase
      .from('profiles')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', userId)
    await deleteBizDoc(userId)
    fetchUsers()
  }

  const filtered = users.filter(u => {
    if (filter === '전체') return true
    if (filter === '대기') return u.status === 'pending'
    if (filter === '승인') return u.status === 'approved'
    if (filter === '거절') return u.status === 'rejected'
    if (filter === '인플루언서') return u.role === 'influencer'
    if (filter === '광고주') return u.role === 'advertiser'
    return true
  })

  const statusInfo = (status: string) => {
    if (status === 'pending') return { label: '대기 중', color: 'bg-orange-100 text-orange-600' }
    if (status === 'approved') return { label: '승인됨', color: 'bg-green-100 text-green-600' }
    if (status === 'rejected') return { label: '거절됨', color: 'bg-red-100 text-red-500' }
    return { label: status, color: 'bg-gray-100 text-gray-500' }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center mb-8">
        <h1 className="text-xl font-bold text-gray-900">회원 관리</h1>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {['전체', '대기', '승인', '거절', '인플루언서', '광고주'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
              filter === f
                ? 'bg-[#F59E0B] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f}
            {f === '대기' && users.filter(u => u.status === 'pending').length > 0 && (
              <span className="ml-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {users.filter(u => u.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-gray-400 py-16">불러오는 중...</p>}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-400">해당하는 회원이 없어요</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((user) => {
          const { label, color } = statusInfo(user.status)
          return (
            <div key={user.id} className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-[#FEF3C7] rounded-full flex items-center justify-center text-[#B45309] font-bold mr-3">
                    {initial(user.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{user.name}</p>
                    <p className="text-xs text-gray-400">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${color}`}>
                    {label}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                    {user.role === 'influencer' ? '인플루언서' : '광고주'}
                  </span>
                </div>
              </div>

              <div className="text-xs text-gray-400 mb-3">
                <span className="inline-flex items-center gap-1"><Smartphone size={16} strokeWidth={1.75} /> {user.phone}</span>
                <span className="mx-2">·</span>
                <span>가입일 {listTime(user.created_at)}</span>
                {(user.cancellation_count ?? 0) > 0 && (() => {
                  const stage = cancelStage(user.role as Role, user.cancellation_count)
                  return (
                    <>
                      <span className="mx-2">·</span>
                      <span className="inline-flex items-center gap-1">
                        <span>취소 {user.cancellation_count}점</span>
                        <span className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold ${CANCEL_STAGE_STYLE[stage]}`}>
                          {CANCEL_STAGE_LABEL[stage]}
                        </span>
                      </span>
                    </>
                  )
                })()}
              </div>

              {user.role === 'advertiser' && user.bizRegNumber && (
                <div className="text-xs text-gray-500 mb-3">
                  <span className="text-gray-400">사업자등록번호</span>{' '}
                  <span className="font-medium tabular-nums">{formatBizNo(user.bizRegNumber)}</span>
                  {user.companyName && <span className="text-gray-400"> · {user.companyName}</span>}
                </div>
              )}

              {user.rejection_reason && (
                <div className="bg-red-50 text-red-600 text-xs p-2 rounded-lg mb-3">
                  거절 사유: {user.rejection_reason}
                </div>
              )}

              {user.status === 'pending' && (
                <div>
                  {/* D6 E2 — 승인 즉시 무엇이 되는지 미리 알린다.
                      ⚠️ 가입 축하금은 여기서 언급하지 않는다. 원장을 보면 가입 시점(api/signup)에
                         이미 지급돼 있고 승인과는 무관하다 — 이미 받은 것을 앞으로 받을 것처럼
                         쓰면 관리자가 잘못 판단한다(D30 PROMPT-3). */}
                  <p className="text-[11px] text-gray-400 mb-2">
                    승인하면 캠페인을 열 수 있습니다.
                  </p>
                  {user.role === 'advertiser' && (
                    <button
                      onClick={() => viewBizDoc(user.id)}
                      className="w-full mb-2 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                    >
                      사업자등록증 보기
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleReject(user.id)}
                      className="py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                    >
                      거절
                    </button>
                    <button
                      onClick={() => handleApprove(user.id)}
                      className="py-2 rounded-lg text-sm font-medium bg-[#F59E0B] text-white hover:bg-[#D97706] transition"
                    >
                      승인
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  return (
    <Suspense>
      <UsersContent />
    </Suspense>
  )
}