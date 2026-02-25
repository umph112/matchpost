'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

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

    setUsers(data ?? [])
    setLoading(false)
  }

  const handleApprove = async (userId: string) => {
    await supabase
      .from('profiles')
      .update({ status: 'approved' })
      .eq('id', userId)
    fetchUsers()
  }

  const handleReject = async (userId: string) => {
    const reason = prompt('거절 사유를 입력해주세요:')
    if (!reason) return
    await supabase
      .from('profiles')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', userId)
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
        <Link href="/admin/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">
          ← 뒤로
        </Link>
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
                ? 'bg-blue-600 text-white'
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
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold mr-3">
                    {user.name?.[0] ?? '?'}
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
                <span>📱 {user.phone}</span>
                <span className="mx-2">·</span>
                <span>가입일 {new Date(user.created_at).toLocaleDateString('ko-KR')}</span>
              </div>

              {user.rejection_reason && (
                <div className="bg-red-50 text-red-600 text-xs p-2 rounded-lg mb-3">
                  거절 사유: {user.rejection_reason}
                </div>
              )}

              {user.status === 'pending' && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleReject(user.id)}
                    className="py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                  >
                    거절
                  </button>
                  <button
                    onClick={() => handleApprove(user.id)}
                    className="py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition"
                  >
                    승인
                  </button>
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