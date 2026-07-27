'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const CHANNELS = ['블로그', '유튜브', '인스타그램', '틱톡']
const TYPES = [
  { key: '제품', label: '제품', desc: '제품을 받아 체험 후 포스팅' },
  { key: '지역', label: '지역', desc: '업장을 방문해 서비스 체험 후 포스팅' },
  { key: '기자단', label: '기자단', desc: '전달된 자료만으로 포스팅' },
]
const CATEGORIES = ['맛집', '패션', '뷰티', '여행', '라이프스타일', '육아', '반려동물', '피트니스', '테크', '기타']

type DateRow = { date: string; start_time: string; end_time: string }

export default function NewCampaignPage() {
  const [channels, setChannels] = useState<string[]>([])
  const [campaignType, setCampaignType] = useState('')

  // 옵션 (추가형 + 비용 직접 입력)
  const [reviewOpt, setReviewOpt] = useState(false)
  const [reviewCost, setReviewCost] = useState('')
  const [clipOpt, setClipOpt] = useState(false)
  const [clipCost, setClipCost] = useState('')

  const [title, setTitle] = useState('')

  // 날짜 (최대 30일) + 기본 시간
  const [dateInput, setDateInput] = useState('')
  const [dates, setDates] = useState<DateRow[]>([])
  const [defaultStart, setDefaultStart] = useState('')
  const [defaultEnd, setDefaultEnd] = useState('')

  // 장소 (구분='지역'일 때만)
  const [locationCity, setLocationCity] = useState('')
  const [locationDistrict, setLocationDistrict] = useState('')

  // 캠페인 예산 (만원 단위 입력, 세금 포함 총액. 저장은 원 단위)
  // TODO(수수료): 향후 캠페인별 플랫폼 이용 수수료 도입 시 → 이 총 예산에 수수료 포함 +
  //              딜시트에도 수수료 항목 별도 표기. (현재는 수수료 없음)
  const [budgetManwon, setBudgetManwon] = useState('')

  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [freeTags, setFreeTags] = useState('')
  const [details, setDetails] = useState('')
  const [isPublic, setIsPublic] = useState(true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const isRegion = campaignType === '지역'

  const toggleChannel = (c: string) =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  const toggleCategory = (cat: string) =>
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]))

  const addDate = () => {
    if (!dateInput) return
    if (dates.some((d) => d.date === dateInput)) return
    if (dates.length >= 30) {
      setError('날짜는 최대 30일까지 지정할 수 있어요.')
      return
    }
    const next = [...dates, { date: dateInput, start_time: defaultStart, end_time: defaultEnd }]
    next.sort((a, b) => a.date.localeCompare(b.date))
    setDates(next)
    setDateInput('')
    setError('')
  }
  const removeDate = (date: string) => setDates((prev) => prev.filter((d) => d.date !== date))
  const setRowTime = (date: string, field: 'start_time' | 'end_time', value: string) =>
    setDates((prev) => prev.map((d) => (d.date === date ? { ...d, [field]: value } : d)))
  // 기본 시간을 모든 날짜에 일괄 적용
  const applyDefaultToAll = () =>
    setDates((prev) => prev.map((d) => ({ ...d, start_time: defaultStart, end_time: defaultEnd })))

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })

  const handleSubmit = async () => {
    if (channels.length === 0) return setError('원하는 채널을 하나 이상 선택해주세요.')
    if (!campaignType) return setError('캠페인 구분(제품/지역/기자단)을 선택해주세요.')
    if (!title) return setError('캠페인 제목을 입력해주세요.')
    if (dates.length === 0) return setError('날짜를 하나 이상 지정해주세요.')
    if (isRegion && (!locationCity || !locationDistrict)) return setError('지역 캠페인은 장소가 필요해요.')
    if (!budgetManwon || parseInt(budgetManwon) <= 0) return setError('캠페인 예산을 입력해주세요.')

    setLoading(true)
    setError('')

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const options: { type: string; cost: number | null }[] = []
    if (reviewOpt) options.push({ type: '구매평', cost: reviewCost ? parseInt(reviewCost) : null })
    if (clipOpt) options.push({ type: '네이버클립', cost: clipCost ? parseInt(clipCost) : null })

    const sorted = [...dates].sort((a, b) => a.date.localeCompare(b.date))
    const freeTagsArray = freeTags.split(',').map((t) => t.trim()).filter((t) => t.length > 0)

    const { error: insertError } = await supabase.from('campaigns').insert({
      advertiser_id: user.id,
      title,
      channels,
      campaign_type: campaignType,
      options,
      dates: sorted,
      // 하위호환(달력 매칭): 첫 날짜/시간을 기존 컬럼에도 채움
      date: sorted[0].date,
      start_time: sorted[0].start_time || null,
      end_time: sorted[0].end_time || null,
      location_city: isRegion ? locationCity : null,
      location_district: isRegion ? locationDistrict : null,
      // 세금 포함 총 예산 (원 단위 저장). 만원 단위 입력값 × 10000
      budget_total: parseInt(budgetManwon) * 10000,
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

  const card = 'bg-white rounded-2xl p-5 shadow-sm mb-4'
  const chip = (on: boolean) =>
    `px-4 py-2 rounded-full text-sm font-medium transition ${
      on ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`
  const input =
    'w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500'

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center mb-8">
        <button onClick={() => router.back()} className="mr-4 text-gray-400 hover:text-gray-600">
          ← 뒤로
        </button>
        <h1 className="text-xl font-bold text-gray-900">캠페인 등록</h1>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

      {/* ① 채널 (복수) */}
      <div className={card}>
        <label className="block text-sm font-medium text-gray-700 mb-2">원하는 채널 * (복수 선택)</label>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button key={c} onClick={() => toggleChannel(c)} className={chip(channels.includes(c))}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* ② 구분 (단일) */}
      <div className={card}>
        <label className="block text-sm font-medium text-gray-700 mb-2">캠페인 구분 *</label>
        <div className="space-y-2">
          {TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setCampaignType(t.key)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                campaignType === t.key
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <span className="text-sm font-semibold text-gray-800">{t.label}</span>
              <span className="block text-xs text-gray-500 mt-0.5">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ③ 옵션 (추가형 + 비용 직접입력) */}
      <div className={card}>
        <label className="block text-sm font-medium text-gray-700 mb-1">추가 옵션</label>
        <p className="text-xs text-gray-400 mb-3">원하는 옵션을 추가하면 비용을 직접 입력해요.</p>

        {/* 구매평 */}
        <div className="mb-2">
          {!reviewOpt ? (
            <button
              onClick={() => setReviewOpt(true)}
              className="text-sm text-amber-600 border border-amber-200 rounded-lg px-3 py-2 hover:bg-amber-50"
            >
              ＋ 구매평 추가
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2">
              <span className="text-sm font-medium text-gray-700 w-20">구매평</span>
              <input
                type="number"
                value={reviewCost}
                onChange={(e) => setReviewCost(e.target.value)}
                className={input + ' flex-1'}
                placeholder="옵션 비용(원)"
              />
              <button onClick={() => { setReviewOpt(false); setReviewCost('') }} className="text-gray-400 hover:text-red-500 text-sm">
                ✕
              </button>
            </div>
          )}
        </div>

        {/* 네이버클립 */}
        <div>
          {!clipOpt ? (
            <button
              onClick={() => setClipOpt(true)}
              className="text-sm text-amber-600 border border-amber-200 rounded-lg px-3 py-2 hover:bg-amber-50"
            >
              ＋ 네이버클립 추가
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2">
              <span className="text-sm font-medium text-gray-700 w-20">네이버클립</span>
              <input
                type="number"
                value={clipCost}
                onChange={(e) => setClipCost(e.target.value)}
                className={input + ' flex-1'}
                placeholder="옵션 비용(원)"
              />
              <button onClick={() => { setClipOpt(false); setClipCost('') }} className="text-gray-400 hover:text-red-500 text-sm">
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ④ 제목 */}
      <div className={card}>
        <label className="block text-sm font-medium text-gray-700 mb-2">캠페인 제목 *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={input}
          placeholder="예: 강남 신상 카페 오픈 방문 리뷰 모집"
        />
      </div>

      {/* ⑤ 날짜 (최대 30일) + 기본 시간 */}
      <div className={card}>
        <label className="block text-sm font-medium text-gray-700 mb-2">날짜 * (최대 30일)</label>

        {/* 기본 시간 */}
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <p className="text-xs text-gray-400 mb-1">기본 시작시간</p>
            <input type="time" value={defaultStart} onChange={(e) => setDefaultStart(e.target.value)} className={input} />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">기본 종료시간</p>
            <input type="time" value={defaultEnd} onChange={(e) => setDefaultEnd(e.target.value)} className={input} />
          </div>
        </div>
        {dates.length > 0 && (
          <button onClick={applyDefaultToAll} className="text-xs text-amber-600 hover:underline mb-3">
            기본 시간을 모든 날짜에 적용
          </button>
        )}

        {/* 날짜 추가 */}
        <div className="flex gap-2 mt-1">
          <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} className={input + ' flex-1'} />
          <button onClick={addDate} className="shrink-0 bg-gray-800 text-white px-4 rounded-lg text-sm font-medium hover:bg-gray-900">
            추가
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">추가한 날짜는 기본 시간으로 들어가고, 아래에서 일정별로 바꿀 수 있어요.</p>

        {/* 선택된 날짜 목록 (일정별 시간 수정) */}
        {dates.length > 0 && (
          <div className="mt-3 space-y-2">
            {dates.map((d) => (
              <div key={d.date} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-xs font-medium text-gray-700 w-24 shrink-0">{fmtDate(d.date)}</span>
                <input type="time" value={d.start_time} onChange={(e) => setRowTime(d.date, 'start_time', e.target.value)}
                  className="border border-gray-200 rounded px-2 py-1 text-xs flex-1" />
                <span className="text-gray-400 text-xs">~</span>
                <input type="time" value={d.end_time} onChange={(e) => setRowTime(d.date, 'end_time', e.target.value)}
                  className="border border-gray-200 rounded px-2 py-1 text-xs flex-1" />
                <button onClick={() => removeDate(d.date)} className="text-gray-400 hover:text-red-500 text-sm shrink-0">✕</button>
              </div>
            ))}
            <p className="text-[11px] text-gray-400">총 {dates.length}일 선택됨</p>
          </div>
        )}
      </div>

      {/* ⑥ 장소 (지역일 때만) */}
      {isRegion && (
        <div className={card}>
          <label className="block text-sm font-medium text-gray-700 mb-2">장소 * (지역 캠페인)</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">시/구</p>
              <input type="text" value={locationCity} onChange={(e) => setLocationCity(e.target.value)} className={input} placeholder="예: 서울 강남구" />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">동</p>
              <input type="text" value={locationDistrict} onChange={(e) => setLocationDistrict(e.target.value)} className={input} placeholder="예: 역삼동" />
            </div>
          </div>
        </div>
      )}

      {/* 캠페인 예산 (만원 단위, 세금 포함 총액) */}
      <div className={card}>
        <label className="block text-sm font-medium text-gray-700 mb-2">캠페인 예산 *</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={budgetManwon}
            onChange={(e) => setBudgetManwon(e.target.value)}
            className={input + ' flex-1'}
            placeholder="예: 500"
            min={0}
          />
          <span className="text-sm text-gray-500 shrink-0">만원</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          이 캠페인에 지출할 <span className="font-medium">세금 포함 총 예산</span>이에요.
          {budgetManwon && parseInt(budgetManwon) > 0 && (
            <span className="text-gray-600"> = {(parseInt(budgetManwon) * 10000).toLocaleString()}원</span>
          )}
        </p>
      </div>

      {/* 카테고리 */}
      <div className={card}>
        <label className="block text-sm font-medium text-gray-700 mb-2">카테고리 (복수 선택 가능)</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => toggleCategory(cat)} className={chip(selectedCategories.includes(cat))}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 자유 태그 */}
      <div className={card}>
        <label className="block text-sm font-medium text-gray-700 mb-2">자유 태그 (쉼표로 구분)</label>
        <input type="text" value={freeTags} onChange={(e) => setFreeTags(e.target.value)} className={input} placeholder="예: 팝업스토어, 신제품, 뷰티" />
      </div>

      {/* 상세 내용 */}
      <div className={card}>
        <label className="block text-sm font-medium text-gray-700 mb-2">상세 내용</label>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={5}
          className={input + ' resize-none'}
          placeholder="원하는 협업 내용, 조건, 제작물 등을 자유롭게 적어주세요." />
      </div>

      {/* 공개 설정 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">인플루언서에게 공개</p>
            <p className="text-xs text-gray-400 mt-0.5">끄면 검색에 노출되지 않아요</p>
          </div>
          <button onClick={() => setIsPublic(!isPublic)} className={`w-12 h-6 rounded-full transition ${isPublic ? 'bg-amber-500' : 'bg-gray-300'}`}>
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
