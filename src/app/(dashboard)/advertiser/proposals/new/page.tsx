'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const COLLABORATION_TYPES = ['협찬', '광고', '체험단', '기타']

function NewProposalForm() {
  const [schedule, setSchedule] = useState<any>(null)
  const [influencer, setInfluencer] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [budget, setBudget] = useState('')
  const [collaborationType, setCollaborationType] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const scheduleId = searchParams.get('scheduleId')
  const influencerId = searchParams.get('influencerId')
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      if (!scheduleId || !influencerId) return

      const { data: s } = await supabase
        .from('schedules')
        .select('*')
        .eq('id', scheduleId)
        .single()

      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', influencerId)
        .single()

      const { data: ip } = await supabase
        .from('influencer_profiles')
        .select('*')
        .eq('user_id', influencerId)
        .single()

      setSchedule(s)
      setInfluencer({ ...p, ...ip })
    }
    fetchData()
  }, [scheduleId, influencerId])

  const handleSubmit = async () => {
    if (!message || !collaborationType) {
      setError('제안 내용과 협업 유형은 필수예요.')
      return
    }

    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: insertError } = await supabase.from('proposals').insert({
      schedule_id: scheduleId,
      advertiser_id: user.id,
      influencer_id: influencerId,
      message,
      budget: budget ? parseInt(budget) : null,
      collaboration_type: collaborationType,
      status: 'pending',
    })

    if (insertError) {
      setError('제안 전송에 실패했어요. 다시 시도해주세요.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/advertiser/proposals'), 1500)
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">💌</div>
        <h2 className="text-xl font-bold text-gray-800">제안을 보냈어요!</h2>
        <p className="text-gray-500 text-sm mt-2">인플루언서의 답변을 기다려주세요.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center mb-8">
        <button onClick={() => router.back()} className="mr-4 text-gray-400 hover:text-gray-600">
          ← 뒤로
        </button>
        <h1 className="text-xl font-bold text-gray-900">협업 제안하기</h1>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>
      )}

      {/* 인플루언서 & 일정 정보 */}
      {schedule && influencer && (
        <div className="bg-blue-50 rounded-2xl p-5 mb-4">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-bold mr-3">
              {influencer.name?.[0] ?? '?'}
            </div>
            <div>
              <p className="font-semibold text-gray-800">{influencer.name}</p>
              <p className="text-xs text-gray-500">팔로워 {influencer.follower_count?.toLocaleString()}명</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-3 text-sm">
            <p className="font-medium text-gray-800">{schedule.title}</p>
            <p className="text-xs text-gray-500 mt-1">
              📅 {new Date(schedule.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
              　📍 {schedule.location_city} {schedule.location_district}
            </p>
          </div>
        </div>
      )}

      {/* 협업 유형 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">협업 유형 *</label>
        <div className="grid grid-cols-2 gap-2">
          {COLLABORATION_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setCollaborationType(type)}
              className={`py-2.5 rounded-lg text-sm font-medium transition border-2 ${
                collaborationType === type
                  ? 'border-blue-600 bg-blue-50 text-blue-600'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* 예산 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">제안 예산 (선택)</label>
        <div className="relative">
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
            placeholder="예: 500000"
          />
          <span className="absolute right-3 top-2.5 text-sm text-gray-400">원</span>
        </div>
      </div>

      {/* 제안 메시지 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">제안 메시지 *</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="협업 내용, 브랜드 소개, 원하는 콘텐츠 방향 등을 자유롭게 작성해주세요."
        />
      </div>

      {/* 제안 버튼 */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? '전송 중...' : '💌 제안 보내기'}
      </button>
    </div>
  )
}

export default function NewProposalPage() {
  return (
    <Suspense>
      <NewProposalForm />
    </Suspense>
  )
}