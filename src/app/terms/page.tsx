import Link from 'next/link'
import Footer from '@/components/Footer'

// D6 F2 — 본문은 docs/design/d6 핸드오프의 terms.dc.html 원문 그대로(문구 손대지 않음).
export const metadata = { title: '이용약관 | 매치포스트' }

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="max-w-3xl mx-auto px-6 py-5">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← 매치포스트</Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pb-16">
        <h1 className="text-[26px] font-extrabold tracking-[-0.035em] text-[#17171B]">매치포스트 이용약관</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pb-4 border-b-2 border-[#17171B] text-[11.5px] text-gray-500">
          <span>시행일 <strong className="text-gray-700">2026년 9월 1일</strong></span>
          <span>공고일 <strong className="text-gray-700">2026년 8월 10일</strong></span>
          <span>버전 <strong className="text-gray-700">1.0</strong></span>
        </div>

        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-4 py-4 mt-5">
          <p className="text-[12px] font-extrabold text-[#B45309]">먼저 알려드립니다</p>
          <p className="text-[13px] leading-relaxed text-gray-600 mt-2">
            매치포스트는 광고주와 인플루언서가 서로를 찾고 협업을 관리하도록 돕는 <strong className="text-gray-800">통신판매중개 서비스</strong>입니다.
            협업 계약은 광고주와 인플루언서 사이에 직접 성립하며, 회사는 그 계약의 당사자가 아닙니다.
            대금 지급 · 콘텐츠 게재 · 조건 이행의 책임은 각 당사자에게 있습니다.
          </p>
        </div>

        <h2 className="mt-9 text-sm font-extrabold text-[#17171B] pb-2 border-b border-gray-100">제1장 총칙</h2>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제1조 (목적)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">
          이 약관은 컨텐츠플레이스(이하 &ldquo;회사&rdquo;)가 제공하는 매치포스트 서비스(이하 &ldquo;서비스&rdquo;)의 이용 조건과 절차,
          회사와 회원의 권리·의무 및 책임사항을 정하는 것을 목적으로 합니다.
        </p>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제2조 (용어의 정의)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">이 약관에서 사용하는 용어의 뜻은 다음과 같습니다.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-t border-[#17171B] border-b border-gray-100">
                <th className="text-left px-2.5 py-2 font-bold text-gray-700 w-28">용어</th>
                <th className="text-left px-2.5 py-2 font-bold text-gray-700">뜻</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['회원', '이 약관에 동의하고 서비스 이용 자격을 얻은 자. 광고주 회원과 인플루언서 회원으로 나뉩니다.'],
                ['캠페인', '광고주가 협업 조건 · 진행 과정 · 기본 일정을 정해 등록한 협업 제안 단위.'],
                ['오픈', '인플루언서가 협업 가능한 날짜와 조건을 공개한 것.'],
                ['대시', '상대에게 처음 말을 걸어 협업 대화를 시작하는 행위 및 그 대화 공간.'],
                ['협업', '양쪽이 조건을 수락하여 성립한 광고주와 인플루언서 사이의 계약.'],
                ['딜시트', '협업 성립 후 진행 단계 · 기한 · 페이 · 산출물을 기록하는 관리 화면. 참여자별로 관리됩니다.'],
                ['크레딧', '서비스 내 기능 이용에 사용하는 단위. 현금이 아니며 환급되지 않습니다.'],
                ['정산', '광고주가 인플루언서에게 협업 대가를 지급하는 것. 회사는 지급을 대행하지 않고 기록만 제공합니다.'],
              ].map(([term, def]) => (
                <tr key={term} className="border-b border-gray-50">
                  <td className="px-2.5 py-2.5 font-bold text-[#17171B] align-top">{term}</td>
                  <td className="px-2.5 py-2.5 leading-relaxed text-gray-700 align-top">{def}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제3조 (회사의 지위)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">① 회사는 「전자상거래 등에서의 소비자보호에 관한 법률」상 <strong>통신판매중개자</strong>로서, 회원 사이의 협업을 알선하고 그 과정을 기록·관리하는 도구를 제공합니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">② 회사는 협업 계약의 당사자가 아니며, 회원이 등록한 정보와 회원 사이에 이루어진 거래에 대하여 책임을 지지 않습니다. 회사는 이 사실을 서비스 초기 화면과 협업 성립 화면에 표시합니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">③ 다만 회사가 직접 제공하는 기능의 하자, 회사의 고의 또는 중대한 과실로 발생한 손해에 대해서는 책임을 집니다.</p>

        <h2 className="mt-9 text-sm font-extrabold text-[#17171B] pb-2 border-b border-gray-100">제2장 회원</h2>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제4조 (가입과 인증)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">① 회원 가입은 이 약관에 동의하고 회사가 정한 절차를 마친 때 성립합니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">② 광고주 회원은 사업자등록증 등 사업자 확인 서류를 제출해야 하며, 회사의 확인이 끝난 뒤 캠페인 등록 기능을 이용할 수 있습니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">③ 인플루언서 회원은 본인이 운영하는 채널의 소유를 인증해야 하며, 인증된 채널만 오픈 및 협업에 사용할 수 있습니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">④ 회사는 다음 각 호에 해당하면 가입을 거부하거나 사후에 자격을 상실시킬 수 있습니다.</p>
        <ol className="mt-2 pl-5 list-decimal text-[13.5px] leading-relaxed text-gray-700 space-y-1">
          <li>타인의 명의 또는 허위 정보를 사용한 경우</li>
          <li>과거 이 약관 위반으로 이용 계약이 해지된 이력이 있는 경우</li>
          <li>채널의 팔로워 수 · 조회수 등을 부정한 방법으로 만든 사실이 확인된 경우</li>
        </ol>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제5조 (팀 계정과 담당)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">① 광고주 회원은 소속 구성원을 팀원으로 초대할 수 있습니다. 사업자 정보 수정 · 팀 초대 · 결제는 대표만 할 수 있고, 캠페인 등록 · 딜시트 · 정산 기록은 팀원이 할 수 있습니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">② 각 대화와 협업에는 담당 팀원 한 명이 지정되며, <strong>담당이 아닌 구성원은 해당 협업에 관여할 수 없습니다.</strong> 다만 대표는 예외로 하되, 이 경우 상대에게 대리 발송 사실이 표시됩니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">③ 팀 멤버의 행위는 해당 광고주 회원의 행위로 봅니다.</p>

        <h2 className="mt-9 text-sm font-extrabold text-[#17171B] pb-2 border-b border-gray-100">제3장 협업</h2>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제6조 (협업의 성립)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">① 협업은 대시에서 제안된 조건(진행 날짜 · 페이 · 산출물 · 채널)을 <strong>양쪽이 모두 수락한 때</strong> 성립합니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">② 진행 날짜는 값으로 제안되어야 하며, 상대가 수락하기 전까지는 제안에 불과합니다. 자기가 보낸 제안을 자기가 확정할 수 없습니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">③ 협업이 성립하면 딜시트가 생성되고, 그때 비로소 <strong>양쪽의 연락처가 서로에게 공개</strong>됩니다. 성립 전에는 어떤 경우에도 연락처가 제공되지 않습니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">④ 상대가 수락하기 전까지는 자신의 수락을 철회할 수 있습니다.</p>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제7조 (진행 과정과 일정)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">① 캠페인 등록 시 광고주가 정한 진행 과정과 기본 일정이 참여자 전원에게 적용됩니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">② 개별 참여자의 일정은 대시에서 양쪽이 합의하여 변경할 수 있으며, 변경된 값은 그 참여자의 딜시트에만 적용되고 「변경」으로 표시됩니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">③ 합의된 일정 변경은 <strong>이미 이루어진 수락을 무효로 하지 않습니다.</strong> 다만 페이 · 산출물 등 일정 외의 조건 변경은 별도의 합의가 필요합니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">④ 확정 인원이 생긴 뒤에는 캠페인의 진행 과정 구성을 변경할 수 없습니다.</p>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제8조 (협업의 취소)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">① 취소는 한쪽의 요청과 <strong>상대의 수락</strong>으로 확정됩니다. 요청만으로는 취소되지 않습니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">② 회사는 취소 자체를 제재하지 않습니다. 다만 취소 <strong>요청 횟수</strong>는 누적하여 기록하며, 상대가 수락한 취소도 횟수에 포함됩니다.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-t border-[#17171B] border-b border-gray-100">
                <th className="text-left px-2.5 py-2 font-bold text-gray-700 w-28">누적 요청</th>
                <th className="text-left px-2.5 py-2 font-bold text-gray-700">조치</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['1–2회', '기록만 남습니다.'],
                ['3회', '본인에게 안내가 발송됩니다.'],
                ['4회 이상', '프로필에 취소율이 표시됩니다.'],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-gray-50">
                  <td className="px-2.5 py-2.5 font-bold text-[#17171B]">{k}</td>
                  <td className="px-2.5 py-2.5 text-gray-700">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-gray-700">③ 상대가 취소 요청에 3일간 응답하지 않으면 취소가 확정되고, 요청자에게 횟수가 부과됩니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">④ 콘텐츠가 게재된 뒤에는 취소할 수 없으며, 정산으로만 종료됩니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">⑤ 협업 성립 시 지급된 크레딧은 취소하더라도 회수하지 않습니다.</p>

        <h2 className="mt-9 text-sm font-extrabold text-[#17171B] pb-2 border-b border-gray-100">제4장 정산</h2>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제9조 (대금의 지급)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">① <strong>협업 대가는 광고주가 인플루언서에게 직접 지급</strong>합니다. 회사는 대금을 수령·보관·지급하지 않으며, 결제대금예치(에스크로) 서비스를 제공하지 않습니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">② 서비스의 정산 기능은 지급 예정일 · 지급 여부 · 세무 자료 수령 여부를 <strong>기록하는 도구</strong>이며, 지급 사실을 회사가 보증하지 않습니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">③ 지급액의 원천징수 · 세금계산서 발행 등 세무 처리는 각 당사자의 책임입니다.</p>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제10조 (지급 지연)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">① 지급 예정일이 지나도 지급이 기록되지 않으면, 회사는 광고주에게 <strong>매일 1회 지연 알림</strong>을 발송합니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">② 지연 일수와 알림 누적 횟수는 기록되며, 제13조의 이용 제한 판단 자료로 사용됩니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">③ 양쪽이 대화에서 지급 예정일 변경에 합의한 경우 지연으로 보지 않으며 알림이 중단됩니다.</p>

        <h2 className="mt-9 text-sm font-extrabold text-[#17171B] pb-2 border-b border-gray-100">제5장 크레딧</h2>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제11조 (크레딧)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">① 크레딧은 서비스 내 기능 이용에 사용하는 단위로, <strong>현금이나 유가증권이 아니며 현금으로 환급되지 않습니다.</strong></p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">② 회사는 회원의 활동에 대해 크레딧을 지급할 수 있고, 특정 기능 이용 시 크레딧을 차감할 수 있습니다. 항목별 지급·차감 금액은 서비스 내 「크레딧 안내」에 공개합니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">③ <strong>베타 기간 중에는 차감을 청구하지 않습니다.</strong> 이 경우에도 원래 금액을 함께 표시하여 향후 적용될 기준을 알립니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">④ 회사는 크레딧 정책을 변경할 수 있습니다. 다만 변경 내용을 <strong>시행 30일 전에 공지</strong>하고, 유예 기간이 지난 뒤 시행합니다. 변경은 <strong>시행일 이후 발생하는 건에만</strong> 적용되며, 이미 진행 중인 협업에는 소급하지 않습니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">⑤ 무상으로 지급된 크레딧은 지급일로부터 1년간 유효하며, 부정한 방법으로 취득한 크레딧은 회수됩니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">⑥ 회원 탈퇴 시 잔여 크레딧은 소멸하며 승계·양도할 수 없습니다.</p>

        <h2 className="mt-9 text-sm font-extrabold text-[#17171B] pb-2 border-b border-gray-100">제6장 신고와 이용 제한</h2>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제12조 (신고와 회사의 역할)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">① 회원은 상대의 약관 위반이나 협업 불이행을 서비스 내 신고 기능으로 접수할 수 있습니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">② <strong>회사는 회원 사이의 분쟁을 판정하거나 중재하지 않습니다.</strong> 회사가 하는 일은 다음과 같습니다.</p>
        <ol className="mt-2 pl-5 list-decimal text-[13.5px] leading-relaxed text-gray-700 space-y-1">
          <li>양쪽의 기록(대화 · 딜시트 · 정산 기록)을 확인하는 것</li>
          <li>사실관계를 양쪽에 같은 내용으로 안내하는 것</li>
          <li>반복되는 위반에 대해 서비스 이용을 제한하는 것</li>
          <li>당사자가 요청하면 기록 사본을 외부 분쟁조정기관에 제공하는 것</li>
        </ol>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">③ 신고 접수 사실은 해당 대화에 기록되어 상대에게도 전달되며, 처리 결과는 알림함으로 통지됩니다. 추가 문의는 고객센터로 접수합니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">④ 피신고자는 신고를 종결할 수 없습니다. 종결 권한은 신고자와 회사에 있습니다.</p>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제13조 (이용 제한)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">① 회사는 다음 각 호에 해당하는 회원의 서비스 이용을 단계적으로 제한할 수 있습니다.</p>
        <ol className="mt-2 pl-5 list-decimal text-[13.5px] leading-relaxed text-gray-700 space-y-1">
          <li>대금 지급을 반복하여 지연하거나 지급하지 않은 경우</li>
          <li>합의 없이 협업을 반복하여 취소한 경우</li>
          <li>허위 정보를 등록하거나 채널 지표를 조작한 경우</li>
          <li>상대에게 욕설 · 성적 언동 · 부당한 요구를 한 경우</li>
          <li>서비스를 통해 알게 된 상대의 연락처를 협업 목적 외로 사용한 경우</li>
        </ol>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-t border-[#17171B] border-b border-gray-100">
                <th className="text-left px-2.5 py-2 font-bold text-gray-700 w-20">단계</th>
                <th className="text-left px-2.5 py-2 font-bold text-gray-700">내용</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['안내', '본인에게만 통지합니다. 외부에 표시되지 않습니다.'],
                ['표시', '프로필에 지연율 · 취소율이 공개됩니다.'],
                ['제한', '새 캠페인 등록 또는 새 대시 발송이 제한됩니다. 진행 중인 협업은 계속됩니다.'],
                ['정지', '로그인 외 모든 기능이 정지됩니다.'],
                ['해지', '이용 계약을 해지합니다. 재가입이 제한됩니다.'],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-gray-50">
                  <td className="px-2.5 py-2.5 font-bold text-[#17171B]">{k}</td>
                  <td className="px-2.5 py-2.5 text-gray-700">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-gray-700">② 회사는 제한 전에 사유와 근거를 통지하고 소명 기회를 부여합니다. 다만 긴급한 피해 확산이 우려되는 경우 먼저 조치한 뒤 지체 없이 통지합니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">③ 제한 사유가 해소되면 회원은 해제를 요청할 수 있습니다.</p>

        <h2 className="mt-9 text-sm font-extrabold text-[#17171B] pb-2 border-b border-gray-100">제7장 회원의 의무</h2>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제14조 (금지 행위)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">회원은 다음 행위를 해서는 안 됩니다.</p>
        <ol className="mt-2 pl-5 list-decimal text-[13.5px] leading-relaxed text-gray-700 space-y-1">
          <li>서비스를 통해 알게 된 상대의 연락처 · 주소 · 채널 정보를 협업 목적 외로 사용하거나 제3자에게 제공하는 행위</li>
          <li>협업 조건을 서비스 밖에서 변경하고 서비스 내 기록을 사실과 다르게 남기는 행위</li>
          <li>「표시·광고의 공정화에 관한 법률」 및 공정거래위원회 「추천·보증 등에 관한 표시·광고 심사지침」을 위반하여 <strong>경제적 대가를 표시하지 않고</strong> 콘텐츠를 게재하는 행위</li>
          <li>타인의 저작물을 무단으로 사용하거나, 협업 산출물에 대한 권리를 허위로 주장하는 행위</li>
          <li>자동화된 수단으로 서비스에 접근하거나 시스템에 부하를 주는 행위</li>
        </ol>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제15조 (콘텐츠의 권리)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">① 협업으로 제작된 콘텐츠의 저작권은 별도 합의가 없으면 <strong>인플루언서에게 귀속</strong>합니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">② 광고주는 협업에서 합의한 범위 내에서 콘텐츠를 사용할 수 있으며, 2차 활용 · 광고 소재 사용 · 사용 기간은 대시에서 명시적으로 합의해야 합니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">③ 게재된 콘텐츠의 유지 기간은 별도 합의가 없으면 게재일로부터 6개월로 합니다.</p>

        <h2 className="mt-9 text-sm font-extrabold text-[#17171B] pb-2 border-b border-gray-100">제8장 기타</h2>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제16조 (개인정보와 기록의 보존)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">① 회사의 개인정보 처리에 관한 사항은 별도의 <Link href="/privacy" className="text-[#B45309] underline">개인정보처리방침</Link>에 따릅니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">② 회사는 관계 법령에 따라 계약 또는 청약철회 등에 관한 기록을 5년, 대금 결제 및 재화 등의 공급에 관한 기록을 5년, 소비자 불만 또는 분쟁 처리에 관한 기록을 3년간 보존합니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">③ 대화 기록과 딜시트는 협업 종료 후 3년간 보존하며, 분쟁 발생 시 당사자의 요청에 따라 사본을 제공할 수 있습니다.</p>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제17조 (주고받은 파일의 자동 삭제)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">① 회원이 대시에서 주고받는 파일(원고 · 사진 · 영상 · 가이드 문서 등, 이하 &ldquo;첨부파일&rdquo;)은 <strong>전달을 위해서만 임시로 보관</strong>되며, 회사는 이를 서비스 운영 목적으로 보관하거나 이용하지 않습니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">② 첨부파일은 <strong>업로드일로부터 7일이 지나면 자동으로 삭제</strong>되며, 삭제된 파일은 복구할 수 없습니다. 회원은 만료 전에 필요한 파일을 내려받아 보관해야 하며, 서비스는 만료 예정일을 파일 옆에 표시합니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">③ 첨부파일에 담긴 개인정보(주소 · 연락처 · 신분 서류 · 계좌 사본 등)는 <strong>회사의 데이터베이스에 별도로 저장되지 않으며</strong>, 파일이 삭제되면 함께 사라집니다. 회사는 첨부파일의 내용을 열람하거나 분석하지 않습니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">④ 첨부파일이 삭제되어도 <strong>파일을 주고받은 사실(파일명 · 시각 · 보낸 사람)은 대화 기록으로 남습니다.</strong> 분쟁 시 확인이 필요한 것은 파일의 내용이 아니라 「언제 무엇을 보냈는가」이기 때문입니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">⑤ 사업자등록증 등 회사가 자격 확인을 위해 요청한 서류도 남기지 않습니다. 회사는 확인이 끝나는 즉시 서류 원본을 삭제하고 <strong>확인 결과와 사업자등록번호만</strong> 보관하며, 확인이 지연되더라도 제출일로부터 30일이 지나면 자동 삭제합니다.</p>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제18조 (서비스의 변경과 중단)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">① 회사는 서비스의 내용을 변경할 수 있으며, 중요한 변경은 시행 7일 전에 공지합니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">② 시스템 점검 · 설비 장애 · 천재지변 등 부득이한 사유가 있으면 서비스 제공을 일시 중단할 수 있습니다.</p>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제19조 (약관의 변경)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">① 회사는 관계 법령을 위반하지 않는 범위에서 이 약관을 변경할 수 있습니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">② 변경 약관은 시행일 7일 전(회원에게 불리하거나 중대한 변경은 <strong>30일 전</strong>)부터 서비스 초기 화면에 공지합니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">③ 회원이 시행일까지 거부 의사를 밝히지 않으면 동의한 것으로 봅니다. 동의하지 않는 회원은 이용 계약을 해지할 수 있습니다.</p>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제20조 (책임의 제한)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">① 회사는 회원이 등록한 정보의 정확성, 회원 사이의 협업 이행, 대금 지급, 콘텐츠의 성과에 대하여 책임을 지지 않습니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">② 다만 회사가 제공하는 기능의 하자나 회사의 고의 또는 중대한 과실로 회원에게 손해가 발생한 경우에는 그러하지 않습니다.</p>

        <h3 className="mt-5 text-sm font-extrabold text-[#17171B]">제21조 (분쟁의 해결)</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">① 회원 사이의 분쟁은 당사자가 협의하여 해결하는 것을 원칙으로 합니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">② 협의로 해결되지 않으면 전자문서·전자거래분쟁조정위원회(ecmc.or.kr), 콘텐츠분쟁조정위원회, 한국소비자원 등 외부 분쟁조정기관의 조정을 이용할 수 있습니다. 회사는 당사자의 요청에 따라 서비스에 남은 기록의 사본을 제공합니다.</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-700">③ 회사와 회원 사이의 분쟁에 관한 소송은 민사소송법에 따른 관할 법원에 제기합니다.</p>

        <div className="mt-9 pt-4 border-t-2 border-[#17171B]">
          <p className="text-[13px] font-extrabold text-[#17171B]">부칙</p>
          <p className="mt-2 text-[13px] leading-relaxed text-gray-500">이 약관은 2026년 9월 1일부터 시행합니다.</p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
