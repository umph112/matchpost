'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['맛집', '패션', '뷰티', '여행', '라이프스타일', '육아', '반려동물', '피트니스', '테크', '기타']
const PLATFORMS = ['인스타그램', '유튜브', '블로그', '틱톡']

export default function NewCampaignPage() {
  const [title, setTitle] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [locationDistrict, setLocationDistrict] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [freeTags, setFreeTags] = useState('')
  const [platform, setPlatform] = useState('')
  const [details, setDetails] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  const handleSubmit = async () => {
    if (!selectedDate || !locationCity || !locationDistrict || !title) {
      setError('제목, 날짜, 장소는 필수 입력이에요.')
      return
    }
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const freeTagsArray = freeTags.split(',').map(t => t.trim()).filter(t => t.length > 0)

    const { error: insertError } = await supabase.from('campaigns').insert({
      advertiser_id: user.id,
      title,
      date: selectedDate,
      start_time: startTime || null,
      end_time: endTime || null,
      location_city: locationCity,
      location_district: locationDistrict,
      predefined_categories: selectedCategories,
      free_tags: freeTagsArray,
      details: details || null,
      is_public: isPublic,
      status: 'open',
    })

    if (insertError) {
      setError('캠페인 등록에 실패했어요. 다시 시도해주세요.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/advertiser/dashboard'), 1500)
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-xl font-bold text-gray-800">캠페인이 등록됐어요!</h2>
        <p className="text-gray-500 text-sm mt-2">인플루언서들에게 노출되기 시작했어요.</p>
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
        <h1 className="text-xl font-bold text-gray-900">캠페인 등록</h1>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>
      )}

      {/* 제목 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">캠페인 제목 *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          placeholder="예: 강남 신상 카페 오픈 방문 리뷰 모집"
        />
      </div>

      {/* 날짜 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">날짜 *</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* 시간 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">시간 (선택)</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400 mb-1">시작 시간</p>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">종료 시간</p>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
        </div>
      </div>

      {/* 장소 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">장소 *</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400 mb-1">시/구</p>
            <input type="text" value={locationCity} onChange={(e) => setLocationCity(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="예: 서울 강남구" />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">동</p>
            <input type="text" value={locationDistrict} onChange={(e) => setLocationDistrict(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="예: 역삼동" />
          </div>
        </div>
      </div>

      {/* 플랫폼 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">원하는 플랫폼</label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(p => (
            <button key={p} onClick={() => setPlatform(p)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                platform === p ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>{p}</button>
          ))}
        </div>
      </div>

      {/* 카테고리 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">카테고리 (복수 선택 가능)</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => toggleCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                selectedCategories.includes(cat) ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>{cat}</button>
          ))}
        </div>
      </div>

      {/* 자유 태그 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">자유 태그 (쉼표로 구분)</label>
        <input type="text" value={freeTags} onChange={(e) => setFreeTags(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          placeholder="예: 팝업스토어, 신제품, 뷰티" />
      </div>

      {/* 상세 내용 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">상세 내용</label>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={5}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          placeholder="원하는 협업 내용, 조건, 예산 범위, 제작물 등을 자유롭게 적어주세요." />
      </div>

      {/* 공개 설정 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">인플루언서에게 공개</p>
            <p className="text-xs text-gray-400 mt-0.5">끄면 검색에 노출되지 않아요</p>
          </div>
          <button onClick={() => setIsPublic(!isPublic)}
            className={`w-12 h-6 rounded-full transition ${isPublic ? 'bg-amber-500' : 'bg-gray-300'}`}>
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${isPublic ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      <button onClick={handleSubmit} disabled={loading}
        className="w-full bg-amber-500 text-white py-3 rounded-xl font-medium hover:bg-amber-600 transition disabled:opacity-50">
        {loading ? '등록 중...' : '캠페인 등록하기'}
      </button>
    </div>
  )
}
