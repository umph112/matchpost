import LogoutButton from '@/components/LogoutButton'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function InfluencerDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.status === 'pending') redirect('/pending')
  if (profile?.role !== 'influencer') redirect('/login')

  const { data: earnings } = await supabase
    .from('earnings')
    .select('*')
    .eq('influencer_id', user.id)

    const { data: proposals } = await supabase
    .from('proposals')
    .select('*')
    .eq('influencer_id', user.id)
    .eq('status', 'pending')

const pendingProposalCount = proposals?.length ?? 0

  const totalEarnings = earnings?.reduce((sum, e) => sum + e.amount, 0) ?? 0
  const thisMonth = new Date().getMonth()
  const monthlyEarnings = earnings
    ?.filter(e => new Date(e.created_at).getMonth() === thisMonth)
    ?.reduce((sum, e) => sum + e.amount, 0) ?? 0
  const pendingEarnings = earnings
    ?.filter(e => e.status === '예정')
    ?.reduce((sum, e) => sum + e.amount, 0) ?? 0
  const completedEarnings = earnings
    ?.filter(e => e.status === '결제완료')
    ?.reduce((sum, e) => sum + e.amount, 0) ?? 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            안녕하세요, {profile?.name}님 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">오늘도 활발한 활동을 기대해요!</p>
        </div>
        <div className="flex items-center gap-4">
  <div className="text-2xl font-bold text-blue-600">MatchPost</div>
  <LogoutButton />
</div>
      </div>

      {/* 매출 카드 */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm col-span-2">
          <p className="text-sm text-gray-500 mb-1">이번 달 매출</p>
          <p className="text-3xl font-bold text-blue-600">
            {monthlyEarnings.toLocaleString()}원
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">예정 수입</p>
          <p className="text-xl font-bold text-orange-500">
            {pendingEarnings.toLocaleString()}원
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">결제 완료</p>
          <p className="text-xl font-bold text-green-500">
            {completedEarnings.toLocaleString()}원
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm col-span-2">
          <p className="text-sm text-gray-500 mb-1">연간 누적 매출</p>
          <p className="text-2xl font-bold text-gray-800">
            {totalEarnings.toLocaleString()}원
          </p>
        </div>
      </div>

      {/* 빠른 메뉴 */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <a href="/influencer/schedule" className="bg-blue-600 text-white rounded-2xl p-5 shadow-sm hover:bg-blue-700 transition">
          <div className="text-2xl mb-2">📅</div>
          <p className="font-semibold">내 일정 관리</p>
          <p className="text-blue-100 text-sm mt-1">일정 등록 및 관리</p>
        </a>
        <a href="/influencer/proposals" className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition relative">
          {pendingProposalCount > 0 && (
            <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {pendingProposalCount}
            </span>
          )}
          <div className="text-2xl mb-2">💌</div>
          <p className="font-semibold text-gray-800">협업 제안</p>
          <p className="text-gray-400 text-sm mt-1">받은 제안 확인</p>
        </a>
        <a href="/influencer/earnings" className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition">
          <div className="text-2xl mb-2">💰</div>
          <p className="font-semibold text-gray-800">수입 관리</p>
          <p className="text-gray-400 text-sm mt-1">매출 상세 및 정산</p>
        </a>
        <a href="/influencer/messages" className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition">
          <div className="text-2xl mb-2">💬</div>
          <p className="font-semibold text-gray-800">메시지</p>
          <p className="text-gray-400 text-sm mt-1">광고주와 대화</p>
        </a>
      </div>

      {/* 최근 수입 내역 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="font-bold text-gray-800 mb-4">최근 수입 내역</h2>
        {earnings && earnings.length > 0 ? (
          <div className="space-y-3">
            {earnings.slice(0, 5).map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-800">{e.category}</p>
                  <p className="text-xs text-gray-400">{new Date(e.created_at).toLocaleDateString('ko-KR')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-800">{e.amount.toLocaleString()}원</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    e.status === '결제완료' ? 'bg-green-100 text-green-600' :
                    e.status === '예정' ? 'bg-orange-100 text-orange-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {e.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-8">아직 수입 내역이 없어요</p>
        )}
      </div>
    </div>
  )
}