import LogoutButton from '@/components/LogoutButton'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/login')

  // 통계
  const { data: allUsers } = await supabase
    .from('profiles')
    .select('*')

  const pendingUsers = allUsers?.filter(u => u.status === 'pending') ?? []
  const approvedUsers = allUsers?.filter(u => u.status === 'approved') ?? []
  const influencers = allUsers?.filter(u => u.role === 'influencer') ?? []
  const advertisers = allUsers?.filter(u => u.role === 'advertiser') ?? []

  const { data: allProposals } = await supabase
    .from('proposals')
    .select('*')

  const { data: allSchedules } = await supabase
    .from('schedules')
    .select('*')

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
          <p className="text-gray-500 text-sm mt-1">MatchPost 운영 현황</p>
        </div>
        <div className="flex items-center gap-4">
  <div className="text-2xl font-bold text-blue-600">MatchPost</div>
  <LogoutButton />
</div>
      </div>

      {/* 승인 대기 알림 */}
      {pendingUsers.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-2xl mr-3">⚠️</span>
            <div>
              <p className="font-semibold text-orange-800">승인 대기 중인 회원이 있어요</p>
              <p className="text-sm text-orange-600">{pendingUsers.length}명이 승인을 기다리고 있어요</p>
            </div>
          </div>
          <Link
            href="/admin/users"
            className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition"
          >
            확인하기
          </Link>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">전체 회원</p>
          <p className="text-3xl font-bold text-gray-800">{allUsers?.length ?? 0}</p>
          <div className="flex gap-3 mt-2 text-xs text-gray-400">
            <span>인플루언서 {influencers.length}명</span>
            <span>광고주 {advertisers.length}명</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">승인 대기</p>
          <p className="text-3xl font-bold text-orange-500">{pendingUsers.length}</p>
          <p className="text-xs text-gray-400 mt-2">승인 완료 {approvedUsers.length}명</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">전체 제안</p>
          <p className="text-3xl font-bold text-blue-600">{allProposals?.length ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">등록된 일정</p>
          <p className="text-3xl font-bold text-green-500">{allSchedules?.length ?? 0}</p>
        </div>
      </div>

      {/* 빠른 메뉴 */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/admin/users" className="bg-blue-600 text-white rounded-2xl p-5 shadow-sm hover:bg-blue-700 transition">
          <div className="text-2xl mb-2">👥</div>
          <p className="font-semibold">회원 관리</p>
          <p className="text-blue-100 text-sm mt-1">승인 및 회원 목록</p>
        </Link>
        <Link href="/admin/users?filter=pending" className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition">
          <div className="text-2xl mb-2">⏳</div>
          <p className="font-semibold text-gray-800">승인 대기</p>
          <p className="text-gray-400 text-sm mt-1">{pendingUsers.length}명 대기 중</p>
        </Link>
        <Link href="/admin/credits" className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition col-span-2">
          <div className="text-2xl mb-2">🪙</div>
          <p className="font-semibold text-gray-800">크레딧 관리</p>
          <p className="text-gray-400 text-sm mt-1">회원별 잔액 조회 · 지급 · 차감 · 이력</p>
        </Link>
      </div>
    </div>
  )
}