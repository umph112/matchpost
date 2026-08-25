import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { initial } from '@/lib/initial'
import { dateWithDow } from '@/lib/date'
import { CalendarDays, MapPin } from 'lucide-react'
import DashSendButton from '@/components/DashSendButton'

export default async function InfluencerProfilePage({
  params,
}: {
  // Next 16 에서 params 는 Promise 다. 이 페이지만 동기로 받아 params.id 가 undefined 였고,
  // 조회가 늘 빈손이라 로그인 여부와 무관하게 notFound() — 밖에 뿌린 프로필 링크가 「없는 페이지」였다.
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .eq('role', 'influencer')
    .single()

  if (!profile) notFound()

  const { data: influencerProfile } = await supabase
    .from('influencer_profiles')
    .select('*')
    .eq('user_id', id)
    .single()

  const { data: schedules } = await supabase
    .from('schedules')
    .select('*')
    .eq('influencer_id', id)
    .eq('is_public', true)
    .eq('status', 'open')
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date', { ascending: true })

  const { data: userData } = await supabase.auth.getUser()
  const isAdvertiser = userData?.user ? true : false

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 [.adv-pc_&]:max-w-none [.adv-pc_&]:px-0 [.adv-pc_&]:py-0 [.inf-pc_&]:max-w-none [.inf-pc_&]:px-0 [.inf-pc_&]:py-0">
      <Link href="/advertiser/search" className="text-gray-400 hover:text-gray-600 text-sm mb-6 inline-block">
        ← 검색으로 돌아가기
      </Link>

      <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
        <div className="flex items-center mb-4">
          <div className="w-16 h-16 bg-[#FEF3C7] rounded-full flex items-center justify-center text-[#B45309] text-2xl font-bold mr-4">
            {initial(profile.name)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
            <div className="flex gap-2 mt-1">
              {influencerProfile?.platforms?.map((p: string) => (
                <span key={p} className="text-xs bg-[#FEF3C7] text-[#B45309] px-2 py-0.5 rounded-full">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        {influencerProfile?.follower_count > 0 && (
          <div className="flex items-center gap-1 mb-3">
            <span className="text-2xl font-bold text-gray-800">
              {influencerProfile.follower_count.toLocaleString()}
            </span>
            <span className="text-gray-500 text-sm">팔로워</span>
          </div>
        )}

        {influencerProfile?.bio && (
          <p className="text-gray-600 text-sm leading-relaxed mb-4">
            {influencerProfile.bio}
          </p>
        )}

        {influencerProfile?.categories?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {influencerProfile.categories.map((cat: string) => (
              <span key={cat} className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                {cat}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          {influencerProfile?.instagram_url && (
            <a href={influencerProfile.instagram_url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-[#B45309] hover:underline">
              인스타그램 →
            </a>
          )}
          {influencerProfile?.youtube_url && (
            <a href={influencerProfile.youtube_url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-[#B45309] hover:underline">
              유튜브 →
            </a>
          )}
          {influencerProfile?.blog_url && (
            <a href={influencerProfile.blog_url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-[#B45309] hover:underline">
              블로그 →
            </a>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-1"><CalendarDays size={16} strokeWidth={1.75} /> 공개 일정</h2>
        {schedules && schedules.length > 0 ? (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="font-medium text-gray-800">{schedule.title}</p>
                  <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">모집 중</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                  <span className="flex items-center gap-1"><CalendarDays size={16} strokeWidth={1.75} /> {dateWithDow(schedule.date)}</span>
                  <span className="flex items-center gap-1"><MapPin size={16} strokeWidth={1.75} /> {schedule.location_city} {schedule.location_district}</span>
                </div>
                {schedule.start_time && (
                  <p className="text-xs text-gray-500 mb-2">
                    {schedule.start_time.slice(0, 5)}
                    {schedule.end_time && " ~ " + schedule.end_time.slice(0, 5)}
                  </p>
                )}
                <div className="flex flex-wrap gap-1 mb-2">
                  {schedule.predefined_categories?.map((cat: string) => (
                    <span key={cat} className="text-xs bg-[#FEF3C7] text-[#B45309] px-2 py-0.5 rounded-full">{cat}</span>
                  ))}
                  {schedule.free_tags?.map((tag: string) => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{"#" + tag}</span>
                  ))}
                </div>
                {isAdvertiser && (
                  <DashSendButton
                    influencerId={profile.id}
                    influencerName={profile.name ?? '인플루언서'}
                    scheduleId={schedule.id}
                    scheduleDate={schedule.date}
                    className="mt-3 w-full block text-center bg-[#F59E0B] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#D97706] transition"
                  >
                    이 날짜로 대시 보내기
                  </DashSendButton>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-4">공개된 일정이 없어요</p>
        )}
      </div>
      </div>
 )
}
