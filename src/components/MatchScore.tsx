// 매치 스코어 배지 — 인플루언서 카드/프로필에 공통 사용
// score: null = 신규(리뷰 없음), 0~100 = 점수

type Size = 'sm' | 'md' | 'lg'

function scoreColor(score: number): { bg: string; text: string; bar: string } {
  if (score >= 90) return { bg: '#FEF3C7', text: '#B45309', bar: '#F59E0B' }   // 골드
  if (score >= 80) return { bg: '#FEF3C7', text: '#D97706', bar: '#F59E0B' }   // 앰버
  if (score >= 60) return { bg: '#DBEAFE', text: '#1D4ED8', bar: '#3B82F6' }   // 파랑
  return { bg: '#F1F1F4', text: '#7C7C88', bar: '#C4C4CE' }                    // 회색
}

export default function MatchScore({
  score,
  reviewCount = 0,
  size = 'sm',
}: {
  score: number | null
  reviewCount?: number
  size?: Size
}) {
  if (score === null) {
    return (
      <span
        className={`inline-flex items-center font-bold rounded-full border border-[#EAEAEE] text-[#9A9AA5] bg-white ${
          size === 'lg' ? 'text-sm px-3 py-1' : 'text-[10.5px] px-2 py-0.5'
        }`}
      >
        신규
      </span>
    )
  }

  const { bg, text, bar } = scoreColor(score)

  if (size === 'lg') {
    return (
      <div className="flex flex-col items-center gap-1">
        <div
          className="flex items-baseline gap-0.5 font-extrabold rounded-2xl px-4 py-2"
          style={{ background: bg, color: text }}
        >
          <span className="text-3xl tracking-tight">{score}</span>
          <span className="text-sm font-semibold">점</span>
        </div>
        <div className="w-24 h-[5px] rounded-full bg-[#F1F1F4] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${score}%`, background: bar }} />
        </div>
        {reviewCount > 0 && (
          <span className="text-[11px] text-[#9A9AA5]">리뷰 {reviewCount}개</span>
        )}
        <span className="text-[11px] font-semibold" style={{ color: text }}>매치 스코어</span>
      </div>
    )
  }

  return (
    <span
      className="inline-flex items-baseline gap-[2px] font-bold rounded-full text-[10.5px] px-2 py-0.5"
      style={{ background: bg, color: text }}
    >
      <span>{score}</span>
      <span className="text-[9px] font-semibold opacity-70">M</span>
    </span>
  )
}
