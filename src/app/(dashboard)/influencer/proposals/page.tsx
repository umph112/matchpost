'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { listTime, dateWithDow } from '@/lib/date'
import { CalendarDays, Wallet, MapPin, Inbox } from 'lucide-react'

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

    const rows = data ?? []

    // 브랜드명(캠페인) + 회사 상호(광고주) 배치 조회
    // 고르는 화면 계열이라 브랜드가 있으면 그대로 노출 — 비면 회사 상호, 그것도 없으면 개인명
    // (구현 schedule 기반 옛 제안은 campaign_id 가 없어 null 이 정상값 → 폴백이 처리한다)
    const campIds = [...new Set(rows.map((r) => r.campaign_id).filter(Boolean))]
    const brandByCamp: Record<string, string | null> = {}
    if (campIds.length > 0) {
      const { data: camps } = await supabase
        .from('campaigns')
        .select('id, brand_name')
        .in('id', campIds)
      ;(camps ?? []).forEach((c) => { brandByCamp[c.id] = c.brand_name })
    }
    const advIds = [...new Set(rows.map((r) => r.advertiser_id).filter(Boolean))]
    const companyByAdv: Record<string, string | null> = {}
    if (advIds.length > 0) {
      const { data: aps } = await supabase
        .from('advertiser_profiles')
        .select('user_id, company_name')
        .in('user_id', advIds)
      ;(aps ?? []).forEach((a) => { companyByAdv[a.user_id] = a.company_name })
    }
    rows.forEach((r) => {
      r.displayName = brandByCamp[r.campaign_id] ?? companyByAdv[r.advertiser_id] ?? r.profiles?.name ?? '광고주'
    })

    setProposals(rows)
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
    if (status === 'accepted') return { label: '수락됨', color: 'bg-[#FEF3C7] text-[#B45309]' }
    if (status === 'rejected') return { label: '거절됨', color: 'bg-red-100 text-red-500' }
    if (status === 'completed') return { label: '완료', color: 'bg-green-100 text-green-600' }
    return { label: status, color: 'bg-gray-100 text-gray-500' }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 [.inf-pc_&]:max-w-none [.inf-pc_&]:px-0 [.inf-pc_&]:py-0">
      {/* 헤더 */}
      <div className="flex items-center mb-8">
        <Link href="/influencer/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">
          ← 뒤로
        </Link>
        <h1 className="text-xl font-bold text-gray-900">받은 대시</h1>
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
          <Inbox size={32} strokeWidth={1.5} className="text-[#C4C4CE] mx-auto mb-4" />
          <p className="text-gray-500">아직 받은 대시가 없어요</p>
        </div>
      )}

      {filtered.map((proposal) => {
        const { label, color } = statusInfo(proposal.status)
        return (
          <div key={proposal.id} className="bg-white rounded-2xl p-5 shadow-sm mb-3">
            {/* 상단 */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-800">
                  <Link href={`/advertiser/${proposal.advertiser_id}`} className="hover:underline">{proposal.displayName}</Link>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{proposal.collaboration_type}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${color}`}>
                {label}
              </span>
            </div>

            {/* 일정 정보 */}
            <div className="bg-gray-50 rounded-xl p-3 mb-3 text-sm">
              <p className="font-medium text-gray-700">{proposal.schedules?.title}</p>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <CalendarDays size={16} strokeWidth={1.75} /> {dateWithDow(proposal.schedules?.date)}
                <MapPin size={16} strokeWidth={1.75} className="ml-1.5" /> {proposal.schedules?.location_city} {proposal.schedules?.location_district}
              </p>
            </div>

            {/* 예산 */}
            {proposal.budget && (
              <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                <Wallet size={16} strokeWidth={1.75} /> 제안 예산: <span className="font-semibold">{proposal.budget.toLocaleString()}원</span>
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
                  className="py-2 rounded-lg text-sm font-medium bg-[#F59E0B] text-white hover:bg-[#D97706] transition"
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
    대시 열기
  </a>
)}

            <p className="text-xs text-gray-300 mt-3">
              {listTime(proposal.created_at)}
            </p>
          </div>
        )
      })}
    </div>
  )
}