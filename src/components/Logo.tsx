// D7 부록 2절 — 로고 컴포넌트 단일화. 마크(SVG) + Archivo 900 워드마크 + 원형 점.
// 점은 문자 "·"가 아니라 실제 원(span)이어야 세로 중앙이 맞는다.
const DOT_SPEC: Record<number, { dot: number; gap: number; mark: number }> = {
  14: { dot: 4, gap: 3, mark: 17 },
  19: { dot: 5, gap: 4, mark: 23 },
  20: { dot: 5.5, gap: 4, mark: 24 },
  41: { dot: 11, gap: 8, mark: 50 },
}

export default function Logo({
  size = 19,
  dark = false,
  beta = false,
  markOnly = false,
  className = '',
}: {
  size?: 14 | 19 | 20 | 41
  dark?: boolean
  beta?: boolean
  /** 마크(사각형)만. 모바일 상단바처럼 폭이 아까운 자리에 쓴다 — 워드마크는 이름값을 못 한다 */
  markOnly?: boolean
  className?: string
}) {
  const { dot, gap, mark } = DOT_SPEC[size]
  const squareFill = dark ? '#fff' : '#17171B'
  const lineOpacity = dark ? 0.18 : 0.2
  const lineColor = dark ? '#17171B' : '#fff'
  const textColor = dark ? '#fff' : '#17171B'

  return (
    <span className={`inline-flex items-center gap-[1px] leading-none ${className}`} style={{ lineHeight: 1 }}>
      <svg viewBox="0 0 64 64" width={mark} height={mark} aria-hidden>
        <rect width="64" height="64" rx="16.6" fill={squareFill} />
        <rect y="37.1" width="64" height="1.9" fill={lineColor} opacity={lineOpacity} />
        <rect x="24.3" width="1.9" height="64" fill={lineColor} opacity={lineOpacity} />
        <circle cx="25.3" cy="38.1" r="8.3" fill="#F59E0B" />
      </svg>
      {!markOnly && (
      <span
        className="inline-flex items-center"
        style={{
          fontFamily: 'Archivo, ui-sans-serif, system-ui, sans-serif',
          fontWeight: 900,
          letterSpacing: '0.05em',
          fontSize: size,
          color: textColor,
          lineHeight: 1,
          gap: 1,
        }}
      >
        MATCH
        <span
          aria-hidden
          style={{
            width: dot,
            height: dot,
            borderRadius: '50%',
            background: '#F59E0B',
            margin: `0 ${gap}px`,
            flexShrink: 0,
            display: 'inline-block',
          }}
        />
        POST
      </span>
      )}
      {beta && (
        <span
          className="ml-[3px] rounded-[5px] px-2 py-1"
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: '0.04em',
            background: 'rgba(255,255,255,0.13)',
            color: 'rgba(255,255,255,0.72)',
          }}
        >
          BETA
        </span>
      )}
    </span>
  )
}
