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

// 채널별 미션(세부 요구조건) 프리셋. type: toggle | number(광고주 값 지정, def=기본값) | text
type MissionDef = { key: string; label: string; type: 'toggle' | 'number' | 'text'; def?: number; unit?: string; ph?: string }
const MISSIONS: Record<string, MissionDef[]> = {
  블로그: [
    { key: '키워드', label: '키워드', type: 'text', ph: '예: #팝업스토어 #가볼만한곳' },
    { key: '글자수', label: '글자수', type: 'number', def: 1000, unit: '자 이상' },
    { key: '사진', label: '사진', type: 'number', def: 5, unit: '장 이상' },
    { key: '지도삽입', label: '지도 삽입', type: 'toggle' },
    { key: '동영상', label: '동영상', type: 'number', def: 5, unit: '초 이상' },
    { key: '링크', label: '링크', type: 'text', ph: '삽입할 URL (예: https://...)' },
  ],
  유튜브: [
    { key: '영상길이', label: '영상 길이', type: 'number', def: 3, unit: '분 이상' },
    { key: '지정멘트', label: '지정 멘트', type: 'text', ph: '꼭 포함할 멘트' },
    { key: '설명란링크', label: '설명란 링크', type: 'toggle' },
    { key: '해시태그', label: '해시태그', type: 'text', ph: '예: #협찬 #제품명' },
  ],
  인스타그램: [
    { key: '사진수', label: '사진/슬라이드', type: 'number', def: 5, unit: '장 이상' },
    { key: '릴스길이', label: '릴스 길이', type: 'number', def: 15, unit: '초 이상' },
    { key: '스토리', label: '스토리 추가', type: 'toggle' },
    { key: '해시태그', label: '해시태그', type: 'text', ph: '예: #협찬 #제품명' },
    { key: '계정태그', label: '계정 태그', type: 'toggle' },
  ],
  틱톡: [
    { key: '영상길이', label: '영상 길이', type: 'number', def: 15, unit: '초 이상' },
    { key: '해시태그', label: '해시태그', type: 'text', ph: '예: #협찬' },
    { key: '지정멘트', label: '지정 멘트', type: 'text', ph: '꼭 포함할 멘트' },
  ],
}
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
  // 채널별 미션(세부 요구조건). 예: { 블로그: { 글자수: 100, 지도삽입: true } }
  const [missions, setMissions] = useState<Record<string, Record<string, string | number | boolean>>>({})

  // 이전 캠페인 불러오기 (내가 올린 캠페인을 양식으로 재사용)
  const [myCampaigns, setMyCampaigns] = useState<any[]>([])
  const [showLoadList, setShowLoadList] = useState(false)
  // 상세 내용 저장 양식 (별도 저장/불러오기)
  const [detailTemplates, setDetailTemplates] = useState<any[]>([])
  const [showDetailTpls, setShowDetailTpls] = useState(false)
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
  const [details, setDetails] = useState('')
  // 가이드 파일 (PDF·워드·한글 등)
  const [guideUrl, setGuideUrl] = useState('')
  const [guideName, setGuideName] = useState('')
  const [guideUploading, setGuideUploading] = useState(false)
  const [isPublic, setIsPublic] = useState(true)

  // 캠페인 이미지 (최대 5장)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [imageUploading, setImageUploading] = useState(false)

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
  // 미션 토글/값 설정
  const isMissionOn = (ch: string, key: string) =>
    !!missions[ch] && Object.prototype.hasOwnProperty.call(missions[ch], key)
  const toggleMission = (ch: string, m: MissionDef) =>
    setMissions((prev) => {
      const cur = { ...(prev[ch] || {}) }
      if (Object.prototype.hasOwnProperty.call(cur, m.key)) delete cur[m.key]
      else cur[m.key] = m.type === 'toggle' ? true : m.type === 'number' ? (m.def ?? 1) : ''
      return { ...prev, [ch]: cur }
    })
  const setMissionVal = (ch: string, key: string, val: string | number) =>
    setMissions((prev) => ({ ...prev, [ch]: { ...(prev[ch] || {}), [key]: val } }))
  const toggleCategory = (cat: string) =>
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]))
  const togglePayMethod = (m: string) =>
    setPaymentMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))

  // 내가 올린 캠페인 목록 조회 (복사 재등록용)
  useEffect(() => {
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('advertiser_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)
      setMyCampaigns(data || [])
      const { data: tpls } = await supabase
        .from('campaign_detail_templates')
        .select('*')
        .eq('advertiser_id', user.id)
        .order('created_at', { ascending: false })
      setDetailTemplates(tpls || [])
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 상세 내용 양식 저장 / 불러오기 / 삭제
  const saveDetailTemplate = async () => {
    if (!details.trim()) return setError('저장할 상세 내용이 없어요.')
    const name = window.prompt('저장할 상세 양식 이름', title || '상세 양식')
    if (!name) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data, error: e } = await supabase
      .from('campaign_detail_templates')
      .insert({ advertiser_id: user.id, name, content: details })
      .select()
      .single()
    if (!e && data) setDetailTemplates((prev) => [data, ...prev])
  }
  const applyDetailTemplate = (t: any) => {
    setDetails((prev) => (prev.trim() ? prev + '\n\n' + (t.content || '') : t.content || ''))
    setShowDetailTpls(false)
  }
  const deleteDetailTemplate = async (id: string) => {
    await supabase.from('campaign_detail_templates').delete().eq('id', id)
    setDetailTemplates((prev) => prev.filter((t) => t.id !== id))
  }

  // 지난 캠페인을 그대로 폼에 채움 (복사 재등록 — 고칠 것만 고치고 새로 등록)
  const applyTemplate = (c: any) => {
    setChannels(c.channels || [])
    setCampaignType(c.campaign_type || '')
    const opts = (c.options || []) as { type: string; cost: number | null }[]
    const rv = opts.find((o) => o.type === '구매평')
    setReviewOpt(!!rv)
    setReviewCost(rv?.cost != null ? String(rv.cost) : '')
    const cl = opts.find((o) => o.type === '네이버클립')
    setClipOpt(!!cl)
    setClipCost(cl?.cost != null ? String(cl.cost) : '')
    setContentCounts(c.content_counts || {})
    setMissions(c.missions || {})
    setSelectedCategories(c.predefined_categories || [])
    setTitle(c.title || '')
    setBudgetManwon(c.budget_total ? String(Math.round(c.budget_total / 10000)) : '')
    setDetails(c.details || '')
    setGuideUrl(c.guide_url || '')
    setGuideName(c.guide_name || '')
    // 모집일정
    setRecruitStart(c.recruit_start || '')
    setRecruitEnd(c.recruit_end || '')
    setAnnounceDate(c.announce_date || '')
    setContentStart(c.content_start || '')
    setContentEnd(c.content_end || '')
    setRecruitTarget(c.recruit_target ? String(c.recruit_target) : '')
    // 진행일정 (dates 재구성)
    const ds = (c.dates || []) as { date: string; start_time: string; end_time: string }[]
    setDates(ds.map((d) => d.date))
    const wk = ds.find((d) => !isWeekend(d.date))
    const we = ds.find((d) => isWeekend(d.date))
    setWeekdayStart(wk?.start_time || ds[0]?.start_time || '')
    setWeekdayEnd(wk?.end_time || ds[0]?.end_time || '')
    if (we && (we.start_time !== (wk?.start_time || '') || we.end_time !== (wk?.end_time || ''))) {
      setUseWeekendTime(true)
      setWeekendDecided(true)
      setWeekendStart(we.start_time || '')
      setWeekendEnd(we.end_time || '')
    } else {
      setUseWeekendTime(false)
      setWeekendDecided(!!we)
      setWeekendStart('')
      setWeekendEnd('')
    }
    // 장소
    setLocationName(c.location_name || '')
    setLocationAddress(c.location_address || '')
    setLocationCity(c.location_city || '')
    setLocationDistrict(c.location_district || '')
    // 결제
    setPaymentDueDate(c.payment_due_date || '')
    setPaymentDueRule(c.payment_due_rule || '')
    setPaymentMethods(c.payment_methods || [])
    setIsPublic(c.is_public ?? true)
    setImageUrls(c.image_urls || [])
    setCoverImageUrl(c.cover_image_url || '')
    setShowLoadList(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 마이페이지에서 "복사 재등록"으로 진입(?copy=<id>) 시 해당 캠페인 자동 불러오기
  useEffect(() => {
    const copyId = new URLSearchParams(window.location.search).get('copy')
    if (!copyId) return
    ;(async () => {
      const { data } = await supabase.from('campaigns').select('*').eq('id', copyId).single()
      if (data) applyTemplate(data)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 이미지 업로드 (campaign-images 버킷, 최대 5장)
  const uploadImages = async (files: FileList) => {
    const remaining = 5 - imageUrls.length
    if (remaining <= 0) return setError('이미지는 최대 5장까지 첨부할 수 있어요.')
    const toUpload = Array.from(files).slice(0, remaining)
    setImageUploading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const uploaded: string[] = []
      for (const file of toUpload) {
        const ext = file.name.split('.').pop() || 'jpg'
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('campaign-images').upload(path, file, { upsert: true })
        if (upErr) { setError('이미지 업로드 실패: ' + upErr.message); break }
        const { data: pub } = supabase.storage.from('campaign-images').getPublicUrl(path)
        uploaded.push(pub.publicUrl)
      }
      setImageUrls((prev) => {
        const next = [...prev, ...uploaded]
        if (!coverImageUrl && next.length > 0) setCoverImageUrl(next[0])
        return next
      })
    } finally {
      setImageUploading(false)
    }
  }
  const removeImage = (url: string) => {
    setImageUrls((prev) => {
      const next = prev.filter((u) => u !== url)
      if (coverImageUrl === url) setCoverImageUrl(next[0] ?? '')
      return next
    })
  }

  // 가이드 파일 업로드 (campaign-guides 버킷)
  const uploadGuide = async (file: File) => {
    setGuideUploading(true)
    setError('')
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const ext = file.name.split('.').pop() || 'file'
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('campaign-guides').upload(path, file, { upsert: true })
      if (upErr) {
        setError('가이드 업로드 실패: ' + upErr.message)
        return
      }
      const { data: pub } = supabase.storage.from('campaign-guides').getPublicUrl(path)
      setGuideUrl(pub.publicUrl)
      setGuideName(file.name)
    } finally {
      setGuideUploading(false)
    }
  }

  // 상세 내용 기본 양식 삽입 (지역 캠페인이면 방문·예약 안내 포함). 기존 내용 있으면 뒤에 덧붙임.
  const loadDetailTemplate = () => {
    const sections = ['■ 제공 내역\n- ']
    if (campaignType === '지역') sections.push('■ 방문 및 예약 안내\n- ')
    sections.push('■ 작성 가이드\n- ')
    sections.push('■ 추가 안내사항\n- ')
    const tpl = sections.join('\n\n')
    setDetails((prev) => (prev.trim() ? prev + '\n\n' + tpl : tpl))
  }

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

    const { error: insertError } = await supabase.from('campaigns').insert({
      advertiser_id: user.id,
      title,
      channels,
      // 선택한 채널에 대해서만 수량 저장 (미입력 시 기본 1)
      content_counts: Object.fromEntries(channels.map((c) => [c, contentCounts[c] ?? 1])),
      // 채널별 미션(세부 요구조건) — 선택 채널만
      missions: Object.fromEntries(channels.map((c) => [c, missions[c] || {}])),
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
      details: details || null,
      guide_url: guideUrl || null,
      guide_name: guideName || null,
      is_public: isPublic,
      image_urls: imageUrls,
      cover_image_url: coverImageUrl || null,
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

  const card = 'bg-white rounded-2xl p-5 shadow-sm mb-4 break-inside-avoid'
  const chip = (on: boolean) =>
    `px-4 py-2 rounded-full text-sm font-medium transition ${
      on ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`
  const input =
    'w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500'

  return (
    <div className="max-w-lg mx-auto px-4 py-8 [.adv-pc_&]:max-w-none [.adv-pc_&]:px-0">
      <div className="flex items-center mb-8">
        <button onClick={() => router.back()} className="mr-4 text-gray-400 hover:text-gray-600">
          ← 뒤로
        </button>
        <h1 className="text-xl font-bold text-gray-900">캠페인 등록</h1>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

      {/* 이전 캠페인 불러오기 (복사 재등록) */}
      {myCampaigns.length > 0 && (
        <div className="relative mb-4">
          <button
            type="button"
            onClick={() => setShowLoadList((v) => !v)}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between shadow-sm"
          >
            <span>📋 이전 캠페인 불러오기 (복사 재등록)</span>
            <span className="text-gray-400">{showLoadList ? '▲' : '▼'}</span>
          </button>
          {showLoadList && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {myCampaigns.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => applyTemplate(c)}
                  className="block w-full text-left px-4 py-2.5 hover:bg-amber-50 border-b border-gray-50 last:border-0"
                >
                  <span className="text-sm font-medium text-gray-800 truncate block">{c.title}</span>
                  <span className="text-xs text-gray-400">
                    {c.campaign_type}
                    {(c.channels?.length ? ' · ' + c.channels.join(', ') : '')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 등록 항목들 — PC 버전에선 2단(멀티컬럼)으로 한눈에 배치 */}
      <div className="[.adv-pc_&]:columns-2 [.adv-pc_&]:gap-5">

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

      {/* ④ 캠페인 이미지 */}
      <div className={card}>
        <label className="block text-sm font-medium text-gray-700 mb-1">캠페인 이미지 <span className="text-gray-400 font-normal">(최대 5장)</span></label>
        <p className="text-xs text-gray-400 mb-3">대표사진은 캠페인 페이지 최상단에 크게 노출돼요. 클릭해서 대표사진을 바꿀 수 있어요.</p>

        {/* 업로드된 이미지 썸네일 */}
        {imageUrls.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {imageUrls.map((url) => (
              <div key={url} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  onClick={() => setCoverImageUrl(url)}
                  className={`w-full aspect-square object-cover rounded-lg cursor-pointer border-2 transition ${
                    coverImageUrl === url ? 'border-amber-500' : 'border-transparent hover:border-gray-300'
                  }`}
                />
                {coverImageUrl === url && (
                  <span className="absolute bottom-1 left-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                    대표
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 추가 업로드 버튼 */}
        {imageUrls.length < 5 && (
          <label className="flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-500 cursor-pointer hover:bg-gray-50">
            {imageUploading ? '업로드 중...' : `＋ 사진 추가 (${imageUrls.length}/5)`}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={imageUploading}
              onChange={(e) => { if (e.target.files?.length) uploadImages(e.target.files) }}
            />
          </label>
        )}
      </div>

      {/* ⑤ 제목 */}
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

      {/* 콘텐츠 수량 및 미션 (선택한 채널별) */}
      <div className={card}>
        <label className="block text-sm font-medium text-gray-700 mb-1">콘텐츠 수량 및 미션</label>
        <p className="text-xs text-gray-400 mb-3">선택한 채널별로 의뢰 수량과 세부 미션(요구조건)을 정해요 (수량 채널당 최대 99개).</p>
        {channels.length === 0 ? (
          <p className="text-sm text-gray-400">먼저 위에서 채널을 선택해주세요.</p>
        ) : (
          <div className="space-y-3">
            {channels.map((ch) => {
              const valueMissions = (MISSIONS[ch] ?? []).filter((m) => m.type !== 'toggle' && isMissionOn(ch, m.key))
              return (
                <div key={ch} className="border border-gray-100 rounded-xl p-3">
                  {/* 수량 */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800 w-24 shrink-0">{ch}</span>
                    <span className="text-xs text-gray-400 flex-1">{CHANNEL_UNIT[ch] ?? '콘텐츠'}</span>
                    <input
                      type="number" min={1} max={99}
                      value={contentCounts[ch] ?? 1}
                      onChange={(e) => setCount(ch, e.target.value)}
                      className="border border-gray-200 rounded px-2 py-1 text-sm w-16 text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-sm text-gray-500 shrink-0">개</span>
                  </div>

                  {/* 미션 칩 */}
                  <p className="text-xs text-gray-500 mt-3 mb-1.5">미션 (요구조건)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(MISSIONS[ch] ?? []).map((m) => (
                      <button
                        key={m.key} type="button"
                        onClick={() => toggleMission(ch, m)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                          isMissionOn(ch, m.key) ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* 값이 필요한 미션(글자수·사진 등) 입력 */}
                  {valueMissions.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {valueMissions.map((m) => (
                        <div key={m.key} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-20 shrink-0">{m.label}</span>
                          {m.type === 'number' ? (
                            <>
                              <input
                                type="number" min={1}
                                value={String(missions[ch]?.[m.key] ?? '')}
                                onChange={(e) => setMissionVal(ch, m.key, e.target.value)}
                                className="border border-gray-200 rounded px-2 py-1 text-xs w-24 text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                              />
                              <span className="text-xs text-gray-500">{m.unit}</span>
                            </>
                          ) : (
                            <input
                              type="text"
                              value={String(missions[ch]?.[m.key] ?? '')}
                              onChange={(e) => setMissionVal(ch, m.key, e.target.value)}
                              placeholder={m.ph}
                              className="border border-gray-200 rounded px-2 py-1 text-xs flex-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 커스텀 미션 */}
                  <input
                    type="text"
                    value={String(missions[ch]?.['_custom'] ?? '')}
                    onChange={(e) => setMissionVal(ch, '_custom', e.target.value)}
                    placeholder="기타 요구사항 직접 입력 (선택)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs mt-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )
            })}
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

      {/* 상세 내용 */}
      <div className={card}>
        <div className="flex items-center justify-between mb-2 gap-2">
          <label className="text-sm font-medium text-gray-700 shrink-0">상세 내용</label>
          <div className="flex items-center gap-1.5 relative">
            <button type="button" onClick={loadDetailTemplate}
              className="text-xs text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50">
              기본 양식
            </button>
            <button type="button" onClick={saveDetailTemplate}
              className="text-xs text-amber-600 border border-amber-200 rounded-lg px-2.5 py-1 hover:bg-amber-50">
              저장
            </button>
            <button type="button" onClick={() => setShowDetailTpls((v) => !v)}
              className="text-xs text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50">
              내 양식{detailTemplates.length > 0 ? ` ${detailTemplates.length}` : ''}
            </button>
            {showDetailTpls && (
              <div className="absolute z-20 right-0 top-8 w-64 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {detailTemplates.length === 0 ? (
                  <p className="text-xs text-gray-400 px-3 py-2">저장된 상세 양식이 없어요.</p>
                ) : (
                  detailTemplates.map((t) => (
                    <div key={t.id} className="flex items-center border-b border-gray-50 last:border-0">
                      <button type="button" onClick={() => applyDetailTemplate(t)}
                        className="flex-1 text-left px-3 py-2 hover:bg-amber-50 text-sm text-gray-700 truncate">
                        {t.name}
                      </button>
                      <button type="button" onClick={() => deleteDetailTemplate(t.id)}
                        className="px-2 text-gray-400 hover:text-red-500 text-xs shrink-0">✕</button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={10}
          className={input + ' resize-none'}
          placeholder="'양식 불러오기'로 제공 내역·작성 가이드 등 기본 섹션을 넣고 작성하거나, 자유롭게 적어주세요." />
      </div>

      {/* 가이드 파일 업로드 */}
      <div className={card}>
        <label className="block text-sm font-medium text-gray-700 mb-1">가이드 파일 <span className="text-gray-400 font-normal">(선택)</span></label>
        <p className="text-xs text-gray-400 mb-2">PDF·워드·한글 등 가이드 파일. 지금 안 올려도 되고, 확정 후 대시에서 개별 전달해도 돼요.</p>
        {guideName ? (
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-sm text-gray-700 truncate flex-1">📎 {guideName}</span>
            {guideUrl && (
              <a href={guideUrl} target="_blank" rel="noreferrer" className="text-xs text-amber-600 shrink-0">보기</a>
            )}
            <button
              type="button"
              onClick={() => { setGuideUrl(''); setGuideName('') }}
              className="text-gray-400 hover:text-red-500 text-sm shrink-0"
            >
              ✕
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-500 cursor-pointer hover:bg-gray-50">
            {guideUploading ? '업로드 중...' : '＋ 파일 선택 (PDF·DOC·HWP 등)'}
            <input
              type="file"
              accept=".pdf,.doc,.docx,.hwp,.hwpx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              disabled={guideUploading}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) uploadGuide(f)
              }}
            />
          </label>
        )}
      </div>

      {/* 공개 설정 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-6 break-inside-avoid">
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
      </div>{/* /등록 항목 2단 래퍼 */}

      <button onClick={handleSubmit} disabled={loading}
        className="w-full bg-amber-500 text-white py-3 rounded-xl font-medium hover:bg-amber-600 transition disabled:opacity-50">
        {loading ? '등록 중...' : '캠페인 등록하기'}
      </button>
    </div>
  )
}
