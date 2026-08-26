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
    const campById: Record<string, any> = {}
    if (campIds.length > 0) {
      // brand_name 만 읽던 것을 제목·지역까지 넓혔다(D32 3절 후속) — 아래 displayTitle 참고.
      const { data: camps } = await supabase
        .from('campaigns')
        .select('id, brand_name, title, location_city, location_district')
        .in('id', campIds)
      ;(camps ?? []).forEach((c) => { campById[c.id] = c })
    }
    const advIds = [...new Set(rows.map((r) => r.advertiser_id).filter(Boolean))]
    const companyByAdv: Record<string, string | null> = {}
    if (advIds.length > 0) {
      // 남의 회사명이라 advertiser_public 뷰로 읽는다(0095)
      const { data: aps } = await supabase
        .from('advertiser_public')
        .select('user_id, company_name')
        .in('user_id', advIds)
      ;(aps ?? []).forEach((a) => { companyByAdv[a.user_id] = a.company_name })
    }
    // 이 목록엔 두 종류가 섞여 있다 — 광고주가 보낸 오픈 대시(schedule_id)와
    // 내가 캠페인에 넣은 지원(campaign_id). 카드는 그동안 schedules 만 읽어서,
    // 캠페인 지원 줄은 제목·날짜·지역이 통째로 비어 아이콘만 남은 상자로 보였다.
    // 반려 사유를 붙여도 무엇에 대한 반려인지 알 수 없었다(D32 2절 후속).
    //
    //   오픈 대시   제목=오픈 제목    날짜=오픈 날짜        지역=오픈 지역
    //   캠페인 지원 제목=캠페인 제목  날짜=내가 낸 희망일   지역=캠페인 지역
    //
    // 캠페인 날짜만 캠페인이 아닌 proposals 에서 읽는다 — 캠페인은 기간(dates)으로 열리고
    // 그중 어느 날에 가겠다고 적은 값이 proposed_date 라, 지원한 사람이 볼 날짜는 이쪽이다.
    rows.forEach((r) => {
      const camp = r.campaign_id ? campById[r.campaign_id] : null
      r.displayName = camp?.brand_name ?? companyByAdv[r.advertiser_id] ?? r.profiles?.name ?? '광고주'
      r.displayTitle = camp ? camp.title : r.schedules?.title
      r.displayDate = camp ? r.proposed_date : r.schedules?.date
      r.displayCity = camp ? camp.location_city : r.schedules?.location_city
      r.displayDistrict = camp ? camp.location_district : r.schedules?.location_district
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
        <Link href="/influencer/dashboard" className="hidden [.inf-pc_&]:inline-block mr-4 text-gray-400 hover:text-gray-600">
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

            {/* 일정 정보 — 오픈이면 오픈의 것, 캠페인 지원이면 캠페인의 것(위 fetchProposals 참고).
                값이 없으면 그 줄을 아예 안 그린다 — 아이콘만 남은 껍데기는 빠뜨린 것처럼 읽힌다. */}
            {(proposal.displayTitle || proposal.displayDate || proposal.displayCity) && (
              <div className="bg-gray-50 rounded-xl p-3 mb-3 text-sm">
                {proposal.displayTitle && (
                  <p className="font-medium text-gray-700">{proposal.displayTitle}</p>
                )}
                {(proposal.displayDate || proposal.displayCity) && (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    {proposal.displayDate && (
                      <>
                        <CalendarDays size={16} strokeWidth={1.75} /> {dateWithDow(proposal.displayDate)}
                      </>
                    )}
                    {proposal.displayCity && (
                      <>
                        <MapPin size={16} strokeWidth={1.75} className={proposal.displayDate ? 'ml-1.5' : undefined} /> {proposal.displayCity} {proposal.displayDistrict}
                      </>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* 예산 */}
            {proposal.budget && (
              <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                <Wallet size={16} strokeWidth={1.75} /> 제안 예산: <span className="font-semibold">{proposal.budget.toLocaleString()}원</span>
              </p>
            )}

            {/* 메시지 */}
            <p className="text-sm text-gray-600 mb-4 line-clamp-3">{proposal.message}</p>

            {/* 반려 사유 (D32 2절) —
                알림은 지나가면 사라지는데 사유는 다음 지원에 참고할 값이라 줄에 붙여 둔다.
                사유는 선택이라 안 적고 반려한 건도 있다 — 그때는 이 줄 자체를 안 띄운다.
                (reject_reason 은 광고주가 지원을 반려할 때만 찬다. 인플루언서가 받은 대시를
                 거절한 줄도 status 는 'rejected' 지만 사유는 비어 있어 여기 안 걸린다.) */}
            {proposal.status === 'rejected' && proposal.reject_reason && (
              <p className="text-sm text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-3 py-2 mb-4">
                <span className="font-semibold">반려</span>
                <span className="text-[#DC2626]"> · </span>
                <span className="text-[#7F1D1D]">{proposal.reject_reason}</span>
              </p>
            )}

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
  <div className="grid grid-cols-2 gap-2 mt-2">
    <a
      href={"/influencer/messages?proposalId=" + proposal.id + "&receiverId=" + proposal.advertiser_id}
      className="py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition text-center block"
    >
      대시 열기
    </a>
    {/* D29 1번 — 성사된 뒤 진행 단계를 보는 자리 */}
    <Link
      href={`/influencer/deals/${proposal.id}`}
      className="py-2 rounded-lg text-sm font-medium border border-[#FDE68A] bg-[#FFFBEB] text-[#B45309] hover:bg-[#FEF3C7] transition text-center block"
    >
      딜시트 열기
    </Link>
  </div>
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