import Logo from '@/components/Logo'
import Footer from '@/components/Footer'
import RoleLoginPanel from '@/components/RoleLoginPanel'

// D7 부록 3 — 랜딩(/)과 로그인을 한 화면(좌 검정 / 우 흰색 2단)으로 합쳤다.
// 장식용 달력 격자(부록 3-4)는 "구현이 부담되면 생략" 허용 문구에 따라 생략 — 검정 배경만 유지.
const POINTS = [
  { n: '01', title: '날짜와 장소, 키워드로 손쉽게 찾는 협업건', desc: '광고주와 인플루언서가 서로 원하는대로 자동 매칭까지 가능해요!' },
  { n: '02', title: '자동생성 딜시트로 손쉽게 협업관리', desc: '협업 조율부터 결제까지 자동생성 딜시트로 쉽고 꼼꼼하게 챙겨줘요!' },
  { n: '03', title: '인플루언서 마케팅, 매치포스트에서 다 된다', desc: '인플루언서 마케팅에 최적화된 시스템을 경험해보세요!' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* 좌: 검정 — 브랜드 + 헤드라인 + 3포인트 + 사업자정보 */}
      <div className="flex-1 bg-[#17171B] px-6 py-10 lg:px-[52px] lg:py-10 flex flex-col">
        <Logo size={20} dark beta />

        <div className="flex-1 flex flex-col justify-center py-10 lg:py-0 max-w-[560px]">
          <h1 style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.28, color: '#fff' }}>
            내가 필요할 때!<br />손쉽게~
          </h1>
          <p className="mt-6 text-[16px] leading-[1.85]" style={{ color: 'rgba(255,255,255,0.62)' }}>
            광고주와 인플루언서가 직접 만나는 협업 플랫폼입니다.<br className="hidden sm:block" />
            날짜 · 지역 · 분야로 찾고, 대화 한 번으로 협업이 시작됩니다.
          </p>

          <div className="mt-11 flex flex-col gap-[15px]">
            {POINTS.map((p) => (
              <div key={p.n} className="flex gap-3">
                <span className="shrink-0 pt-[3px]" style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.04em', color: '#F59E0B', width: 22 }}>
                  {p.n}
                </span>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>{p.title}</p>
                  <p className="mt-[5px]" style={{ fontSize: 13, color: 'rgba(255,255,255,0.48)', lineHeight: 1.65 }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hidden lg:block">
          <Footer dark />
        </div>
      </div>

      {/* 우: 흰색 — 로그인 */}
      <div className="lg:w-[460px] shrink-0 bg-white px-6 py-10 lg:px-[52px] lg:py-11 flex flex-col justify-center">
        <RoleLoginPanel />
        <div className="lg:hidden mt-8">
          <Footer />
        </div>
      </div>
    </div>
  )
}
