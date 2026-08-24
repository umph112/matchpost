import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Building2, MapPin, Clock, User } from 'lucide-react'
import DashSendButton from '@/components/DashSendButton'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function formatDate(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  const wd = new Date(y, m - 1, d).getDay()
  return `${y}년 ${m}월 ${d}일 (${WEEKDAYS[wd]})`
}

export default async function DayDetailPage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .single()
  const role = profile?.role

  // 캠페인(광고주)
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select(
      'id, title, advertiser_id, location_city, location_district, start_time, end_time, predefined_categories, free_tags, details'
    )
    .eq('date', date)
    .eq('is_public', true)
    .eq('status', 'open')

  // 오픈(인플루언서)
  const { data: opens } = await supabase
    .from('schedules')
    .select(
      'id, title, influencer_id, location_city, location_district, start_time, end_time, predefined_categories, free_tags'
    )
    .eq('date', date)
    .eq('is_public', true)
    .eq('status', 'open')

  const advIds = [...new Set((campaigns ?? []).map((c) => c.advertiser_id))]
  const infIds = [...new Set((opens ?? []).map((o) => o.influencer_id))]
  const allIds = [...advIds, ...infIds]

  const { data: profs } = allIds.length
    ? await supabase.from('profiles').select('id, name').in('id', allIds)
    : { data: [] }
  const nameById = Object.fromEntries((profs ?? []).map((p) => [p.id, p.name]))

  const { data: advProfs } = advIds.length
    // 남의 회사명이라 advertiser_public 뷰로 읽는다(0095) — 원본 표는 본인·팀원·관리자만 보인다
    ? await supabase.from('advertiser_public').select('user_id, company_name').in('user_id', advIds)
    : { data: [] }
  const companyById = Object.fromEntries((advProfs ?? []).map((a) => [a.user_id, a.company_name]))

  const { data: infProfs } = infIds.length
    ? await supabase.from('influencer_profiles').select('user_id, follower_count, platforms').in('user_id', infIds)
    : { data: [] }
  const infById = Object.fromEntries((infProfs ?? []).map((i) => [i.user_id, i]))

  return (
    <div className="max-w-lg mx-auto px-4 py-8 [.adv-pc_&]:max-w-none [.adv-pc_&]:px-0 [.adv-pc_&]:py-0 [.inf-pc_&]:max-w-none [.inf-pc_&]:px-0 [.inf-pc_&]:py-0">
      {/* 헤더 */}
      <div className="flex items-center mb-6">
        <Link href="/" className="mr-4 text-gray-400 hover:text-gray-600">
          ← 달력
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{formatDate(date)}</h1>
      </div>

      {/* 캠페인 (광고주) */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 text-sm font-bold text-amber-700 mb-3">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
          캠페인 · 광고주 모집 <span className="text-gray-400 font-normal">{campaigns?.length ?? 0}</span>
        </h2>
        {campaigns && campaigns.length > 0 ? (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-amber-400">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{c.title}</p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Building2 size={16} strokeWidth={1.75} /> {companyById[c.advertiser_id] ?? nameById[c.advertiser_id] ?? '광고주'}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2 space-y-0.5">
                  <p className="flex items-center gap-1"><MapPin size={16} strokeWidth={1.75} /> {c.location_city} {c.location_district}</p>
                  {(c.start_time || c.end_time) && (
                    <p className="flex items-center gap-1"><Clock size={16} strokeWidth={1.75} /> {c.start_time?.slice(0, 5)}{c.end_time ? ` ~ ${c.end_time.slice(0, 5)}` : ''}</p>
                  )}
                </div>
                {(c.predefined_categories?.length > 0 || c.free_tags?.length > 0) && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.predefined_categories?.map((t: string) => (
                      <span key={t} className="text-[11px] bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">{t}</span>
                    ))}
                    {c.free_tags?.map((t: string) => (
                      <span key={t} className="text-[11px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">#{t}</span>
                    ))}
                  </div>
                )}
                {c.details && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{c.details}</p>}
                {role === 'influencer' && (
                  <Link
                    href={`/profile/${c.advertiser_id}`}
                    className="mt-3 block text-center bg-amber-500 text-white py-2 rounded-xl text-sm font-medium hover:bg-amber-600"
                  >
                    대시하기
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 bg-white rounded-2xl p-4 shadow-sm">등록된 캠페인이 없어요.</p>
        )}
      </section>

      {/* 오픈 (인플루언서) */}
      <section>
        <h2 className="flex items-center gap-2 text-sm font-bold text-blue-700 mb-3">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
          오픈 · 인플루언서 가능일정 <span className="text-gray-400 font-normal">{opens?.length ?? 0}</span>
        </h2>
        {opens && opens.length > 0 ? (
          <div className="space-y-3">
            {opens.map((o) => (
              <div key={o.id} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-blue-400">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{o.title}</p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <User size={16} strokeWidth={1.75} /> {nameById[o.influencer_id] ?? '인플루언서'}
                    {infById[o.influencer_id]?.follower_count
                      ? ` · 팔로워 ${infById[o.influencer_id].follower_count.toLocaleString()}`
                      : ''}
                  </p>
                </div>
                <div className="text-xs text-gray-500 mt-2 space-y-0.5">
                  <p className="flex items-center gap-1"><MapPin size={16} strokeWidth={1.75} /> {o.location_city} {o.location_district}</p>
                  {(o.start_time || o.end_time) && (
                    <p className="flex items-center gap-1"><Clock size={16} strokeWidth={1.75} /> {o.start_time?.slice(0, 5)}{o.end_time ? ` ~ ${o.end_time.slice(0, 5)}` : ''}</p>
                  )}
                </div>
                {(o.predefined_categories?.length > 0 || o.free_tags?.length > 0) && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {o.predefined_categories?.map((t: string) => (
                      <span key={t} className="text-[11px] bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">{t}</span>
                    ))}
                    {o.free_tags?.map((t: string) => (
                      <span key={t} className="text-[11px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">#{t}</span>
                    ))}
                  </div>
                )}
                {role === 'advertiser' && (
                  <DashSendButton
                    influencerId={o.influencer_id}
                    influencerName={nameById[o.influencer_id] ?? '인플루언서'}
                    scheduleId={o.id}
                    scheduleDate={date}
                    className="mt-3 w-full block text-center bg-[#F59E0B] text-white py-2 rounded-xl text-sm font-medium hover:bg-[#D97706] transition"
                  >
                    이 날짜로 대시 보내기
                  </DashSendButton>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 bg-white rounded-2xl p-4 shadow-sm">등록된 오픈 일정이 없어요.</p>
        )}
      </section>
    </div>
  )
}
