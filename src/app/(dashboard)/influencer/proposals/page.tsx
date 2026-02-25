'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function InfluencerProposalsPage() {
  const [proposals, setProposals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all')
  const supabase = createClient()

  useEffect(() => {
    fetchProposals()
  }, [])

  const fetchProposals = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('proposals')
      .select(`
        *,
        schedules (title, date, location_city, location_district),
        profiles!advertiser_id (name)
      `)
      .eq('influencer_id', user.id)
      .order('created_at', { ascending: false })

    setProposals(data ?? [])
    setLoading(false)
  }

  const handleResponse = async (proposalId: string, status: 'accepted' | 'rejected') => {
    await supabase
      .from('proposals')
      .update({ status })
      .eq('id', proposalId)

    fetchProposals()
  }

  const filtered = proposals.filter(p => filter === 'all' || p.status === filter)

  const statusInfo = (status: string) => {
    if (status === 'pending') return { label: '검토 중', color: 'bg-orange-100 text-orange-600' }
    if (status === 'accepted') return { label: '수락됨', color: 'bg-blue-100 text-blue-600' }
    if (status === 'rejected') return { label: '거절됨', color: 'bg-red-100 text-red-500' }
    if (status === 'completed') return { label: '완료', color: 'bg-green-100 text-green-600' }
    return { label: status, color: 'bg-gray-100 text-gray-500' }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center mb-8">
        <Link href="/influencer/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">
          ← 뒤로
        </Link>
        <h1 className="text-xl font-bold text-gray-900">받은 제안</h1>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(['all', 'pending', 'accepted', 'rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
              filter === f
                ? 'bg-blue-600 text-white'
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
          <div className="text-5xl mb-4">💌</div>
          <p className="text-gray-500">아직 받은 제안이 없어요</p>
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
            <p className="text-sm text-gray-600 mb-4 line-clamp-3">{proposal.message}</p>

            {/* 수락/거절 버튼 */}
            {proposal.status === 'pending' && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleResponse(proposal.id, 'rejected')}
                  className="py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                >
                  거절
                </button>
                <button
                  onClick={() => handleResponse(proposal.id, 'accepted')}
                  className="py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  수락
                </button>
              </div>
            )}

{proposal.status === 'accepted' && (
 <a 
    href={"/influencer/messages?proposalId=" + proposal.id + "&receiverId=" + proposal.advertiser_id}
    className="w-full mt-2 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition text-center block"
  >
    💬 메시지 보내기
  </a>
)}

            <p className="text-xs text-gray-300 mt-3">
              {new Date(proposal.created_at).toLocaleDateString('ko-KR')}
            </p>
          </div>
        )
      })}
    </div>
  )
}