'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const STATUS_FILTERS = ['전체', '예정', '진행중', '완료', '결제완료']

export default function EarningsPage() {
  const [earnings, setEarnings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('전체')
  const [period, setPeriod] = useState('이번달')
  const supabase = createClient()

  useEffect(() => {
    fetchEarnings()
  }, [])

  const fetchEarnings = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('earnings')
      .select('*, proposals(collaboration_type)')
      .eq('influencer_id', user.id)
      .order('created_at', { ascending: false })

    setEarnings(data ?? [])
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
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `수입내역_${period}.csv`
    a.click()
  }

  const statusColor = (status: string) => {
    if (status === '예정') return 'bg-orange-100 text-orange-600'
    if (status === '진행중') return 'bg-blue-100 text-blue-600'
    if (status === '완료') return 'bg-gray-100 text-gray-600'
    if (status === '결제완료') return 'bg-green-100 text-green-600'
    return 'bg-gray-100 text-gray-500'
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Link href="/influencer/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">
            ← 뒤로
          </Link>
          <h1 className="text-xl font-bold text-gray-900">수입 관리</h1>
        </div>
        <button
          onClick={handleDownloadCSV}
          className="text-sm text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition"
        >
          📥 CSV 다운로드
        </button>
      </div>

      {/* 기간 선택 */}
      <div className="flex gap-2 mb-6">
        {['이번달', '올해', '전체'].map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              period === p
                ? 'bg-blue-600 text-white'
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
          <p className="text-sm text-gray-500 mb-1">총 수입</p>
          <p className="text-3xl font-bold text-blue-600">{totalAmount.toLocaleString()}원</p>
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
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* 수입 목록 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading && <p className="text-center text-gray-400 py-8">불러오는 중...</p>}

        {!loading && filteredEarnings.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">수입 내역이 없어요</p>
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
                <span className="text-xs text-blue-500">세금계산서 발행</span>
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