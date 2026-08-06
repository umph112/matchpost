'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { initial } from '@/lib/initial'
import { inviteTeamMember } from '@/lib/team/actions'

type Role = '담당자' | '관리자'
type Status = 'invited' | 'active' | 'inactive'

type Member = {
  id: string
  email: string
  role: Role
  status: Status
  invited_at: string
  joined_at: string | null
  member_id: string | null
  name?: string | null
}

const STATUS_STYLE: Record<Status, string> = {
  invited: 'bg-[#FEF3C7] text-[#B45309]',
  active: 'bg-[#DCFCE7] text-[#15803D]',
  inactive: 'bg-[#F1F1F4] text-[#7C7C88]',
}
const STATUS_LABEL: Record<Status, string> = {
  invited: '초대 대기',
  active: '활동중',
  inactive: '비활성',
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('담당자')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const supabase = createClient()

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('team_members')
      .select('id, email, role, status, invited_at, joined_at, member_id')
      .order('created_at', { ascending: false })

    const memberIds = [...new Set((data ?? []).filter((m) => m.member_id).map((m) => m.member_id as string))]
    const { data: profiles } = memberIds.length
      ? await supabase.from('profiles').select('id, name').in('id', memberIds)
      : { data: [] }
    const nameById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.name]))

    setMembers((data ?? []).map((m) => ({ ...m, name: m.member_id ? nameById[m.member_id] : null })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const invite = async () => {
    if (!email.trim()) { setError('이메일을 입력해주세요.'); return }
    setSubmitting(true)
    setError('')
    const res = await inviteTeamMember(email, role)
    setSubmitting(false)
    if (!res.ok) { setError(res.error); return }
    setEmail('')
    setRole('담당자')
    load()
  }

  const changeRole = async (id: string, newRole: Role) => {
    setBusyId(id)
    await supabase.from('team_members').update({ role: newRole }).eq('id', id)
    setBusyId(null)
    load()
  }

  const resend = async (id: string) => {
    setBusyId(id)
    await supabase.from('team_members').update({ invited_at: new Date().toISOString() }).eq('id', id)
    setBusyId(null)
    load()
  }

  const toggleActive = async (id: string, current: Status) => {
    setBusyId(id)
    const next = current === 'active' ? 'inactive' : 'active'
    await supabase.from('team_members').update({ status: next }).eq('id', id)
    setBusyId(null)
    load()
  }

  const kpiInvited = members.filter((m) => m.status === 'invited').length
  const kpiActive = members.filter((m) => m.status === 'active').length

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Link href="/advertiser/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">← 뒤로</Link>
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
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="담당자">담당자</option>
            <option value="관리자">관리자</option>
          </select>
          <button
            onClick={invite}
            disabled={submitting}
            className="bg-[#F59E0B] text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-[#D97706] transition disabled:opacity-50"
          >
            {submitting ? '초대 중...' : '초대하기'}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        <p className="text-[11px] text-gray-400 mt-2">
          아직 가입하지 않은 이메일이면 "초대 대기"로 남고, 그 이메일로 가입하는 순간 자동 연결돼요.
        </p>
      </div>

      {/* 표 */}
      {loading ? (
        <p className="text-center text-gray-400 py-12">불러오는 중...</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-gray-400 bg-white rounded-2xl p-5 shadow-sm text-center">아직 초대한 팀원이 없어요.</p>
      ) : (
        <div className="bg-white border border-[#EAEAEE] rounded-2xl overflow-hidden">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#F5F5F7] last:border-b-0">
              <div className="w-9 h-9 rounded-full bg-[#FEF3C7] text-[#B45309] text-xs font-extrabold flex items-center justify-center shrink-0">
                {initial(m.name ?? m.email)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800 truncate">{m.name ?? m.email}</p>
                <p className="text-xs text-gray-400 truncate">{m.email}</p>
              </div>
              <select
                value={m.role}
                onChange={(e) => changeRole(m.id, e.target.value as Role)}
                disabled={busyId === m.id}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none disabled:opacity-50"
              >
                <option value="담당자">담당자</option>
                <option value="관리자">관리자</option>
              </select>
              <span className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-full ${STATUS_STYLE[m.status]}`}>
                {STATUS_LABEL[m.status]}
              </span>
              {m.status === 'invited' && (
                <button
                  onClick={() => resend(m.id)}
                  disabled={busyId === m.id}
                  className="shrink-0 text-xs text-[#B45309] hover:underline disabled:opacity-50"
                >
                  재발송
                </button>
              )}
              {(m.status === 'active' || m.status === 'inactive') && (
                <button
                  onClick={() => toggleActive(m.id, m.status)}
                  disabled={busyId === m.id}
                  className="shrink-0 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                  {m.status === 'active' ? '비활성화' : '다시 활성화'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
