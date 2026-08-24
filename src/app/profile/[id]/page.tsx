import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'
import { initial } from '@/lib/initial'
import DashSendButton from '@/components/DashSendButton'
import CancelBadge from '@/components/CancelBadge'
import { dateWithDow } from '@/lib/date'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  const { data: ip } = await supabase
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
    .order('date', { ascending: true })

 console.log('params.id:', id)
console.log('profile:', profile)

    if (!profile) return <div>존재하지 않는 인플루언서예요</div>

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
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
              <CancelBadge role="influencer" count={profile.cancellation_count} />
            </div>
          </div>
        </div>

        {ip?.bio && (
          <p className="text-gray-600 text-sm leading-relaxed mb-4">{ip.bio}</p>
        )}

        {ip?.categories?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {ip.categories.map((cat: string) => (
              <span key={cat} className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                {cat}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="font-bold text-gray-800 mb-4">공개 일정</h2>
        {schedules && schedules.length > 0 ? (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="border border-gray-100 rounded-xl p-4">
                <p className="font-medium text-gray-800 mb-1">{schedule.title}</p>
                <p className="text-xs text-gray-500 mb-2">
                  {dateWithDow(schedule.date)} / {schedule.location_city} {schedule.location_district}
                </p>
                <DashSendButton
                  influencerId={profile.id}
                  influencerName={profile.name}
                  scheduleId={schedule.id}
                  className="w-full block text-center bg-[#F59E0B] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#D97706] transition"
                >
                  대시 보내기
                </DashSendButton>
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