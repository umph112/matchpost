'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function AdvertiserProposalsPage() {
  const [proposals, setProposals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all')
  const supabase = createClient()

  useEffect(() => {
    const fetchProposals = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('proposals')
        .select(`
          *,
          schedules (title, date, location_city, location_district),
          profiles!influencer_id (name)
        `)
        .eq('advertiser_id', user.id)
        .order('created_at', { ascending: false })

      setProposals(data ?? [])
      setLoading(false)
    }
    fetchProposals()
  }, [])

  const filtered = proposals.filter(p => filter === 'all' || p.status === filter)

  const statusInfo = (status: string) => {
    if (status === 'pending') return { label: '검토 중', color: 'bg-orange-100 text-orange-600' }
    if (status === 'accepted') return { label: '수락됨', color: 'bg-[#FEF3C7] text-[#B45309]' }
    if (status === 'rejected') return { label: '거절됨', color: 'bg-red-100 text-red-500' }
    if (status === 'completed') return { label: '완료', color: 'bg-green-100 text-green-600' }
    return { label: status, color: 'bg-gray-100 text-gray-500' }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center mb-8">
        <Link href="/advertiser/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">
          ← 뒤로
        </Link>
        <h1 className="text-xl font-bold text-gray-900">보낸 제안</h1>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(['all', 'pending', 'accepted', 'rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
              filter === f
                ? 'bg-[#F59E0B] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? '전체' : f === 'pending' ? '검토 중' : f === 'accepted' ? '수락됨' : '거절됨'}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-16 text-gray-400">불러오는 중...</div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-500 mb-4">아직 보낸 제안이 없어요</p>
          <Link
            href="/advertiser/search"
            className="bg-[#F59E0B] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#D97706] transition"
          >
            인플루언서 찾기
          </Link>
        </div>
      )}

      {filtered.map((proposal) => {
        const { label, color } = statusInfo(proposal.status)
        return (
          <div key={proposal.id} className="bg-white rounded-2xl p-5 shadow-sm mb-3">
            {/* 상단 */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-800">{proposal.profiles?.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{proposal.collaboration_type}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${color}`}>
                {label}
              </span>
            </div>

            {/* 일정 정보 */}
            <div className="bg-gray-50 rounded-xl p-3 mb-3 text-sm">
              <p className="font-medium text-gray-700">{proposal.schedules?.title}</p>
              <p className="text-xs text-gray-400 mt-1">
                📅 {new Date(proposal.schedules?.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                　📍 {proposal.schedules?.location_city} {proposal.schedules?.location_district}
              </p>
            </div>

            {/* 예산 */}
            {proposal.budget && (
              <p className="text-sm text-gray-600 mb-2">
                💰 제안 예산: <span className="font-semibold">{proposal.budget.toLocaleString()}원</span>
              </p>
            )}

            {/* 메시지 */}
            <p className="text-sm text-gray-600 mb-3 line-clamp-3">{proposal.message}</p>

            <p className="text-xs text-gray-300">
              {new Date(proposal.created_at).toLocaleDateString('ko-KR')}
            </p>
          </div>
        )
      })}
    </div>
  )
}