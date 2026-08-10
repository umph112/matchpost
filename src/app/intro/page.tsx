import Link from 'next/link'
import Footer from '@/components/Footer'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* 네비게이션 */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-[#17171B]">MatchPost</h1>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-[#B45309] transition"
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 text-sm font-medium bg-[#F59E0B] text-white rounded-lg hover:bg-[#D97706] transition"
          >
            시작하기
          </Link>
        </div>
      </nav>

      {/* 히어로 섹션 */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="inline-block bg-[#FEF3C7] text-[#B45309] text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          🎉 인플루언서 · 광고주 매칭 플랫폼
        </div>
        <h2 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
          내 일정에 맞는<br />
          <span className="text-[#B45309]">협업 기회</span>를 찾아보세요
        </h2>
        <p className="text-xl text-gray-500 mb-10 leading-relaxed">
          인플루언서는 내 일정을 등록하고,<br />
          광고주는 원하는 날짜와 장소의 인플루언서를 찾아요.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/signup"
            className="px-8 py-3.5 bg-[#F59E0B] text-white font-semibold rounded-xl hover:bg-[#D97706] transition text-lg"
          >
            무료로 시작하기
          </Link>
          <Link
            href="/login"
            className="px-8 py-3.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition text-lg"
          >
            로그인
          </Link>
        </div>
      </section>

      {/* 특징 섹션 */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-4">
            왜 MatchPost인가요?
          </h3>
          <p className="text-center text-gray-500 mb-12">
            기존 방식의 비효율을 해결했어요
          </p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-4xl mb-4">📅</div>
              <h4 className="text-lg font-bold text-gray-800 mb-2">일정 기반 매칭</h4>
              <p className="text-gray-500 text-sm leading-relaxed">
                인플루언서가 미리 일정을 등록하면 광고주가 원하는 날짜와 장소에 맞는 인플루언서를 쉽게 찾을 수 있어요.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-4xl mb-4">🎯</div>
              <h4 className="text-lg font-bold text-gray-800 mb-2">키워드 검색</h4>
              <p className="text-gray-500 text-sm leading-relaxed">
                장소, 날짜, 카테고리 키워드로 딱 맞는 인플루언서를 빠르게 찾아요. 시간 낭비 없이 효율적으로 협업하세요.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-4xl mb-4">💬</div>
              <h4 className="text-lg font-bold text-gray-800 mb-2">실시간 소통</h4>
              <p className="text-gray-500 text-sm leading-relaxed">
                제안부터 계약까지 플랫폼 안에서 모두 해결해요. 실시간 채팅으로 빠르게 협의하세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 사용 방법 섹션 */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            이렇게 사용해요
          </h3>
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
            {/* 인플루언서 */}
            <div>
              <div className="flex items-center mb-6">
                <span className="text-2xl mr-3">🎬</span>
                <h4 className="text-xl font-bold text-gray-800">인플루언서</h4>
              </div>
              <div className="space-y-4">
                {[
                  { step: '01', title: '일정 등록', desc: '날짜, 장소, 카테고리를 입력해서 내 일정을 공개해요' },
                  { step: '02', title: '제안 수신', desc: '광고주로부터 협업 제안을 받아요' },
                  { step: '03', title: '수락 & 소통', desc: '마음에 드는 제안을 수락하고 채팅으로 협의해요' },
                  { step: '04', title: '수입 관리', desc: '수입 현황을 한눈에 확인하고 세금 자료를 다운받아요' },
                ].map(item => (
                  <div key={item.step} className="flex items-start">
                    <span className="text-[#B45309] font-bold text-sm mr-4 mt-0.5 w-6">{item.step}</span>
                    <div>
                      <p className="font-semibold text-gray-800">{item.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 광고주 */}
            <div>
              <div className="flex items-center mb-6">
                <span className="text-2xl mr-3">🏢</span>
                <h4 className="text-xl font-bold text-gray-800">광고주</h4>
              </div>
              <div className="space-y-4">
                {[
                  { step: '01', title: '인플루언서 검색', desc: '원하는 날짜, 장소, 카테고리로 인플루언서를 찾아요' },
                  { step: '02', title: '협업 제안', desc: '마음에 드는 인플루언서에게 제안서를 보내요' },
                  { step: '03', title: '채팅 협의', desc: '실시간 채팅으로 협업 조건을 조율해요' },
                  { step: '04', title: '협업 완료', desc: '계약을 확정하고 콘텐츠 제작을 시작해요' },
                ].map(item => (
                  <div key={item.step} className="flex items-start">
                    <span className="text-[#B45309] font-bold text-sm mr-4 mt-0.5 w-6">{item.step}</span>
                    <div>
                      <p className="font-semibold text-gray-800">{item.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="bg-[#F59E0B] py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h3 className="text-3xl font-bold text-white mb-4">
            지금 바로 시작해보세요
          </h3>
          <p className="text-white/80 mb-8 text-lg">
            인플루언서와 광고주 모두 무료로 가입할 수 있어요
          </p>
          <Link
            href="/signup"
            className="inline-block px-10 py-4 bg-white text-[#B45309] font-bold rounded-xl hover:bg-[#FEF3C7] transition text-lg"
          >
            무료로 시작하기 →
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}