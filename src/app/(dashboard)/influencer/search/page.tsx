'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { INFLUENCER_CATEGORIES } from '@/lib/categories'
import { dateWithDow } from '@/lib/date'
import { Building2, CalendarDays, Search, MapPin, Clock } from 'lucide-react'

export default function InfluencerSearchPage() {
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
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]))
  }

  const handleSearch = async () => {
    setLoading(true)
    setSearched(true)

    let query = supabase
      .from('campaigns')
      .select(
        'id, title, date, location_city, location_district, start_time, end_time, predefined_categories, free_tags, details, advertiser_id'
      )
      .eq('is_public', true)
      .eq('status', 'open')
    if (date) query = query.eq('date', date)
    if (locationCity) query = query.ilike('location_city', `%${locationCity}%`)
    if (locationDistrict) query = query.ilike('location_district', `%${locationDistrict}%`)
    if (selectedCategories.length > 0) query = query.overlaps('predefined_categories', selectedCategories)
    if (keyword) query = query.or(`title.ilike.%${keyword}%,free_tags.cs.{${keyword}}`)

    const { data } = await query.order('date', { ascending: true })

    // 광고주 정보(공개 이름/회사명)만 조회
    const enriched = await Promise.all(
      (data ?? []).map(async (campaign) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('id', campaign.advertiser_id)
          .single()
        const { data: ap } = await supabase
          .from('advertiser_profiles')
          .select('company_name')
          .eq('user_id', campaign.advertiser_id)
          .single()
        const { data: score } = await supabase
          .from('advertiser_payment_score')
          .select('on_time_rate, deals_count')
          .eq('advertiser_id', campaign.advertiser_id)
          .maybeSingle()
        return {
          ...campaign,
          advertiserName: ap?.company_name ?? profile?.name ?? '광고주',
          onTimeRate: score?.on_time_rate ?? null,
        }
      })
    )

    setResults(enriched)
    setLoading(false)
  }

  const inputCls =
    'w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500'

  return (
    <div className="max-w-lg mx-auto px-4 py-8 [.inf-pc_&]:max-w-none [.inf-pc_&]:px-0 [.inf-pc_&]:py-0">
      {/* 헤더 */}
      <div className="flex items-center mb-8">
        <Link href="/influencer/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">
          ← 뒤로
        </Link>
        <h1 className="text-xl font-bold text-gray-900">캠페인 검색</h1>
      </div>

      {/* 검색 필터 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <h2 className="font-semibold text-gray-800 mb-4">검색 조건</h2>

        <div className="mb-3">
          <label className="block text-sm text-gray-500 mb-1">날짜</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm text-gray-500 mb-1">시/구</label>
            <input type="text" value={locationCity} onChange={(e) => setLocationCity(e.target.value)}
              className={inputCls} placeholder="예: 서울 강남구" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">동</label>
            <input type="text" value={locationDistrict} onChange={(e) => setLocationDistrict(e.target.value)}
              className={inputCls} placeholder="예: 역삼동" />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-gray-500 mb-1">키워드</label>
          <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
            className={inputCls} placeholder="예: 팝업스토어, 신제품" />
        </div>

        <div className="mb-4">
          <label className="block text-sm text-gray-500 mb-2">카테고리</label>
          <div className="flex flex-wrap gap-1.5">
            {INFLUENCER_CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => toggleCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  selectedCategories.includes(cat) ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>{cat}</button>
            ))}
          </div>
        </div>

        <button onClick={handleSearch} disabled={loading}
          className="w-full bg-amber-500 text-white py-2.5 rounded-lg font-medium hover:bg-amber-600 transition disabled:opacity-50">
          {loading ? '검색 중...' : <span className="inline-flex items-center gap-1"><Search size={16} strokeWidth={1.75} /> 캠페인 검색</span>}
        </button>
      </div>

      {/* 결과 */}
      {searched && (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            {results.length > 0 ? `${results.length}건의 캠페인을 찾았어요` : '조건에 맞는 캠페인이 없어요'}
          </p>

          {results.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl p-5 shadow-sm mb-3 border-l-4 border-amber-400">
              <p className="font-semibold text-gray-900">{c.title}</p>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                <Building2 size={16} strokeWidth={1.75} /> {c.advertiserName}
                {c.onTimeRate != null && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium">
                    <span className={`w-1.5 h-1.5 rounded-full ${c.onTimeRate >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className={c.onTimeRate >= 90 ? 'text-emerald-600' : 'text-amber-600'}>정산 {c.onTimeRate}%</span>
                  </span>
                )}
              </p>

              <div className="bg-gray-50 rounded-xl p-3 my-3 text-xs text-gray-500 space-y-0.5">
                <p className="flex items-center gap-1"><CalendarDays size={16} strokeWidth={1.75} /> {dateWithDow(c.date)}</p>
                <p className="flex items-center gap-1"><MapPin size={16} strokeWidth={1.75} /> {c.location_city} {c.location_district}</p>
                {c.start_time && (
                  <p className="flex items-center gap-1"><Clock size={16} strokeWidth={1.75} /> {c.start_time.slice(0, 5)}{c.end_time ? ` ~ ${c.end_time.slice(0, 5)}` : ''}</p>
                )}
              </div>

              {(c.predefined_categories?.length > 0 || c.free_tags?.length > 0) && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {c.predefined_categories?.map((cat: string) => (
                    <span key={cat} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{cat}</span>
                  ))}
                  {c.free_tags?.map((tag: string) => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">#{tag}</span>
                  ))}
                </div>
              )}

              {c.details && <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">{c.details}</p>}

              <button
                onClick={() => router.push(`/influencer/messages?receiverId=${c.advertiser_id}`)}
                className="w-full bg-amber-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-600 transition"
              >
                대시하기
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
