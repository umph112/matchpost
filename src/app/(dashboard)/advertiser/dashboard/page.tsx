import LogoutButton from '@/components/LogoutButton'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdvertiserDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.status === 'pending') redirect('/pending')
  if (profile?.role !== 'advertiser') redirect('/login')

  const { data: advertiserProfile } = await supabase
    .from('advertiser_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const { data: proposals } = await supabase
    .from('proposals')
    .select('*')
    .eq('advertiser_id', user.id)

  const pendingProposals = proposals?.filter(p => p.status === 'pending').length ?? 0
  const acceptedProposals = proposals?.filter(p => p.status === 'accepted').length ?? 0
  const completedProposals = proposals?.filter(p => p.status === 'completed').length ?? 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            안녕하세요, {advertiserProfile?.company_name ?? profile?.name}님 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">원하는 인플루언서를 찾아보세요!</p>
        </div>
        <div className="flex items-center gap-4">
  <div className="text-2xl font-bold text-blue-600">MatchPost</div>
  <LogoutButton />
</div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
          <p className="text-3xl font-bold text-orange-500">{pendingProposals}</p>
          <p className="text-sm text-gray-500 mt-1">검토 중</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
          <p className="text-3xl font-bold text-blue-600">{acceptedProposals}</p>
          <p className="text-sm text-gray-500 mt-1">진행 중</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
          <p className="text-3xl font-bold text-green-500">{completedProposals}</p>
          <p className="text-sm text-gray-500 mt-1">완료</p>
        </div>
      </div>

      <a href="/advertiser/campaigns/new" className="block bg-amber-500 text-white rounded-2xl p-5 shadow-sm hover:bg-amber-600 transition mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-lg">📣 캠페인 등록하기</p>
            <p className="text-amber-100 text-sm mt-1">원하는 일정 · 장소 · 키워드로 협업을 모집하세요</p>
          </div>
          <span className="text-2xl">＋</span>
        </div>
      </a>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <a href="/advertiser/search" className="bg-blue-600 text-white rounded-2xl p-5 shadow-sm hover:bg-blue-700 transition">
          <div className="text-2xl mb-2">🔍</div>
          <p className="font-semibold">인플루언서 찾기</p>
          <p className="text-blue-100 text-sm mt-1">일정 · 장소 · 키워드 검색</p>
        </a>
        <a href="/advertiser/proposals" className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition">
          <div className="text-2xl mb-2">📋</div>
          <p className="font-semibold text-gray-800">제안 관리</p>
          <p className="text-gray-400 text-sm mt-1">보낸 제안 확인</p>
        </a>
        <a href="/advertiser/messages" className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition">
          <div className="text-2xl mb-2">💬</div>
          <p className="font-semibold text-gray-800">메시지</p>
          <p className="text-gray-400 text-sm mt-1">인플루언서와 대화</p>
        </a>
        <a href="/advertiser/profile" className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition">
          <div className="text-2xl mb-2">🏢</div>
          <p className="font-semibold text-gray-800">회사 프로필</p>
          <p className="text-gray-400 text-sm mt-1">브랜드 정보 관리</p>
        </a>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="font-bold text-gray-800 mb-4">최근 제안 내역</h2>
        {proposals && proposals.length > 0 ? (
          <div className="space-y-3">
            {proposals.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.collaboration_type}</p>
                  <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString('ko-KR')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-800">{p.budget?.toLocaleString()}원</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    p.status === 'accepted' ? 'bg-blue-100 text-blue-600' :
                    p.status === 'pending' ? 'bg-orange-100 text-orange-600' :
                    p.status === 'completed' ? 'bg-green-100 text-green-600' :
                    'bg-red-100 text-red-500'
                  }`}>
                    {p.status === 'accepted' ? '수락됨' :
                     p.status === 'pending' ? '검토 중' :
                     p.status === 'completed' ? '완료' : '거절됨'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-8">아직 제안 내역이 없어요</p>
        )}
      </div>
    </div>
  )
}