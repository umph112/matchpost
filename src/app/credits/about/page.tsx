import Link from 'next/link'

export const dynamic = 'force-dynamic'

const FAQ = [
  { q: '검색이나 프로필 열람도 크레딧이 드나요?', a: '아니요. 검색과 열람은 영원히 무료예요. 크레딧은 상대의 달력이나 받은 편지함에 자리를 차지하는 행동(오픈 등록·캠페인 개설·제안 보내기)에만 쓰여요.' },
  { q: '크레딧은 현금으로 환불되나요?', a: '무상으로 지급된 크레딧(웰컴·활동 보상)은 환불되지 않아요. 유상 충전은 아직 준비 중이에요.' },
  { q: '크레딧이 사라지기도 하나요?', a: '날짜가 지나서 사라지지 않아요. 대신 오래 방문하지 않으면 조금씩 줄어들어요 — 다시 들르면 그만이에요.' },
  { q: '잔액이 부족하면 어떻게 되나요?', a: '해당 행동(오픈 등록 등)을 진행할 수 없다는 안내가 떠요. 활동을 이어가거나 방문하면 자연스럽게 채워져요.' },
  { q: '지급받은 크레딧은 언제 확인할 수 있나요?', a: '크레딧 내역 페이지에서 바로 확인할 수 있어요. 거래는 취소·수정되지 않고 정정이 필요하면 반대 거래로 새로 남아요.' },
]

export default function CreditsAboutPage() {
  return (
    <div className="max-w-[920px] mx-auto px-4 py-8">
      {/* 검정 히어로 */}
      <div className="bg-[#17171B] text-white rounded-2xl p-8 mb-6 text-center">
        <p className="text-xl font-extrabold tracking-[-0.02em]">활동하면 쌓이고, 쌓아둘수록 유리해집니다</p>
        <p className="text-sm text-white/60 mt-2">매치포스트 크레딧(C)은 협업 활동을 시작하고 이어가는 데 쓰여요</p>
      </div>

      <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-4 py-3 mb-6 text-center">
        <p className="text-[13px] font-bold text-[#92400E]">검색과 열람은 무료입니다</p>
        <p className="text-[12px] text-[#B45309] mt-0.5">크레딧은 상대에게 먼저 다가갈 때만 쓰여요.</p>
      </div>

      {/* 3개념 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        {[
          { t: '1C = 1원', d: '표기는 항상 C 단위예요. 실제 결제 금액과 감을 맞췄어요.' },
          { t: '날짜가 아니라 방문 기준', d: '시간이 지나서 사라지지 않아요. 안 들르면 줄고, 들르면 늘어요.' },
          { t: '성과에 대한 보상', d: '협업 완료·후기 작성 같은 실제 성과에 크레딧을 드려요.' },
        ].map((c) => (
          <div key={c.t} className="bg-white border border-[#EAEAEE] rounded-[14px] p-4">
            <p className="text-[13.5px] font-bold text-[#17171B]">{c.t}</p>
            <p className="text-[12px] text-[#7C7C88] mt-1.5 leading-relaxed">{c.d}</p>
          </div>
        ))}
      </div>

      {/* 이렇게 쌓입니다 / 이럴 때 씁니다 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white border border-[#EAEAEE] rounded-[14px] p-5">
          <p className="text-[13.5px] font-bold text-[#15803D] mb-2.5">이렇게 쌓입니다</p>
          <ul className="flex flex-col gap-1.5 text-[12.5px] text-[#5C5C68]">
            <li>· 가입 축하 웰컴 크레딧</li>
            <li>· 프로필/채널 연동 완료</li>
            <li>· 첫 오픈 등록·첫 캠페인 개설</li>
            <li>· 오픈·캠페인을 열 때마다 응원 크레딧</li>
            <li>· 협업이 성사되면 축하 크레딧</li>
            <li>· 협업 완료(정산 완료 시점)</li>
            <li>· 후기·평점 작성</li>
            <li>· 꾸준히 들르기, 오랜만에 돌아오기</li>
          </ul>
        </div>
        <div className="bg-white border border-[#EAEAEE] rounded-[14px] p-5">
          <p className="text-[13.5px] font-bold text-[#B45309] mb-2.5">이럴 때 씁니다</p>
          <ul className="flex flex-col gap-1.5 text-[12.5px] text-[#5C5C68]">
            <li>· 인플루언서 — 오픈 일정 등록 (1건, 날짜 수 무관)</li>
            <li>· 광고주 — 캠페인 개설</li>
            <li>· 광고주 — 제안(대시) 보내기 (베타 기간 무료)</li>
          </ul>
        </div>
      </div>

      {/* 지금 쌓아두면 좋은 이유 */}
      <div className="mb-8">
        <p className="text-[15px] font-bold text-[#17171B] mb-3">지금 쌓아두면 좋은 이유</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            '초기에는 활동 보상을 넉넉히 드려요 — 실질적으로 무료로 쓸 수 있는 구간이에요.',
            '나중에 참여가 늘면 보상은 점차 줄어들어요. 지금 활동할수록 유리해요.',
            '방문 습관을 들여두면 크레딧이 자연스럽게 늘어나요.',
          ].map((t, i) => (
            <div key={i} className="bg-[#FAFAFB] rounded-xl p-4 text-[12px] text-[#5C5C68] leading-relaxed">
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="mb-8">
        <p className="text-[15px] font-bold text-[#17171B] mb-3">자주 묻는 질문</p>
        <div className="flex flex-col gap-2">
          {FAQ.map((f) => (
            <details key={f.q} className="bg-white border border-[#EAEAEE] rounded-xl px-4 py-3 group">
              <summary className="text-[13px] font-semibold text-[#17171B] cursor-pointer list-none">{f.q}</summary>
              <p className="text-[12px] text-[#7C7C88] mt-2 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      <Link href="/credits" className="block text-center text-sm font-semibold text-[#B45309] hover:underline">
        내 크레딧 내역 보기 →
      </Link>
    </div>
  )
}
