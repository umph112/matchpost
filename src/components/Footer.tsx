import Link from 'next/link'

// D6 F1 — 전자상거래법 제10조 사업자 정보 표시 + 통신판매중개자 면책 문구.
// 초기 화면(로그인 전)에만 둔다 — 콘솔(로그인 후)에는 약관/개인정보처리방침 링크만.
// ⚠️ 사업자등록번호·통신판매업 신고번호·주소·전화 등은 전부 예시값 — 실제 값으로 교체 필요
// (docs/design/d6/LEGAL-CHECKLIST.md 참고).
// D7 부록 3-5 — 값의 원본은 이 파일 하나. dark=true는 랜딩 좌측(검정 배경)용 색만 다르다.
export default function Footer({ dark = false }: { dark?: boolean }) {
  if (dark) {
    return (
      <footer className="pt-[17px] mt-auto border-t border-white/[0.09]">
        <div className="flex flex-col gap-[13px] text-[11px] leading-relaxed">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span style={{ fontWeight: 800, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)' }}>CONTENTS PLACE</span>
            <span className="text-white/40">v0.9.2</span>
            <span className="ml-auto flex gap-3">
              <Link href="/terms" className="text-white/50 hover:text-white/80">이용약관</Link>
              <Link href="/privacy" className="font-bold text-white/70 hover:text-white">개인정보처리방침</Link>
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-white/24">상호 <span className="text-white/44">컨텐츠플레이스</span></span>
            <span className="text-white/24">대표 <span className="text-white/44">김정현</span></span>
            <span className="text-white/24">사업자등록번호 <span className="text-white/44">000-00-00000</span></span>
            <span className="text-white/24">통신판매업 신고번호 <span className="text-white/44">제0000-서울OO-00000호</span></span>
            <a href="https://www.ftc.go.kr/bizCommPop.do" target="_blank" rel="noopener noreferrer" className="text-white/44 underline underline-offset-2 hover:text-white/70">
              사업자정보 확인
            </a>
          </div>
          <p className="text-white/32 max-w-[760px]">
            매치포스트는 광고주와 인플루언서를 잇는 통신판매중개자이며, 통신판매의 당사자가 아닙니다.
            협업 조건 · 대금 지급 · 콘텐츠 게재의 이행 책임은 각 거래 당사자에게 있습니다.
          </p>
        </div>
      </footer>
    )
  }

  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-8 text-[11.5px] text-gray-500 leading-relaxed">
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
          <span>상호 <strong className="text-gray-700 font-semibold">컨텐츠플레이스</strong></span>
          <span>대표 <strong className="text-gray-700 font-semibold">김정현</strong></span>
          <span>사업자등록번호 000-00-00000</span>
          <span>통신판매업 신고번호 제0000-서울OO-00000호</span>
          <a
            href="https://www.ftc.go.kr/bizCommPop.do"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#B45309] underline underline-offset-2 hover:text-[#92400E]"
          >
            사업자정보 확인
          </a>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
          <span>주소 서울특별시 마포구 양화로 45, 8층</span>
          <span>고객센터 02-336-1930 (평일 10:00–18:00)</span>
          <span>이메일 privacy@matchpost.kr</span>
          <span>개인정보 보호책임자 김정현</span>
          <span>호스팅 Supabase, Inc. (서울 리전)</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
          <Link href="/terms" className="hover:text-gray-700">이용약관</Link>
          <Link href="/privacy" className="font-bold text-gray-700 hover:text-[#B45309]">개인정보처리방침</Link>
        </div>
        <p className="text-[10.5px] text-gray-400 leading-relaxed max-w-2xl">
          매치포스트는 광고주와 인플루언서를 잇는 통신판매중개자이며, 통신판매의 당사자가 아닙니다.
          협업 조건 · 대금 지급 · 콘텐츠 게재의 이행 책임은 각 거래 당사자에게 있습니다.
        </p>
        <p className="text-[10.5px] text-gray-300 mt-3">© 2026 컨텐츠플레이스. All rights reserved.</p>
      </div>
    </footer>
  )
}
