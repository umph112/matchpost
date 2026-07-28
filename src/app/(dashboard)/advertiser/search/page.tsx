'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const CATEGORIES = ['맛집', '패션', '뷰티', '여행', '라이프스타일', '육아', '반려동물', '피트니스', '테크', '기타']

export default function AdvertiserSearchPage() {
  const [date, setDate] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [locationDistrict, setLocationDistrict] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  const handleSearch = async () => {
    setLoading(true)
    setSearched(true)

    let query = supabase
      .from('schedules')
      .select('*')
      .eq('is_public', true)
      .eq('status', 'open')

    if (date) query = query.eq('date', date)
    if (locationCity) query = query.ilike('location_city', `%${locationCity}%`)
    if (locationDistrict) query = query.ilike('location_district', `%${locationDistrict}%`)
    if (selectedCategories.length > 0) {
      query = query.overlaps('predefined_categories', selectedCategories)
    }
    if (keyword) {
      query = query.or(`title.ilike.%${keyword}%,free_tags.cs.{${keyword}}`)
    }

    const { data, error } = await query.order('date', { ascending: true })

    // 각 일정의 인플루언서 프로필 가져오기
const enriched = await Promise.all((data ?? []).map(async (schedule) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, avatar_url')
    .eq('id', schedule.influencer_id)
    .single()

  const { data: ip } = await supabase
    .from('influencer_profiles')
    .select('bio, platforms, categories, follower_count, instagram_url, youtube_url, blog_url')
    .eq('user_id', schedule.influencer_id)
    .single()

  return { ...schedule, profiles: profile, influencer_profiles: ip }
}))

setResults(enriched)
setLoading(false)

      }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 [.adv-pc_&]:max-w-none [.adv-pc_&]:px-0">
      {/* 헤더 */}
      <div className="flex items-center mb-8">
        <Link href="/advertiser/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">
          ← 뒤로
        </Link>
        <h1 className="text-xl font-bold text-gray-900">인플루언서 찾기</h1>
      </div>

      {/* 검색 필터 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <h2 className="font-semibold text-gray-800 mb-4">검색 조건</h2>

        {/* 날짜 */}
        <div className="mb-3">
          <label className="block text-sm text-gray-500 mb-1">날짜</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 장소 */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm text-gray-500 mb-1">시/구</label>
            <input
              type="text"
              value={locationCity}
              onChange={(e) => setLocationCity(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 서울 강남구"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">동</label>
            <input
              type="text"
              value={locationDistrict}
              onChange={(e) => setLocationDistrict(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 역삼동"
            />
          </div>
        </div>

        {/* 키워드 */}
        <div className="mb-4">
          <label className="block text-sm text-gray-500 mb-1">키워드</label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: 팝업스토어, 신제품"
          />
        </div>

        {/* 카테고리 */}
        <div className="mb-4">
          <label className="block text-sm text-gray-500 mb-2">카테고리</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  selectedCategories.includes(cat)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? '검색 중...' : '🔍 검색하기'}
        </button>
      </div>

      {/* 검색 결과 */}
      {searched && (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            {results.length > 0 ? `${results.length}명의 인플루언서를 찾았어요` : '조건에 맞는 인플루언서가 없어요'}
          </p>

          {results.map((schedule) => (
            <div key={schedule.id} className="bg-white rounded-2xl p-5 shadow-sm mb-3">
              {/* 인플루언서 정보 */}
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold mr-3">
                  {schedule.profiles?.name?.[0] ?? '?'}
                </div>
                <div>
                  <a href={"/profile/" + schedule.influencer_id} className="font-semibold text-gray-800 hover:text-blue-600 hover:underline">
  {schedule.profiles?.name}
</a>
                  <p className="text-xs text-gray-400">
                    팔로워 {schedule.influencer_profiles?.follower_count?.toLocaleString()}명
                  </p>
                </div>
              </div>

              {/* 일정 정보 */}
              <div className="bg-gray-50 rounded-xl p-3 mb-3">
                <p className="font-medium text-gray-800 text-sm">{schedule.title}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>📅 {new Date(schedule.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</span>
                  <span>📍 {schedule.location_city} {schedule.location_district}</span>
                </div>
                {schedule.start_time && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    🕐 {schedule.start_time.slice(0, 5)}
                    {schedule.end_time && ` ~ ${schedule.end_time.slice(0, 5)}`}
                  </p>
                )}
              </div>

              {/* 카테고리 태그 */}
              {schedule.predefined_categories?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {schedule.predefined_categories.map((cat: string) => (
                    <span key={cat} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                      {cat}
                    </span>
                  ))}
                  {schedule.free_tags?.map((tag: string) => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 제안 버튼 */}
              <button
                onClick={() => router.push(`/advertiser/proposals/new?scheduleId=${schedule.id}&influencerId=${schedule.influencer_id}`)}
                className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
              >
                💌 협업 제안하기
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}