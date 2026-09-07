'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { INFLUENCER_CATEGORIES } from '@/lib/categories'
import CancelBadge from '@/components/CancelBadge'
import { dateWithDow } from '@/lib/date'
import ApplyCampaignModal, { type ApplyCampaign } from '@/components/ApplyCampaignModal'
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
  // 이미 줄이 있는 캠페인 — 내가 지원한 것과 광고주가 먼저 대시를 보낸 것을 구분한다
  // reapply = 지원했다가 반려당한 것. 다시 지원할 수 있어서 눌리기는 하지만 글자가 다르다.
  const [mine, setMine] = useState<Record<string, 'applied' | 'dashed' | 'reapply'>>({})
  const [applying, setApplying] = useState<ApplyCampaign | null>(null)
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
        'id, title, brand_name, date, location_city, location_district, start_time, end_time, predefined_categories, free_tags, details, advertiser_id, campaign_type, dates, content_start, recruit_end, recruit_closed_at'
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
          .select('id, name, cancellation_count')
          .eq('id', campaign.advertiser_id)
          .single()
        // 남의 회사명이라 advertiser_public 뷰로 읽는다(0095)
        const { data: ap } = await supabase
          .from('advertiser_public')
          .select('company_name')
          .eq('user_id', campaign.advertiser_id)
          .maybeSingle()
        const { data: score } = await supabase
          .from('advertiser_payment_score')
          .select('on_time_rate, deals_count')
          .eq('advertiser_id', campaign.advertiser_id)
          .maybeSingle()
        return {
          ...campaign,
          // 인플루언서에게는 브랜드명을 그대로 노출 — 비면 회사 상호로 대체
          advertiserName: campaign.brand_name ?? ap?.company_name ?? profile?.name ?? '광고주',
          onTimeRate: score?.on_time_rate ?? null,
          advertiserCancelCount: profile?.cancellation_count ?? 0,
        }
      })
    )

    // 이미 지원한 캠페인은 버튼을 「지원함」으로 바꾼다.
    // 화면 표시일 뿐이고, 실제로 막는 것은 0098 의 유니크 인덱스다 — 창 두 개는 여기서 못 막는다.
    //
    // ⚠️ status 를 같이 읽는다. 전에는 줄이 있기만 하면 「지원함」이라, 반려당한 사람도
    //    버튼이 죽어 있어 다시 지원할 길이 없었다. 반려는 그 캠페인이 끝났다는 뜻이 아니다 —
    //    조건을 바꿔 다시 지원할 수 있어야 한다(0101).
    const ids = enriched.map((c) => c.id)
    const { data: { user } } = await supabase.auth.getUser()
    if (user && ids.length > 0) {
      const { data: rows } = await supabase
        .from('proposals')
        .select('campaign_id, initiated_by, status')
        .eq('influencer_id', user.id)
        .in('campaign_id', ids)
      setMine(Object.fromEntries(
        (rows ?? []).map((r) => [
          r.campaign_id as string,
          r.status === 'rejected'
            ? 'reapply'
            : r.initiated_by === 'influencer'
              ? 'applied'
              : 'dashed',
        ])
      ))
    } else {
      setMine({})
    }

    setResults(enriched)
    setLoading(false)
  }

  const today = new Date().toISOString().slice(0, 10)

  const inputCls =
    'w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500'

  return (
    <div className="max-w-lg mx-auto px-4 py-8 lg:[.inf-pc_&]:max-w-none lg:[.inf-pc_&]:mx-0 lg:[.inf-pc_&]:px-0 lg:[.inf-pc_&]:py-0">
      {/* 헤더 */}
      <div className="mb-8 lg:[.inf-pc_&]:mb-[14px]">
        <div className="flex items-center">
          <Link href="/influencer/dashboard" className="hidden lg:[.inf-pc_&]:inline-block mr-4 text-gray-400 hover:text-gray-600">
            ← 뒤로
          </Link>
          <h1 className="text-xl font-bold text-gray-900 lg:[.inf-pc_&]:text-[23px] lg:[.inf-pc_&]:font-extrabold lg:[.inf-pc_&]:tracking-[-0.03em]">캠페인 검색</h1>
        </div>
        {/* D29 2절 — 기간 캠페인은 진행 기간 안의 모든 날짜에 걸린다.
            이 줄이 없으면 「왜 고르지 않은 날에도 나오나」를 묻는다. */}
        <p className="mt-[5px] text-[13px] text-[#7C7C88]">
          <span className="font-bold text-[#3C3C46]">날짜</span>를 고르고 지역 · 분야로 좁혀 보세요. 기간 캠페인은 진행 기간 안의 모든 날짜에 나타납니다.
        </p>
      </div>

      {/* 검색 필터 — D34 2-3.
          ⚠️ 왼쪽 사이드바가 아니다. 카드가 폭을 다 쓰고 그 「안에서만」 380px + 나머지로 갈린다.
             사이드바로 만들면 결과가 좁아지고 광고주 검색(D11 §3)과도 어긋난다.
          모바일은 지금 그대로 — PC 값은 전부 lg:[.inf-pc_&]: 에만 건다. */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4 lg:[.inf-pc_&]:p-0 lg:[.inf-pc_&]:mb-[14px] lg:[.inf-pc_&]:rounded-[14px] lg:[.inf-pc_&]:border lg:[.inf-pc_&]:border-[#EAEAEE] lg:[.inf-pc_&]:shadow-none lg:[.inf-pc_&]:overflow-hidden">
        {/* 헤더 — 높이를 고정하지 않는다. padding + items-center 로 상하 여백을 같게 준다 */}
        <div className="flex items-baseline mb-4 lg:[.inf-pc_&]:mb-0 lg:[.inf-pc_&]:px-5 lg:[.inf-pc_&]:py-[13px] lg:[.inf-pc_&]:border-b lg:[.inf-pc_&]:border-[#F1F1F4]">
          <h2 className="font-semibold text-gray-800 lg:[.inf-pc_&]:text-[13px] lg:[.inf-pc_&]:font-extrabold lg:[.inf-pc_&]:text-[#17171B]">검색 조건</h2>
          <span className="hidden lg:[.inf-pc_&]:inline ml-[9px] text-[11.5px] text-[#B0B0BB]">비워두면 전체를 봅니다</span>
        </div>

        {/* DOM 순서는 모바일 순서 그대로 둔다(날짜 → 지역 → 키워드 → 분야 → 버튼).
            PC 두 칸은 order 가 아니라 grid 자리지정(col-start/row-start)으로 만든다 —
            order 로 옮기면 탭 순서가 눈에 보이는 순서와 어긋난다. */}
        <div className="lg:[.inf-pc_&]:grid lg:[.inf-pc_&]:grid-cols-[380px_minmax(0,1fr)] lg:[.inf-pc_&]:gap-x-[22px] lg:[.inf-pc_&]:gap-y-4 lg:[.inf-pc_&]:items-start lg:[.inf-pc_&]:px-[18px] lg:[.inf-pc_&]:pt-4 lg:[.inf-pc_&]:pb-[18px]">
          {/* 날짜 — PC 우측 첫 줄 */}
          <div className="mb-3 lg:[.inf-pc_&]:mb-0 lg:[.inf-pc_&]:col-start-2 lg:[.inf-pc_&]:row-start-1">
            <label className="block text-sm text-gray-500 mb-1 lg:[.inf-pc_&]:text-[11px] lg:[.inf-pc_&]:font-bold lg:[.inf-pc_&]:text-[#9A9AA5] lg:[.inf-pc_&]:mb-[7px]">날짜</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>

          {/* 지역 — PC 좌측 380px */}
          <div className="mb-3 lg:[.inf-pc_&]:mb-0 lg:[.inf-pc_&]:col-start-1 lg:[.inf-pc_&]:row-start-1 lg:[.inf-pc_&]:min-w-0">
            <div className="hidden lg:[.inf-pc_&]:block text-[11px] font-bold text-[#9A9AA5] mb-[7px]">지역</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-500 mb-1 lg:[.inf-pc_&]:hidden">시/구</label>
                <input type="text" value={locationCity} onChange={(e) => setLocationCity(e.target.value)}
                  className={inputCls} placeholder="예: 서울 강남구" />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1 lg:[.inf-pc_&]:hidden">동</label>
                <input type="text" value={locationDistrict} onChange={(e) => setLocationDistrict(e.target.value)}
                  className={inputCls} placeholder="예: 역삼동" />
              </div>
            </div>
          </div>

          {/* 키워드 — PC 우측 셋째 줄 */}
          <div className="mb-4 lg:[.inf-pc_&]:mb-0 lg:[.inf-pc_&]:col-start-2 lg:[.inf-pc_&]:row-start-3">
            <label className="block text-sm text-gray-500 mb-1 lg:[.inf-pc_&]:text-[11px] lg:[.inf-pc_&]:font-bold lg:[.inf-pc_&]:text-[#9A9AA5] lg:[.inf-pc_&]:mb-[7px]">키워드</label>
            <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
              className={inputCls} placeholder="예: 팝업스토어, 신제품" />
          </div>

          {/* 분야 — PC 우측 둘째 줄 */}
          <div className="mb-4 lg:[.inf-pc_&]:mb-0 lg:[.inf-pc_&]:col-start-2 lg:[.inf-pc_&]:row-start-2">
            <label className="block text-sm text-gray-500 mb-2 lg:[.inf-pc_&]:text-[11px] lg:[.inf-pc_&]:font-bold lg:[.inf-pc_&]:text-[#9A9AA5] lg:[.inf-pc_&]:mb-[7px]">분야</label>
            <div className="flex flex-wrap gap-1.5">
              {INFLUENCER_CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    selectedCategories.includes(cat) ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>{cat}</button>
              ))}
            </div>
          </div>

          {/* 검색 — PC 우측 넷째 줄 */}
          <div className="lg:[.inf-pc_&]:col-start-2 lg:[.inf-pc_&]:row-start-4">
            <button onClick={handleSearch} disabled={loading}
              className="w-full bg-amber-500 text-white py-2.5 rounded-lg font-medium hover:bg-amber-600 transition disabled:opacity-50 lg:[.inf-pc_&]:w-auto lg:[.inf-pc_&]:px-6">
              {loading ? '검색 중...' : <span className="inline-flex items-center gap-1"><Search size={16} strokeWidth={1.75} /> 캠페인 검색</span>}
            </button>
          </div>
        </div>
      </div>

      {/* 결과 — D34 2-4.
          ⚠️ 빈 상태를 반드시 그린다. 검색 전에는 결과 자리가 통째로 비어 있어서,
             PC 에서 620px 짜리 공백이 사용자가 가장 먼저 만나는 화면이었다. */}
      {!searched ? (
        <div className="bg-white rounded-2xl shadow-sm lg:[.inf-pc_&]:rounded-[14px] lg:[.inf-pc_&]:border lg:[.inf-pc_&]:border-[#EAEAEE] lg:[.inf-pc_&]:shadow-none min-h-[220px] flex flex-col items-center justify-center text-center px-6">
          <CalendarDays size={30} strokeWidth={1.5} className="text-[#C4C4CE]" />
          <p className="mt-3 text-[13px] text-[#9A9AA5]">날짜를 고르면 그날 진행하는 캠페인이 나와요</p>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm lg:[.inf-pc_&]:rounded-[14px] lg:[.inf-pc_&]:border lg:[.inf-pc_&]:border-[#EAEAEE] lg:[.inf-pc_&]:shadow-none min-h-[220px] flex flex-col items-center justify-center text-center px-6">
          <p className="text-[13px] text-[#9A9AA5]">조건에 맞는 캠페인이 없어요</p>
          <p className="mt-1.5 text-[12px] text-[#C4C4CE]">조건을 넓혀보세요</p>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            {results.length}건의 캠페인을 찾았어요
          </p>

          {/* PC 2열. 카드는 h-full flex 로 늘려 좌우 단차를 없앤다 */}
          <div className="lg:[.inf-pc_&]:grid lg:[.inf-pc_&]:grid-cols-2 lg:[.inf-pc_&]:gap-[14px] lg:[.inf-pc_&]:items-stretch">
          {results.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl p-5 shadow-sm mb-3 border-l-4 border-amber-400 lg:[.inf-pc_&]:mb-0 lg:[.inf-pc_&]:h-full lg:[.inf-pc_&]:flex lg:[.inf-pc_&]:flex-col">
              <p className="font-semibold text-gray-900">{c.title}</p>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                <Building2 size={16} strokeWidth={1.75} /> <Link href={`/advertiser/${c.advertiser_id}`} className="hover:underline">{c.advertiserName}</Link>
                {c.onTimeRate != null && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium">
                    <span className={`w-1.5 h-1.5 rounded-full ${c.onTimeRate >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className={c.onTimeRate >= 90 ? 'text-emerald-600' : 'text-amber-600'}>정산 {c.onTimeRate}%</span>
                  </span>
                )}
                {/* 신청하기 전에 보여야 의미가 있다 */}
                <CancelBadge role="advertiser" count={c.advertiserCancelCount} />
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

              {/* D32 1절 — 캠페인은 조건이 이미 정해져 있으니 「지원하기」다.
                  조건을 제안하는 「대시 보내기」는 광고주가 인플루언서 오픈에 거는 쪽 말이다.
                  PC 2열에서는 카드 높이가 서로 달라지니 mt-auto 로 버튼을 바닥에 붙인다. */}
              <div className="lg:[.inf-pc_&]:mt-auto">
              {mine[c.id] === 'applied' ? (
                <button disabled className="w-full bg-gray-100 text-gray-400 py-2 rounded-lg text-sm font-medium cursor-not-allowed">
                  지원함
                </button>
              ) : mine[c.id] === 'dashed' ? (
                <button
                  onClick={() => router.push(`/influencer/messages?receiverId=${c.advertiser_id}`)}
                  className="w-full border border-gray-200 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                >
                  대화 보기
                </button>
              ) : c.recruit_closed_at || (c.recruit_end && c.recruit_end < today) ? (
                /* 광고주가 「모집 마감」을 눌렀거나(recruit_closed_at), 적어 둔 신청 마감일이 지난 경우.
                   눌러도 서버(apply_to_campaign)가 같은 이유로 막지만, 여기서 먼저 닫아 헛걸음을 줄인다. */
                <button disabled className="w-full bg-gray-100 text-gray-400 py-2 rounded-lg text-sm font-medium cursor-not-allowed">
                  모집 종료
                </button>
              ) : mine[c.id] === 'reapply' ? (
                /* 반려당한 뒤. 눌리기는 「지원하기」와 같지만 글자를 바꿔 둔다 —
                   전에 한 번 반려됐다는 것을 모르고 같은 조건으로 또 내면
                   광고주에게 같은 알림이 반복될 뿐이다. 사유는 「받은 대시」 목록의
                   그 줄에 「반려 · 사유」로 붙어 있다.
                   모집 종료 검사보다 뒤에 둔다 — 닫힌 캠페인엔 다시도 없다. */
                <button
                  onClick={() => setApplying(c)}
                  className="w-full border border-amber-500 text-amber-600 py-2 rounded-lg text-sm font-medium hover:bg-amber-50 transition"
                >
                  다시 지원
                </button>
              ) : (
                <button
                  onClick={() => setApplying(c)}
                  className="w-full bg-amber-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-amber-600 transition"
                >
                  지원하기
                </button>
              )}
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {applying && (
        <ApplyCampaignModal
          campaign={applying}
          onClose={() => setApplying(null)}
          onApplied={() => {
            setMine((prev) => ({ ...prev, [applying.id]: 'applied' }))
            setApplying(null)
          }}
        />
      )}
    </div>
  )
}
