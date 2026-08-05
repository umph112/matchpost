'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import PaidConfirmModal from '@/components/PaidConfirmModal'

const STATUS_FILTERS = ['전체', '예정', '진행중', '완료', '결제완료']

type PendingProposal = {
  id: string
  budget: number | null
  settled_at: string | null
  advertiser_id: string
  campaign: { title: string; manager_phone: string | null; company_phone: string | null } | null
  advertiser_profile: { name: string | null; manager_phone: string | null; company_phone: string | null } | null
  company_name?: string | null
}

export default function EarningsPage() {
  const [earnings, setEarnings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('전체')
  const [period, setPeriod] = useState('이번달')
  const [pendingConfirm, setPendingConfirm] = useState<PendingProposal[]>([])
  const [confirmModal, setConfirmModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 기존 earnings
    const { data: earningsData } = await supabase
      .from('earnings')
      .select('*, proposals(collaboration_type)')
      .eq('influencer_id', user.id)
      .order('created_at', { ascending: false })

    setEarnings(earningsData ?? [])

    // 수금 확인 대기: settled_at 있고 paid_confirmed_at/paid_disputed_at 없는 proposals
    const { data: pending } = await supabase
      .from('proposals')
      .select(`
        id, budget, settled_at, advertiser_id,
        campaign:campaigns(title, manager_phone, company_phone),
        advertiser_profile:profiles!proposals_advertiser_id_fkey(name, manager_phone, company_phone)
      `)
      .eq('influencer_id', user.id)
      .not('settled_at', 'is', null)
      .is('paid_confirmed_at', null)
      .is('paid_disputed_at', null)

    const rows = (pending as unknown as PendingProposal[]) ?? []
    const advIds = [...new Set(rows.map((r) => r.advertiser_id))]
    if (advIds.length > 0) {
      const { data: advProfiles } = await supabase
        .from('advertiser_profiles')
        .select('user_id, company_name')
        .in('user_id', advIds)
      const companyByAdv = Object.fromEntries((advProfiles ?? []).map((a) => [a.user_id, a.company_name]))
      rows.forEach((r) => { r.company_name = companyByAdv[r.advertiser_id] ?? null })
    }

    setPendingConfirm(rows)
    setLoading(false)
  }

  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()

  const filteredByPeriod = earnings.filter(e => {
    const date = new Date(e.created_at)
    if (period === '이번달') return date.getMonth() === thisMonth && date.getFullYear() === thisYear
    if (period === '올해') return date.getFullYear() === thisYear
    return true
  })

  const filteredEarnings = filteredByPeriod.filter(e =>
    filter === '전체' || e.status === filter
  )

  const totalAmount = filteredByPeriod.reduce((sum, e) => sum + e.amount, 0)
  const pendingAmount = filteredByPeriod.filter(e => e.status === '예정').reduce((sum, e) => sum + e.amount, 0)
  const completedAmount = filteredByPeriod.filter(e => e.status === '결제완료').reduce((sum, e) => sum + e.amount, 0)

  const pendingConfirmTotal = pendingConfirm.reduce((s, p) => s + (p.budget ?? 0), 0)

  const categoryTotals = filteredByPeriod.reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount
    return acc
  }, {})

  const handleDownloadCSV = () => {
    const headers = ['날짜', '카테고리', '금액', '상태', '세금계산서']
    const rows = filteredEarnings.map(e => [
      new Date(e.created_at).toLocaleDateString('ko-KR'),
      e.category,
      e.amount,
      e.status,
      e.tax_invoice_issued ? '발행' : '미발행'
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `매출내역_${period}.csv`
    a.click()
  }

  const statusColor = (status: string) => {
    if (status === '예정') return 'bg-orange-100 text-orange-600'
    if (status === '진행중') return 'bg-[#FEF3C7] text-[#B45309]'
    if (status === '완료') return 'bg-gray-100 text-gray-600'
    if (status === '결제완료') return 'bg-green-100 text-green-600'
    return 'bg-gray-100 text-gray-500'
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {confirmModal && pendingConfirm.length > 0 && (
        <PaidConfirmModal
          proposals={pendingConfirm}
          onClose={() => setConfirmModal(false)}
          onDone={(confirmedIds, disputedIds) => {
            setPendingConfirm((prev) =>
              prev.filter((p) => !confirmedIds.includes(p.id) && !disputedIds.includes(p.id))
            )
            setConfirmModal(false)
          }}
        />
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href="/influencer/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">
            ← 뒤로
          </Link>
          <h1 className="text-xl font-bold text-gray-900">매출 관리</h1>
        </div>
        <button
          onClick={handleDownloadCSV}
          className="text-sm text-[#B45309] border border-[#FCD34D] px-3 py-1.5 rounded-lg hover:bg-[#FEF3C7] transition"
        >
          📥 CSV 다운로드
        </button>
      </div>

      {/* 수금 확인 대기 배너 */}
      {pendingConfirm.length > 0 && (
        <button
          onClick={() => setConfirmModal(true)}
          className="w-full mb-5 flex items-center justify-between bg-[#FEF3C7] border border-[#FCD34D] rounded-2xl px-4 py-3 hover:bg-[#FDE68A] transition"
        >
          <div className="text-left">
            <p className="text-xs font-semibold text-[#B45309]">수금 확인 대기</p>
            <p className="text-sm font-bold text-[#17171B]">
              {pendingConfirmTotal.toLocaleString()}원 · {pendingConfirm.length}건
            </p>
          </div>
          <span className="text-[#B45309] font-bold text-sm">확인 →</span>
        </button>
      )}

      {/* 기간 선택 */}
      <div className="flex gap-2 mb-6">
        {['이번달', '올해', '전체'].map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              period === p
                ? 'bg-[#F59E0B] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm col-span-2">
          <p className="text-sm text-gray-500 mb-1">총 매출</p>
          <p className="text-3xl font-bold text-[#B45309]">{totalAmount.toLocaleString()}원</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">예정 수입</p>
          <p className="text-xl font-bold text-orange-500">{pendingAmount.toLocaleString()}원</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">결제 완료</p>
          <p className="text-xl font-bold text-green-500">{completedAmount.toLocaleString()}원</p>
        </div>
      </div>

      {/* 카테고리별 수입 */}
      {Object.keys(categoryTotals).length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">카테고리별 수입</h2>
          {Object.entries(categoryTotals).map(([cat, amount]) => (
            <div key={cat} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-600">{cat}</span>
              <span className="text-sm font-semibold text-gray-800">{(amount as number).toLocaleString()}원</span>
            </div>
          ))}
        </div>
      )}

      {/* 상태 필터 */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
              filter === s
                ? 'bg-[#F59E0B] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* 매출 목록 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading && <p className="text-center text-gray-400 py-8">불러오는 중...</p>}

        {!loading && filteredEarnings.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">매출 내역이 없어요</p>
          </div>
        )}

        {filteredEarnings.map((e, index) => (
          <div
            key={e.id}
            className={`flex items-center justify-between p-4 ${
              index !== filteredEarnings.length - 1 ? 'border-b border-gray-50' : ''
            }`}
          >
            <div>
              <p className="text-sm font-medium text-gray-800">{e.category}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(e.created_at).toLocaleDateString('ko-KR')}
                {e.due_date && ` · 지급예정 ${new Date(e.due_date).toLocaleDateString('ko-KR')}`}
              </p>
              {e.tax_invoice_issued && (
                <span className="text-xs text-[#B45309]">세금계산서 발행</span>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-800">{e.amount.toLocaleString()}원</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(e.status)}`}>
                {e.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
