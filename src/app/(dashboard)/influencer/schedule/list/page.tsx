import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ScheduleListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: schedules } = await supabase
    .from('schedules')
    .select('*')
    .eq('influencer_id', user.id)
    .order('date', { ascending: true })

  const today = new Date().toISOString().split('T')[0]
  const upcoming = schedules?.filter(s => s.date >= today) ?? []
  const past = schedules?.filter(s => s.date < today) ?? []

  const statusLabel = (status: string) => {
    if (status === 'open') return { label: '모집 중', color: 'bg-green-100 text-green-600' }
    if (status === 'negotiating') return { label: '협의 중', color: 'bg-orange-100 text-orange-600' }
    if (status === 'booked') return { label: '확정', color: 'bg-blue-100 text-blue-600' }
    return { label: status, color: 'bg-gray-100 text-gray-500' }
  }

  const ScheduleCard = ({ schedule }: { schedule: any }) => {
    const { label, color } = statusLabel(schedule.status)
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-3">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-800">{schedule.title}</h3>
            <p className="text-sm text-gray-400 mt-0.5">
              {schedule.location_city} {schedule.location_district}
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${color}`}>
            {label}
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>📅 {new Date(schedule.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</span>
          {schedule.start_time && (
            <span>🕐 {schedule.start_time.slice(0, 5)}
              {schedule.end_time && ` ~ ${schedule.end_time.slice(0, 5)}`}
            </span>
          )}
        </div>

        {schedule.predefined_categories?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
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

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <span className="text-xs text-gray-400">
            {schedule.is_public ? '👁 공개' : '🔒 비공개'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Link href="/influencer/dashboard" className="mr-4 text-gray-400 hover:text-gray-600">
            ← 뒤로
          </Link>
          <h1 className="text-xl font-bold text-gray-900">내 일정</h1>
        </div>
        <Link
          href="/influencer/schedule"
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          + 일정 추가
        </Link>
      </div>

      {/* 일정이 없을 때 */}
      {schedules?.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📅</div>
          <p className="text-gray-500 mb-4">아직 등록된 일정이 없어요</p>
          <Link
            href="/influencer/schedule"
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            첫 일정 등록하기
          </Link>
        </div>
      )}

      {/* 예정 일정 */}
      {upcoming.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
            예정된 일정 ({upcoming.length})
          </h2>
          {upcoming.map(s => <ScheduleCard key={s.id} schedule={s} />)}
        </div>
      )}

      {/* 지난 일정 */}
      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">
            지난 일정 ({past.length})
          </h2>
          <div className="opacity-60">
            {past.map(s => <ScheduleCard key={s.id} schedule={s} />)}
          </div>
        </div>
      )}
    </div>
  )
}