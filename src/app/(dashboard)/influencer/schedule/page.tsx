'use client'

import { Suspense, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import SaveButton, { useSaveState } from '@/components/SaveButton'

const CATEGORIES = ['맛집', '패션', '뷰티', '여행', '라이프스타일', '육아', '반려동물', '피트니스', '테크', '기타']
const PLATFORMS = ['블로그', '유튜브', '인스타그램', '틱톡']

// 오픈 묶음 보기(D24)의 「여기 열어두기」가 ?date=&from=&to= 로 들어온다.
// useSearchParams 는 Suspense 안에서만 쓸 수 있어 폼을 감싼다.
export default function SchedulePage() {
  return (
    <Suspense fallback={null}>
      <ScheduleForm />
    </Suspense>
  )
}

function ScheduleForm() {
  const sp = useSearchParams()
  const [selectedDate, setSelectedDate] = useState<string>(() => sp.get('date') ?? '')
  // 종료일. 비우면 하루 오픈(date_end = null).
  // 「여수 1박 2일」 같은 오픈을 여기서 만들 수 있어야 오픈 묶음 보기(D24)에 담을 것이 생긴다.
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState(() => sp.get('from') ?? '')
  const [endTime, setEndTime] = useState(() => sp.get('to') ?? '')
  const [locationCity, setLocationCity] = useState('')
  const [locationDistrict, setLocationDistrict] = useState('')
  const [title, setTitle] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [freeTags, setFreeTags] = useState('')
  const [platforms, setPlatforms] = useState<string[]>([])
  const [isPublic, setIsPublic] = useState(true)
  const [seoPublic, setSeoPublic] = useState(false)
  // D31 [4] — 등록 버튼의 상태는 SaveButton 이 들고 있다(하기/중/실패).
  // 성공은 아래 전면 안내로 이미 말하고 1.5초 뒤 화면을 떠난다.
  const save = useSaveState()
  // 그날 이미 열어둔 오픈이 있을 때 그리로 보내주기 위한 id.
  // 빨간 오류만 띄우면 사람은 왜 막혔는지 모른 채 같은 걸 또 만들려고 한다.
  const [dupOpenId, setDupOpenId] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  const togglePlatform = (p: string) => {
    setPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  // 필수값이 비면 버튼을 회색으로 둔다 — 눌러보고 나서 「필수예요」를 듣는 것보다 낫다.
  const canSubmit = !!(selectedDate && locationCity && locationDistrict && title)

  const handleSubmit = () =>
    save.run(async () => {
      // 회색이라 눌리지 않지만, 눌린 경우를 위해 남겨둔다.
      if (!canSubmit) return '날짜, 제목, 장소는 필수 입력이에요.'

      // 종료일이 시작일보다 앞이면 기간이 성립하지 않는다.
      // 저장까지 가면 [date, date_end] 를 보는 검색이 영영 못 잡는 유령 오픈이 남는다.
      if (endDate && endDate < selectedDate) {
        return '종료일이 시작일보다 앞이에요. 날짜를 다시 확인해주세요.'
      }

      setDupOpenId('')
      return await insertOpen()
    })

  // 실패 이유를 문자열로 돌려주면 버튼이 「등록 실패」가 된다.
  const insertOpen = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // 여기서 그냥 return 하면 버튼이 「등록 중…」인 채로 영영 멈췄었다.
      // 로그인이 풀린 것뿐인데 화면은 아무 말도 안 해서 사람이 계속 누르게 된다.
      return '로그인이 풀렸어요. 다시 로그인한 뒤 등록해주세요.'
    }

    // 하루에 오픈은 하나다. 두 줄이 되면 광고주 「인플루언서 찾기」에 같은 사람이
    // 같은 날짜로 두 번 뜨고, 어느 쪽에 말을 걸어야 하는지 알 수 없게 된다.
    // 여기서 먼저 보는 이유는 이유를 말해주기 위해서다 — 못은 DB(0096)가 박는다.
    //
    // ⚠️ 보는 것은 시작일뿐이다(0096 인덱스도 (influencer_id, date) 하나짜리다).
    //    기간이 서로 겹치는 경우는 여기서 막지 않는다 — 막으려면 「하루 오픈이
    //    기간 오픈 안에 들어가도 되나」부터 정해야 해서 별건으로 둔다(D29 2-1).
    //
    // ⚠️ maybeSingle() 을 쓰면 안 된다. 그날 줄이 이미 둘 이상이면
    //    「여러 줄이 왔다」로 오류가 나면서 data 가 null 로 오고,
    //    중복을 막으려던 조회가 중복 앞에서만 통과해버린다(실제로 세 번째 줄이 들어갔다).
    //    limit(1) 로 첫 줄만 가져온다.
    const { data: sameDay } = await supabase
      .from('schedules')
      .select('id')
      .eq('influencer_id', user.id)
      .eq('date', selectedDate)
      .order('created_at')
      .limit(1)

    if (sameDay && sameDay.length > 0) {
      setDupOpenId(sameDay[0].id)
      return '그날은 이미 오픈이 있어요 — 수정하시겠어요?'
    }

    const freeTagsArray = freeTags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)

    const { error: insertError } = await supabase.from('schedules').insert({
      influencer_id: user.id,
      title,
      date: selectedDate,
      // 비우면 null — 하루 오픈이다. 읽는 쪽은 전부 date_end ?? date 로 본다.
      date_end: endDate || null,
      start_time: startTime || null,
      end_time: endTime || null,
      location_city: locationCity,
      location_district: locationDistrict,
      predefined_categories: selectedCategories,
      free_tags: freeTagsArray,
      channels: platforms,
      is_public: isPublic,
      seo_public: seoPublic,
      status: 'open',
    })

    if (insertError) {
      // 23505 = 유니크 위반. 위에서 봤을 땐 없었는데 그새 생긴 경우다
      // — 창을 두 개 띄웠거나 등록을 빠르게 두 번 눌렀을 때 여기로 온다.
      // 사람에게는 위와 똑같은 말을 해야 한다. 원인이 같으니까.
      if (insertError.code === '23505') {
        const { data: existing } = await supabase
          .from('schedules')
          .select('id')
          .eq('influencer_id', user.id)
          .eq('date', selectedDate)
          .order('created_at')
          .limit(1)
        if (existing && existing.length > 0) setDupOpenId(existing[0].id)
        return '그날은 이미 오픈이 있어요 — 수정하시겠어요?'
      }
      return '일정 등록에 실패했어요. 다시 시도해주세요.'
    }

    setSuccess(true)
    setTimeout(() => router.push('/influencer/dashboard'), 1500)
    return null
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center [.inf-pc_&]:max-w-none">
        <h2 className="text-xl font-bold text-gray-800">일정이 등록됐어요!</h2>
        <p className="text-gray-500 text-sm mt-2">광고주들에게 노출되기 시작했어요.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 [.inf-pc_&]:max-w-none [.inf-pc_&]:px-0 [.inf-pc_&]:py-0">
      {/* 헤더 */}
      <div className="flex items-center mb-8">
        {/* D31 4절 — 모바일 뒤로가기는 셸 상단바가 갖는다(여기 두면 두 개가 된다).
            PC 는 온 길(back)이 아니라 정해진 상위 화면으로 간다 — 어디서 왔든 같은 곳. */}
        <Link href="/influencer/schedule/list" className="hidden [.inf-pc_&]:inline-block mr-4 text-gray-400 hover:text-gray-600">
          ← 뒤로
        </Link>
        <h1 className="text-xl font-bold text-gray-900">일정 등록</h1>
      </div>

      {/* D31 [4] — 실패는 화면 맨 위가 아니라 등록 버튼 자리에서 말한다(아래).
          폼이 길어서 버튼을 누른 사람은 여기까지 올라와 보지 않는다. */}

      {/* 제목 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">제목 *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          placeholder="예: 강남 카페 방문 포스팅"
        />
      </div>

      {/* 날짜 — 하루면 시작일만, 여러 날이면 종료일까지 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">날짜 *</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400 mb-1">시작일</p>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full h-[46px] border border-gray-200 rounded-[11px] px-4 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">종료일 (선택)</p>
            <input
              type="date"
              value={endDate}
              min={selectedDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-[46px] border border-gray-200 rounded-[11px] px-4 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
          여러 날에 걸친 일정이면 종료일을 넣어주세요. 하루면 비워두면 됩니다.
        </p>
      </div>

      {/* 시간 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">시간 (선택)</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400 mb-1">시작 시간</p>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">종료 시간</p>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>
      </div>

      {/* 장소 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">장소 *</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400 mb-1">시/구</p>
            <input
              type="text"
              value={locationCity}
              onChange={(e) => setLocationCity(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="예: 서울 강남구"
            />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">동</p>
            <input
              type="text"
              value={locationDistrict}
              onChange={(e) => setLocationDistrict(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="예: 역삼동"
            />
          </div>
        </div>
      </div>

      {/* 플랫폼 (복수 선택 가능) */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">플랫폼 (복수 선택 가능)</label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(p => (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                platforms.includes(p)
                  ? 'bg-[#F59E0B] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* 카테고리 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">카테고리 (복수 선택 가능)</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                selectedCategories.includes(cat)
                  ? 'bg-[#F59E0B] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 자유 태그 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">자유 태그 (쉼표로 구분)</label>
        <input
          type="text"
          value={freeTags}
          onChange={(e) => setFreeTags(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          placeholder="예: 팝업스토어, 신제품, 뷰티"
        />
      </div>

      {/* 공개 설정 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">광고주에게 공개</p>
            <p className="text-xs text-gray-400 mt-0.5">끄면 광고주 검색에 노출되지 않아요</p>
          </div>
          <button
            onClick={() => setIsPublic(!isPublic)}
            className={`w-12 h-6 rounded-full transition ${
              isPublic ? 'bg-[#F59E0B]' : 'bg-gray-300'
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${
              isPublic ? 'translate-x-6' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>

      {/* 검색 노출 (SEO) — is_public 과 별개의 명시적 opt-in. 기본 OFF */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-700">네이버·구글 검색 노출</p>
            <p className="text-[11.5px] text-[#7C7C88] mt-0.5 leading-relaxed">
              네이버·구글에서 이 날짜를 찾을 수 있어요. 이름·채널 주소·연락처는 로그인한 사람에게만 보여요.
            </p>
          </div>
          <button
            onClick={() => setSeoPublic(!seoPublic)}
            className={`shrink-0 w-12 h-6 rounded-full transition ${
              seoPublic ? 'bg-[#F59E0B]' : 'bg-gray-300'
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${
              seoPublic ? 'translate-x-6' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>

      {/* 등록 버튼 — 상태 네 가지는 SaveButton 안에 있다 */}
      <SaveButton
        status={save.status}
        error={save.error}
        onClick={handleSubmit}
        label="일정 등록하기"
        savingLabel="등록 중…"
        savedLabel="등록했어요 ✓"
        failedLabel="등록 실패"
        disabled={!canSubmit}
        disabledHint={canSubmit ? undefined : '날짜 · 제목 · 장소를 채워주세요'}
      />

      {/* 막았으면 갈 곳을 줘야 한다. 안 그러면 같은 걸 또 만들려고 한다. */}
      {dupOpenId && save.status === 'failed' && (
        <button
          onClick={() => router.push(`/influencer/schedule/${dupOpenId}`)}
          className="mt-2 w-full text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl py-2.5 transition"
        >
          그날 오픈 보기 →
        </button>
      )}
    </div>
  )
}