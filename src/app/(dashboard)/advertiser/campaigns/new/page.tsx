'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { INFLUENCER_CATEGORIES } from '@/lib/categories'
import TimeSelect from '@/components/TimeSelect'

const CHANNELS = ['블로그', '유튜브', '인스타그램', '틱톡']
// 채널별 콘텐츠 단위 (수량 입력 라벨)
const CHANNEL_UNIT: Record<string, string> = { 블로그: '포스트', 유튜브: '영상', 인스타그램: '피드', 틱톡: '피드' }
// 결제방식 (복수 선택 가능 — 복수 선택 시 인플루언서가 대시에서 최종 결정)
const PAYMENT_METHODS = ['세금계산서 발행', '3.3% 소득세 신고']
const TYPES = [
  { key: '제품', label: '제품', desc: '제품을 받아 체험 후 포스팅' },
  { key: '지역', label: '지역', desc: '업장을 방문해 서비스 체험 후 포스팅' },
  { key: '기자단', label: '기자단', desc: '전달된 자료만으로 포스팅' },
]
type DateRow = { date: string; start_time: string; end_time: string }

export default function NewCampaignPage() {
  const [channels, setChannels] = useState<string[]>([])
  // 채널별 의뢰 콘텐츠 수량 (선택한 채널에 대해서만, 1~99). 예: { 블로그: 1, 인스타그램: 2 }
  const [contentCounts, setContentCounts] = useState<Record<string, number>>({})
  const [campaignType, setCampaignType] = useState('')

  // 옵션 (추가형 + 비용 직접 입력)
  const [reviewOpt, setReviewOpt] = useState(false)
  const [reviewCost, setReviewCost] = useState('')
  const [clipOpt, setClipOpt] = useState(false)
  const [clipCost, setClipCost] = useState('')

  const [title, setTitle] = useState('')

  // 날짜 (최대 30일) + 기본 시간
  const [dateInput, setDateInput] = useState('')   // 진행일정 시작일(또는 단일일)
  const [dateEnd, setDateEnd] = useState('')        // 진행일정 종료일(기간 선택 시, 선택사항)
  const [dates, setDates] = useState<string[]>([]) // 선택된 진행일정 날짜들 (YYYY-MM-DD)
  // 평일 캠페인 시간
  const [weekdayStart, setWeekdayStart] = useState('')
  const [weekdayEnd, setWeekdayEnd] = useState('')
  // 주말/휴일 시간 (포함 시 별도 입력 여부 안내 후)
  const [weekendDecided, setWeekendDecided] = useState(false) // 안내에 응답했는지
  const [useWeekendTime, setUseWeekendTime] = useState(false) // 별도 입력 선택
  const [weekendStart, setWeekendStart] = useState('')
  const [weekendEnd, setWeekendEnd] = useState('')

  // 장소 (구분='지역'일 때만) — 네이버 지역검색으로 장소명·주소 자동입력
  const [locationCity, setLocationCity] = useState('')       // 표시/달력용 지역(자동 파생)
  const [locationDistrict, setLocationDistrict] = useState('')
  const [locationName, setLocationName] = useState('')       // 장소명
  const [locationAddress, setLocationAddress] = useState('') // 상세 주소
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState<{ name: string; address: string }[]>([])

  // 캠페인 예산 (만원 단위 입력, 세금 포함 총액. 저장은 원 단위)
  // TODO(수수료): 향후 캠페인별 플랫폼 이용 수수료 도입 시 → 이 총 예산에 수수료 포함 +
  //              딜시트에도 수수료 항목 별도 표기. (현재는 수수료 없음)
  const [budgetManwon, setBudgetManwon] = useState('')

  // 참여 인플루언서 모집일정 (캠페인 진행 날짜와 별개)
  const [recruitStart, setRecruitStart] = useState('')   // 신청기간 시작
  const [recruitEnd, setRecruitEnd] = useState('')       // 신청기간 종료
  const [announceDate, setAnnounceDate] = useState('')   // 인플루언서 발표
  const [contentStart, setContentStart] = useState('')   // 콘텐츠 등록기간 시작
  const [contentEnd, setContentEnd] = useState('')       // 콘텐츠 등록기간 종료
  const [recruitTarget, setRecruitTarget] = useState('') // 모집 인원(목표)

  // 결제 예정일(달력 지정 또는 규칙 직접입력) + 결제방식(복수 선택)
  const [paymentDueDate, setPaymentDueDate] = useState('')
  const [paymentDueRule, setPaymentDueRule] = useState('')
  const [paymentMethods, setPaymentMethods] = useState<string[]>([])

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
  const setCount = (ch: string, v: string) => {
    let n = parseInt(v || '0')
    if (isNaN(n)) n = 1
    n = Math.max(1, Math.min(99, n))
    setContentCounts((prev) => ({ ...prev, [ch]: n }))
  }
  const toggleCategory = (cat: string) =>
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]))
  const togglePayMethod = (m: string) =>
    setPaymentMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  // 필수 키워드 파싱: 공백/쉼표 구분, 앞의 # 제거, 중복 제거 (저장은 # 없이)
  const parseKeywords = (s: string) =>
    [...new Set(s.split(/[,\s]+/).map((t) => t.trim().replace(/^#+/, '')).filter((t) => t.length > 0))]

  // 시작~종료(포함) 사이의 모든 날짜(YYYY-MM-DD) 나열. 종료 없으면 시작 하루만.
  const enumerateDays = (start: string, end: string) => {
    const out: string[] = []
    const s = new Date(start + 'T00:00:00')
    const e = new Date(end + 'T00:00:00')
    for (const d = s; d <= e; d.setDate(d.getDate() + 1)) {
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    }
    return out
  }
  // 장소 검색 (300ms 디바운스)
  useEffect(() => {
    if (placeQuery.trim().length < 2) {
      setPlaceResults([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search-place?q=${encodeURIComponent(placeQuery)}`)
        setPlaceResults(r.ok ? await r.json() : [])
      } catch {
        setPlaceResults([])
      }
    }, 300)
    return () => clearTimeout(t)
  }, [placeQuery])

  const selectPlace = (name: string, address: string) => {
    setLocationName(name)
    setLocationAddress(address)
    const toks = address.split(' ')
    setLocationCity(toks.slice(0, 2).join(' ')) // 표시/달력용 지역(예: "서울특별시 강남구")
    setLocationDistrict('')
    setPlaceQuery('')
    setPlaceResults([])
  }

  const isWeekend = (s: string) => {
    const g = new Date(s + 'T00:00:00').getDay()
    return g === 0 || g === 6 // 일(0)·토(6)
  }
  // 하루 또는 기간(시작~종료) 추가. 최대 30일.
  const addDates = () => {
    if (!dateInput) return
    const start = dateInput
    const end = dateEnd && dateEnd >= start ? dateEnd : start
    const existing = new Set(dates)
    const toAdd = enumerateDays(start, end).filter((x) => !existing.has(x))
    if (toAdd.length === 0) {
      setDateInput('')
      setDateEnd('')
      return
    }
    if (dates.length + toAdd.length > 30) {
      setError('캠페인 진행일정은 최대 30일까지 지정할 수 있어요.')
      return
    }
    setDates([...dates, ...toAdd].sort((a, b) => a.localeCompare(b)))
    setDateInput('')
    setDateEnd('')
    setError('')
  }
  const removeDate = (date: string) => setDates((prev) => prev.filter((d) => d !== date))
  // 날짜별 적용 시간 (주말/휴일 별도 입력 시 그 시간, 아니면 평일 시간)
  const timeFor = (d: string) => {
    const wknd = isWeekend(d) && useWeekendTime
    return { start: (wknd ? weekendStart : weekdayStart) || '', end: (wknd ? weekendEnd : weekdayEnd) || '' }
  }

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })

  const hasWeekend = dates.some(isWeekend) // 선택 일정에 주말 포함 여부

  const handleSubmit = async () => {
    if (channels.length === 0) return setError('원하는 채널을 하나 이상 선택해주세요.')
    if (!campaignType) return setError('캠페인 구분(제품/지역/기자단)을 선택해주세요.')
    if (!title) return setError('캠페인 제목을 입력해주세요.')
    if (isRegion && dates.length === 0) return setError('캠페인 진행일정을 하나 이상 지정해주세요.')
    if (isRegion && !locationAddress) return setError('지역 캠페인은 장소(주소)가 필요해요.')
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

    // 진행일정은 지역 캠페인만 해당 (비지역이면 비움). 날짜별 시간 = 평일/주말 기준 자동
    const sorted: DateRow[] = isRegion
      ? [...dates].sort((a, b) => a.localeCompare(b)).map((d) => {
          const t = timeFor(d)
          return { date: d, start_time: t.start, end_time: t.end }
        })
      : []
    const keywordArray = parseKeywords(freeTags)
    if (keywordArray.length > 20) {
      setError('필수 키워드는 최대 20개까지 넣을 수 있어요.')
      return
    }

    const { error: insertError } = await supabase.from('campaigns').insert({
      advertiser_id: user.id,
      title,
      channels,
      // 선택한 채널에 대해서만 수량 저장 (미입력 시 기본 1)
      content_counts: Object.fromEntries(channels.map((c) => [c, contentCounts[c] ?? 1])),
      campaign_type: campaignType,
      options,
      dates: sorted,
      // 하위호환(달력 매칭): 첫 날짜/시간을 기존 컬럼에도 채움 (비지역이면 null)
      date: sorted[0]?.date ?? null,
      start_time: sorted[0]?.start_time || null,
      end_time: sorted[0]?.end_time || null,
      location_city: isRegion ? locationCity : null,
      location_district: isRegion ? locationDistrict : null,
      location_name: isRegion ? locationName || null : null,
      location_address: isRegion ? locationAddress || null : null,
      // 세금 포함 총 예산 (원 단위 저장). 만원 단위 입력값 × 10000
      budget_total: parseInt(budgetManwon) * 10000,
      // 참여 인플루언서 모집일정 (캠페인 진행 날짜와 별개)
      recruit_start: recruitStart || null,
      recruit_end: recruitEnd || null,
      announce_date: announceDate || null,
      content_start: contentStart || null,
      content_end: contentEnd || null,
      recruit_target: recruitTarget ? parseInt(recruitTarget) : null,
      // 결제 예정일(날짜 또는 규칙) + 결제방식(복수 → 대시에서 최종 결정)
      payment_due_date: paymentDueDate || null,
      payment_due_rule: paymentDueRule || null,
      payment_methods: paymentMethods,
      predefined_categories: selectedCategories,
      free_tags: keywordArray,
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

      {/* 카테고리 (인플루언서 분야) */}
      <div className={card}>
        <label className="block text-sm font-medium text-gray-700 mb-2">카테고리 (복수 선택 가능)</label>
        <div className="flex flex-wrap gap-2">
          {INFLUENCER_CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => toggleCategory(cat)} className={chip(selectedCategories.includes(cat))}>
              {cat}
            </button>
          ))}
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

      {/* 참여 인플루언서 모집일정 (캠페인 진행 날짜와 별개) */}
      <div className={card}>
        <label className="block text-sm font-medium text-gray-700 mb-1">참여 인플루언서 모집일정</label>
        <p className="text-xs text-gray-400 mb-3">캠페인 진행 날짜와 별개로, 인플루언서 모집·발표·콘텐츠 등록 일정이에요.</p>

        <p className="text-xs text-gray-500 mb-1">캠페인 신청기간</p>
        <div className="flex items-center gap-2 mb-3">
          <input type="date" value={recruitStart} onChange={(e) => setRecruitStart(e.target.value)} className={input + ' flex-1'} />
          <span className="text-gray-400 text-xs">~</span>
          <input type="date" value={recruitEnd} onChange={(e) => setRecruitEnd(e.target.value)} className={input + ' flex-1'} />
        </div>

        <p className="text-xs text-gray-500 mb-1">인플루언서 발표</p>
        <input type="date" value={announceDate} onChange={(e) => setAnnounceDate(e.target.value)} className={input + ' mb-3'} />

        <p className="text-xs text-gray-500 mb-1">콘텐츠 등록기간</p>
        <div className="flex items-center gap-2 mb-3">
          <input type="date" value={contentStart} onChange={(e) => setContentStart(e.target.value)} className={input + ' flex-1'} />
          <span className="text-gray-400 text-xs">~</span>
          <input type="date" value={contentEnd} onChange={(e) => setContentEnd(e.target.value)} className={input + ' flex-1'} />
        </div>

        <p className="text-xs text-gray-500 mb-1">모집 인원</p>
        <div className="flex items-center gap-2">
          <input type="number" min={1} value={recruitTarget} onChange={(e) => setRecruitTarget(e.target.value)} className={input + ' w-28'} placeholder="예: 5" />
          <span className="text-sm text-gray-500">명</span>
          {recruitTarget && parseInt(recruitTarget) > 0 && (
            <span className="text-xs text-gray-400 ml-1">참여 0/{parseInt(recruitTarget)}명</span>
          )}
        </div>
      </div>

      {/* ⑤ 캠페인 진행일정 (지역 캠페인만) */}
      {isRegion && (
        <div className={card}>
          <label className="block text-sm font-medium text-gray-700 mb-2">캠페인 진행일정 * (최대 30일)</label>

          {/* 평일 시간 */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">평일 시작시간</p>
              <TimeSelect value={weekdayStart} onChange={setWeekdayStart} />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">평일 종료시간</p>
              <TimeSelect value={weekdayEnd} onChange={setWeekdayEnd} />
            </div>
          </div>

          {/* 날짜 추가 (하루 또는 기간) */}
          <div className="flex items-center gap-2 mt-1">
            <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} className={input + ' flex-1'} />
            <span className="text-gray-400 text-xs">~</span>
            <input type="date" value={dateEnd} min={dateInput || undefined} onChange={(e) => setDateEnd(e.target.value)} className={input + ' flex-1'} />
            <button onClick={addDates} className="shrink-0 bg-gray-800 text-white px-4 rounded-lg text-sm font-medium hover:bg-gray-900">
              추가
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">하루만 지정하려면 시작일만 선택하세요. 기간은 시작~종료로 한 번에 추가돼요 (최대 30일).</p>

          {/* 주말/휴일 포함 안내 */}
          {hasWeekend && !weekendDecided && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800 leading-relaxed">
                선택한 일정에 주말 또는 휴일이 포함되어 있습니다. 캠페인 진행시간이 평일과 다를 경우 주말/휴일 시간대를 별도 입력할 수 있습니다. 입력하시겠습니까?
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { setWeekendDecided(true); setUseWeekendTime(true) }}
                  className="bg-amber-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-amber-600"
                >
                  입력하기
                </button>
                <button
                  onClick={() => { setWeekendDecided(true); setUseWeekendTime(false) }}
                  className="bg-gray-100 text-gray-600 text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-gray-200"
                >
                  평일과 동일
                </button>
              </div>
            </div>
          )}

          {/* 주말/휴일 시간 입력 */}
          {hasWeekend && useWeekendTime && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-1">주말/휴일 캠페인 시간</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">시작시간</p>
                  <TimeSelect value={weekendStart} onChange={setWeekendStart} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">종료시간</p>
                  <TimeSelect value={weekendEnd} onChange={setWeekendEnd} />
                </div>
              </div>
            </div>
          )}

          {/* 선택된 날짜 목록 (시간은 평일/주말 기준 자동 표시) */}
          {dates.length > 0 && (
            <div className="mt-3 space-y-2">
              {dates.map((d) => {
                const t = timeFor(d)
                const wknd = isWeekend(d)
                return (
                  <div key={d} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-xs font-medium text-gray-700 shrink-0">{fmtDate(d)}</span>
                    {wknd && <span className="text-[10px] bg-red-100 text-red-500 rounded px-1.5 py-0.5 shrink-0">주말</span>}
                    <span className="text-xs text-gray-500 flex-1">
                      {t.start || t.end ? `${t.start || '--:--'} ~ ${t.end || '--:--'}` : '시간 미지정'}
                    </span>
                    <button onClick={() => removeDate(d)} className="text-gray-400 hover:text-red-500 text-sm shrink-0">✕</button>
                  </div>
                )
              })}
              <p className="text-[11px] text-gray-400">총 {dates.length}일 선택됨</p>
            </div>
          )}
        </div>
      )}

      {/* ⑥ 장소 (지역일 때만) — 검색으로 장소명·주소 자동입력 */}
      {isRegion && (
        <div className={card}>
          <label className="block text-sm font-medium text-gray-700 mb-2">장소 * (방문 주소)</label>

          {/* 장소 검색 (자동완성) */}
          <div className="relative">
            <input
              type="text"
              value={placeQuery}
              onChange={(e) => setPlaceQuery(e.target.value)}
              className={input}
              placeholder="🔍 장소명 검색 (예: 스타벅스 강남점)"
            />
            {placeResults.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {placeResults.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectPlace(r.name, r.address)}
                    className="block w-full text-left px-3 py-2 hover:bg-amber-50 border-b border-gray-50 last:border-0"
                  >
                    <span className="text-sm font-medium text-gray-800">{r.name}</span>
                    <span className="block text-xs text-gray-400">{r.address}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 선택/직접입력 */}
          <p className="text-xs text-gray-500 mt-3 mb-1">장소명</p>
          <input type="text" value={locationName} onChange={(e) => setLocationName(e.target.value)} className={input} placeholder="예: 강남 신상 카페" />
          <p className="text-xs text-gray-500 mt-2 mb-1">상세 주소</p>
          <input type="text" value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} className={input} placeholder="검색으로 자동입력되거나 직접 입력" />
          <p className="text-[11px] text-gray-400 mt-1">지도 표시는 곧 추가돼요.</p>
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

      {/* 콘텐츠 수량 (선택한 채널별로 구분 입력) */}
      <div className={card}>
        <label className="block text-sm font-medium text-gray-700 mb-1">의뢰 콘텐츠 수량</label>
        <p className="text-xs text-gray-400 mb-3">선택한 채널별로 인플루언서에게 의뢰할 콘텐츠 개수예요 (채널당 최대 99개).</p>
        {channels.length === 0 ? (
          <p className="text-sm text-gray-400">먼저 위에서 채널을 선택해주세요.</p>
        ) : (
          <div className="space-y-2">
            {channels.map((ch) => (
              <div key={ch} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-sm font-medium text-gray-700 w-24 shrink-0">{ch}</span>
                <span className="text-xs text-gray-400 flex-1">{CHANNEL_UNIT[ch] ?? '콘텐츠'}</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={contentCounts[ch] ?? 1}
                  onChange={(e) => setCount(ch, e.target.value)}
                  className="border border-gray-200 rounded px-2 py-1 text-sm w-20 text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-sm text-gray-500 shrink-0">개</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 결제 예정일 + 결제방식 */}
      <div className={card}>
        <label className="block text-sm font-medium text-gray-700 mb-2">결제 예정일</label>
        <input
          type="date"
          value={paymentDueDate}
          onChange={(e) => setPaymentDueDate(e.target.value)}
          className={input}
        />
        <p className="text-xs text-gray-400 my-2 text-center">또는 결제 규칙을 직접 입력</p>
        <input
          type="text"
          value={paymentDueRule}
          onChange={(e) => setPaymentDueRule(e.target.value)}
          className={input}
          placeholder="예: 원고 업로드 익월 10일 / 세금계산서 발행 후 30일"
        />

        <label className="block text-sm font-medium text-gray-700 mt-4 mb-2">결제방식 (복수 선택 가능)</label>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button key={m} onClick={() => togglePayMethod(m)} className={chip(paymentMethods.includes(m))}>
              {m}
            </button>
          ))}
        </div>
        {paymentMethods.length > 1 && (
          <p className="text-xs text-amber-600 mt-2">복수 선택됨 — 인플루언서가 대시에서 최종 결정해요.</p>
        )}
      </div>

      {/* 필수 키워드 */}
      <div className={card}>
        <label className="block text-sm font-medium text-gray-700 mb-2">필수 키워드 (최대 20개)</label>
        <input
          type="text"
          value={freeTags}
          onChange={(e) => setFreeTags(e.target.value)}
          className={input}
          placeholder="예: #팝업스토어 #가볼만한곳"
        />
        {(() => {
          const n = parseKeywords(freeTags).length
          return (
            <p className={`text-xs mt-1 ${n > 20 ? 'text-red-500' : 'text-gray-400'}`}>
              {n}/20개
            </p>
          )
        })()}
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
