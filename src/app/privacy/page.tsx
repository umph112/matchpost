import Link from 'next/link'
import Footer from '@/components/Footer'

// D6 F2/F4 — 본문은 docs/design/d6 핸드오프의 privacy.dc.html 원문 그대로.
// F4 국외이전 고지는 "7. 개인정보의 국외 이전" 절.
export const metadata = { title: '개인정보처리방침 | 매치포스트' }

const h3 = 'mt-9 text-sm font-extrabold text-[#17171B] pb-2 border-b border-gray-100'
const p = 'mt-2 text-[13.5px] leading-relaxed text-gray-700'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="max-w-3xl mx-auto px-6 py-5">
        <Link href="/intro" className="text-sm text-gray-400 hover:text-gray-600">← 매치포스트</Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pb-16">
        <h1 className="text-[26px] font-extrabold tracking-[-0.035em] text-[#17171B]">매치포스트 개인정보처리방침</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pb-4 border-b-2 border-[#17171B] text-[11.5px] text-gray-500">
          <span>시행일 <strong className="text-gray-700">2026년 9월 1일</strong></span>
          <span>공고일 <strong className="text-gray-700">2026년 8월 10일</strong></span>
          <span>버전 <strong className="text-gray-700">1.0</strong></span>
        </div>

        <p className={p}>
          컨텐츠플레이스(이하 &ldquo;회사&rdquo;)는 매치포스트 서비스를 제공하면서 이용자의 개인정보를 소중히 다룹니다.
          회사는 「개인정보 보호법」 등 관계 법령을 지키며, 이 방침을 통해 어떤 정보를 왜 수집하고 얼마나 보관하는지 알려드립니다.
        </p>

        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-4 py-4 mt-5">
          <p className="text-[12px] font-extrabold text-[#B45309]">한눈에 보는 세 가지</p>
          <ol className="mt-2 pl-4 list-decimal text-[12.5px] leading-relaxed text-gray-600 space-y-1">
            <li>협업 상대의 <strong className="text-gray-800">연락처는 양쪽이 협업을 수락한 뒤에만</strong> 공개됩니다.</li>
            <li>대시에서 주고받은 <strong className="text-gray-800">파일은 7일 뒤 자동 삭제</strong>되고, 그 안의 개인정보는 회사 데이터베이스에 저장되지 않습니다.</li>
            <li>회사는 개인정보를 <strong className="text-gray-800">판매하거나 광고 목적으로 제3자에게 제공하지 않으며</strong>, 데이터는 <strong className="text-gray-800">서울 리전</strong>에 보관합니다.</li>
          </ol>
        </div>

        <h2 className={h3}>1. 수집하는 개인정보</h2>
        <p className={p}>회사는 서비스 제공에 필요한 최소한의 정보만 수집합니다.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-t border-[#17171B] border-b border-gray-100">
                <th className="text-left px-2.5 py-2 font-bold text-gray-700 w-24">구분</th>
                <th className="text-left px-2.5 py-2 font-bold text-gray-700">수집 항목</th>
                <th className="text-left px-2.5 py-2 font-bold text-gray-700 w-16">필수</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['공통 가입', '이메일, 비밀번호(암호화 저장), 별명, 휴대전화번호', '필수'],
                ['소셜 로그인', '제공자가 전달하는 식별자, 이메일, 프로필 이름', '필수'],
                ['광고주 회원', '상호, 대표자명, 사업자등록번호, 사업장 주소, 담당자 이름·연락처, 사업자등록증 사본', '필수'],
                ['인플루언서 회원', '운영 채널 주소 및 소유 인증 정보, 활동 분야, 활동 지역', '필수'],
                ['협업 진행', '협업 조건, 진행 일정, 대화 내용, 게재 콘텐츠 주소', '필수'],
                ['정산 기록', '지급 예정일, 지급 금액, 지급 여부, 세무 자료 수령 여부(3.3% 또는 세금계산서)', '필수'],
                ['배송지', '제품 협찬 시 받는 사람 이름, 주소, 연락처', '선택'],
                ['자동 수집', '접속 IP, 접속 일시, 기기·브라우저 정보, 서비스 이용 기록', '자동'],
              ].map(([k, v, req]) => (
                <tr key={k} className="border-b border-gray-50">
                  <td className="px-2.5 py-2.5 font-bold text-[#17171B] align-top">{k}</td>
                  <td className="px-2.5 py-2.5 text-gray-700 leading-relaxed align-top">{v}</td>
                  <td className="px-2.5 py-2.5 text-gray-700 align-top">{req}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={p}>회사는 주민등록번호를 수집하지 않으며, 사상·신념·건강 등 민감정보를 수집하지 않습니다. 선택 항목에 동의하지 않아도 서비스의 기본 이용에는 제한이 없습니다.</p>

        <h2 className={h3}>2. 이용 목적</h2>
        <ol className="mt-2 pl-5 list-decimal text-[13.5px] leading-relaxed text-gray-700 space-y-1">
          <li>회원 식별과 자격 확인 — 가입, 로그인, 사업자 확인, 채널 소유 인증</li>
          <li>협업 중개 — 캠페인·오픈 노출, 대시 전달, 협업 성립과 딜시트 관리</li>
          <li>정산 기록 관리 — 지급 예정일 안내, 지연 알림, 세무 참고자료 집계</li>
          <li>분쟁 대응 — 신고 접수, 기록 확인, 이용 제한 판단</li>
          <li>서비스 개선과 통계 — 개인을 알아볼 수 없는 형태로 집계</li>
          <li>공지 전달 — 약관·정책 변경, 보안 관련 안내</li>
        </ol>
        <p className={p}>마케팅·광고성 정보 발송은 별도로 동의를 받으며, 동의하지 않아도 서비스를 이용할 수 있습니다. 동의는 언제든 설정에서 철회할 수 있습니다.</p>

        <h2 className={h3}>3. 회원 사이의 정보 공개</h2>
        <p className={p}>매치포스트는 광고주와 인플루언서를 잇는 서비스이므로, 일부 정보는 상대에게 보입니다. <strong>무엇이 언제 보이는지</strong>는 다음과 같습니다.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-t border-[#17171B] border-b border-gray-100">
                <th className="text-left px-2.5 py-2 font-bold text-gray-700 w-28">시점</th>
                <th className="text-left px-2.5 py-2 font-bold text-gray-700">상대에게 보이는 것</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['검색·목록', '별명, 활동 분야·지역, 채널 종류와 규모, 공개한 오픈 일정'],
                ['대시 중', '위 정보 + 대화 내용. 연락처는 보이지 않습니다.'],
                ['협업 성립 후', '담당자 이름, 연락처, 필요한 경우 배송지'],
                ['이용 제한 시', '제재 단계가 「표시」 이상이면 지연율·취소율이 프로필에 공개됩니다'],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-gray-50">
                  <td className="px-2.5 py-2.5 font-bold text-[#17171B] align-top">{k}</td>
                  <td className="px-2.5 py-2.5 text-gray-700 leading-relaxed align-top">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={p}>협업으로 알게 된 상대의 연락처와 주소는 <strong>그 협업의 목적으로만</strong> 사용해야 합니다. 다른 용도로 쓰거나 제3자에게 제공하면 이용약관 위반이며, 「개인정보 보호법」에 따른 책임이 따를 수 있습니다.</p>

        <h2 className={h3}>4. 주고받은 파일의 자동 삭제</h2>
        <p className={p}>① 대시에서 주고받는 파일(원고, 사진, 영상, 가이드 문서 등)은 <strong>전달을 위해서만 임시로 보관</strong>되며, <strong>업로드일로부터 7일이 지나면 자동으로 삭제</strong>됩니다.</p>
        <p className={p}>② 파일에 담긴 개인정보(주소, 연락처, 신분 서류, 계좌 사본 등)는 <strong>회사의 데이터베이스에 별도로 저장되지 않으며</strong>, 파일이 삭제되면 함께 사라집니다. 회사는 파일의 내용을 열람하거나 분석하지 않습니다.</p>
        <p className={p}>③ 삭제된 파일은 복구할 수 없습니다. 서비스는 각 파일 옆에 만료 예정일을 표시하므로, 필요한 파일은 만료 전에 내려받아 보관해 주세요.</p>
        <p className={p}>④ 파일이 삭제되어도 <strong>주고받은 사실(파일명, 시각, 보낸 사람)은 대화 기록으로 남습니다.</strong> 분쟁에서 확인이 필요한 것은 파일의 내용이 아니라 「언제 무엇을 보냈는가」이기 때문입니다.</p>
        <p className={p}>⑤ <strong>사업자등록증 등 자격 확인 서류도 마찬가지로 남기지 않습니다.</strong> 회사는 확인이 끝나는 즉시 서류 원본을 삭제하고, <strong>확인 결과와 사업자등록번호만</strong> 보관합니다. 확인이 지연되는 경우에도 제출일로부터 30일이 지나면 자동으로 삭제되며, 재확인이 필요하면 다시 요청합니다.</p>

        <h2 className={h3}>5. 보유 기간</h2>
        <p className={p}>회사는 수집 목적을 이룬 뒤 지체 없이 개인정보를 파기합니다. 다만 관계 법령이 정한 기간 동안은 보관합니다.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-t border-[#17171B] border-b border-gray-100">
                <th className="text-left px-2.5 py-2 font-bold text-gray-700">항목</th>
                <th className="text-left px-2.5 py-2 font-bold text-gray-700 w-20">기간</th>
                <th className="text-left px-2.5 py-2 font-bold text-gray-700 w-32">근거</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['회원 정보', '탈퇴 시', '지체 없이 파기'],
                ['대시 첨부파일', '7일', '회사 정책(자동 삭제)'],
                ['사업자등록증 등 확인 서류', '확인 즉시', '회사 정책(최대 30일)'],
                ['계약·청약철회 기록', '5년', '전자상거래법'],
                ['대금 결제·공급 기록', '5년', '전자상거래법'],
                ['소비자 불만·분쟁 처리 기록', '3년', '전자상거래법'],
                ['표시·광고 기록', '6개월', '전자상거래법'],
                ['접속 기록(로그)', '3개월', '통신비밀보호법'],
                ['대화 기록·딜시트', '3년', '회사 정책(분쟁 대응)'],
              ].map(([k, v, basis]) => (
                <tr key={k} className="border-b border-gray-50">
                  <td className="px-2.5 py-2.5 text-gray-700">{k}</td>
                  <td className="px-2.5 py-2.5 font-bold text-[#17171B]">{v}</td>
                  <td className="px-2.5 py-2.5 text-gray-500">{basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={p}>1년 이상 서비스를 이용하지 않은 회원의 정보는 별도로 분리 보관하며, 분리 30일 전에 안내합니다.</p>

        <h2 className={h3}>6. 제3자 제공과 처리 위탁</h2>
        <p className={p}>회사는 개인정보를 제3자에게 제공하지 않습니다. 다만 다음의 경우는 예외입니다.</p>
        <ol className="mt-2 pl-5 list-decimal text-[13.5px] leading-relaxed text-gray-700 space-y-1">
          <li>이용자가 미리 동의한 경우</li>
          <li>법령에 따라 수사기관 등이 적법한 절차로 요구한 경우</li>
          <li>분쟁 조정을 위해 <strong>당사자가 요청</strong>하여 외부 분쟁조정기관에 기록 사본을 제공하는 경우</li>
        </ol>
        <p className={p}>원활한 서비스 제공을 위해 다음 업무를 위탁하고 있습니다.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-t border-[#17171B] border-b border-gray-100">
                <th className="text-left px-2.5 py-2 font-bold text-gray-700 w-40">수탁자</th>
                <th className="text-left px-2.5 py-2 font-bold text-gray-700">위탁 업무</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Supabase, Inc.', '서버 운영 및 데이터 보관 (서울 리전)'],
                ['Resend, Inc.', '가입 확인 · 비밀번호 재설정 메일 발송'],
                ['(주)카카오', '알림톡 발송'],
                ['채널 인증 제공자', '인플루언서 채널 소유 확인'],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-gray-50">
                  <td className="px-2.5 py-2.5 font-bold text-[#17171B]">{k}</td>
                  <td className="px-2.5 py-2.5 text-gray-700">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={p}>회사는 위탁 계약 시 개인정보 보호에 관한 사항을 명시하고, 수탁자가 이를 지키는지 관리·감독합니다. 위탁 내용이 바뀌면 이 방침을 통해 알려드립니다.</p>

        <h2 className={h3}>7. 개인정보의 국외 이전</h2>
        <p className={p}>
          회사는 서비스 운영을 위해 해외에 본사를 둔 사업자에게 개인정보 처리를 위탁하고 있습니다.
          「개인정보 보호법」 제28조의8에 따라 그 내용을 아래와 같이 공개합니다. 협업 관련 알림은 카카오 알림톡으로 발송하며,
          이메일은 가입 확인과 비밀번호 재설정에만 사용합니다.
        </p>
        <div className="bg-[#F6FAFF] border border-[#DBEAFE] rounded-xl px-4 py-3.5 mt-3">
          <p className="text-[12.5px] leading-relaxed text-[#1E3A8A]">
            <strong className="font-extrabold">데이터는 한국에 저장됩니다.</strong> 회사는 Supabase의 <strong>서울 리전(ap-northeast-2)</strong>을
            사용하므로 이용자의 개인정보는 국내 데이터센터에 보관됩니다. 다만 서비스 운영·장애 대응 과정에서 해외 사업자가 접근할 수 있어,
            이를 국외 이전으로 보아 고지합니다.
          </p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-t border-[#17171B] border-b border-gray-100">
                <th className="text-left px-2.5 py-2 font-bold text-gray-700 w-24">항목</th>
                <th className="text-left px-2.5 py-2 font-bold text-gray-700">Supabase, Inc.</th>
                <th className="text-left px-2.5 py-2 font-bold text-gray-700">Resend, Inc.</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-50">
                <td className="px-2.5 py-2.5 font-bold text-[#17171B]">국가</td>
                <td className="px-2.5 py-2.5 text-gray-700">미국 (저장 위치: 대한민국 서울)</td>
                <td className="px-2.5 py-2.5 text-gray-700">미국</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-2.5 py-2.5 font-bold text-[#17171B]">이전 항목</td>
                <td className="px-2.5 py-2.5 text-gray-700">서비스 이용에 필요한 회원 정보 및 협업 기록 전반</td>
                <td className="px-2.5 py-2.5 text-gray-700">이메일 주소</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-2.5 py-2.5 font-bold text-[#17171B]">시점·방법</td>
                <td className="px-2.5 py-2.5 text-gray-700">서비스 이용 시 암호화된 통신으로 수시 전송</td>
                <td className="px-2.5 py-2.5 text-gray-700">가입 · 비밀번호 재설정 요청 시</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-2.5 py-2.5 font-bold text-[#17171B]">목적</td>
                <td className="px-2.5 py-2.5 text-gray-700">서버 운영, 데이터 보관, 계정 인증</td>
                <td className="px-2.5 py-2.5 text-gray-700">가입 확인 · 비밀번호 재설정 메일 발송</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-2.5 py-2.5 font-bold text-[#17171B]">보유 기간</td>
                <td className="px-2.5 py-2.5 text-gray-700">위 5항의 보유 기간과 같음</td>
                <td className="px-2.5 py-2.5 text-gray-700">발송 후 30일(발송 이력)</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-2.5 py-2.5 font-bold text-[#17171B]">보호 조치</td>
                <td className="px-2.5 py-2.5 text-gray-700" colSpan={2}>개인정보 처리 위탁 계약(DPA) 체결, 전송 구간 암호화, 접근 권한 최소화 및 접근 기록 보관</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={p}><strong>이전을 거부할 수 있습니다.</strong> privacy@matchpost.kr 로 요청하시면 국외 이전을 거부할 수 있습니다. 다만 위 항목은 서비스 제공에 반드시 필요하므로, 거부하시면 회원 가입과 서비스 이용이 제한될 수 있습니다.</p>

        <h2 className={h3}>8. 이용자의 권리</h2>
        <p className={p}>이용자는 언제든 자신의 개인정보를 열람·정정·삭제·처리정지 요청할 수 있습니다. 대부분은 <strong>설정 화면에서 직접</strong> 처리할 수 있고, 그 밖의 요청은 아래 연락처로 접수하면 10일 이내에 처리합니다.</p>
        <p className={p}>다만 법령이 보관을 요구하는 기록, 그리고 <strong>진행 중인 협업의 상대에게 필요한 정보</strong>는 즉시 삭제되지 않을 수 있습니다. 이 경우 사유를 안내합니다.</p>
        <p className={p}>만 14세 미만 아동은 서비스에 가입할 수 없습니다.</p>

        <h2 className={h3}>9. 쿠키</h2>
        <p className={p}>회사는 로그인 유지와 이용 통계를 위해 쿠키를 사용합니다. 브라우저 설정에서 쿠키 저장을 거부할 수 있으나, 이 경우 로그인이 필요한 기능을 이용하기 어려울 수 있습니다.</p>

        <h2 className={h3}>10. 안전성 확보 조치</h2>
        <ol className="mt-2 pl-5 list-decimal text-[13.5px] leading-relaxed text-gray-700 space-y-1">
          <li>비밀번호는 복호화할 수 없는 방식으로 암호화하여 저장합니다.</li>
          <li>연락처 등 민감한 항목은 암호화하여 보관하고, 전송 구간은 SSL로 보호합니다.</li>
          <li>개인정보에 접근할 수 있는 담당자를 최소한으로 지정하고, 접근 기록을 남깁니다.</li>
          <li>대시 첨부파일은 7일 뒤, 자격 확인 서류는 확인 즉시 삭제하여 보관 자체를 줄입니다.</li>
          <li>데이터는 서울 리전에 보관하며, 해외 사업자의 접근은 위탁 계약과 접근 기록으로 통제합니다.</li>
        </ol>

        <h2 className={h3}>11. 개인정보 보호책임자</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse">
            <tbody>
              {[
                ['책임자', '김정현'],
                ['이메일', 'privacy@matchpost.kr'],
                ['전화', '02-336-1930 (평일 10:00–18:00)'],
                ['주소', '서울특별시 마포구 양화로 45, 8층'],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-gray-50">
                  <td className="px-2.5 py-2.5 font-bold text-gray-700 bg-gray-50 w-28">{k}</td>
                  <td className="px-2.5 py-2.5 text-gray-700">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={p}>개인정보 침해로 도움이 필요하면 아래 기관에 문의할 수 있습니다. 개인정보침해신고센터(privacy.kisa.or.kr, 국번없이 118), 개인정보 분쟁조정위원회(kopico.go.kr, 1833-6972), 대검찰청 사이버수사과(1301), 경찰청 사이버수사국(182).</p>

        <div className="mt-9 pt-4 border-t-2 border-[#17171B]">
          <p className="text-[13px] font-extrabold text-[#17171B]">부칙</p>
          <p className="mt-2 text-[13px] leading-relaxed text-gray-500">
            이 방침은 2026년 9월 1일부터 시행합니다. 내용이 변경되면 시행 7일 전(이용자에게 불리한 변경은 30일 전)부터 서비스 초기 화면에 공지합니다.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
