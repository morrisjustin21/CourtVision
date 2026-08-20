// The CourtVision mark: the wordmark with a basketball net woven into the
// shape of the V. `scale` controls overall size — use a smaller scale in
// tight spaces (the sidebar) and a larger one wherever there's room to
// let it breathe (the login screen).
export default function Logo({ scale = 1, className = '' }) {
  const netWidth = 56 * scale
  const netHeight = netWidth * (73 / 90)
  const fontSize = 28 * scale

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <span
        className="font-display font-bold tracking-tight text-chalk whitespace-nowrap"
        style={{ fontSize: `${fontSize}px` }}
      >
        COURT<span className="text-red">VISION</span>
      </span>
      <svg
        width={netWidth}
        height={netHeight}
        viewBox="0 0 90 73"
        className="mt-1"
        role="img"
        aria-label="CourtVision"
      >
        <line x1="10" y1="8" x2="80" y2="8" stroke="#E31B23" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="10" y1="12" x2="45" y2="65" stroke="#E31B23" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="27.5" y1="12" x2="45" y2="65" stroke="#E31B23" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="45" y1="12" x2="45" y2="65" stroke="#E31B23" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="62.5" y1="12" x2="45" y2="65" stroke="#E31B23" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="80" y1="12" x2="45" y2="65" stroke="#E31B23" strokeWidth="2.5" strokeLinecap="round" />
        <path
          d="M22.25 30.55 L33.625 25.55 L45 30.55 L56.375 25.55 L67.75 30.55"
          fill="none"
          stroke="#E31B23"
          strokeWidth="2"
          strokeOpacity="0.85"
        />
        <path
          d="M34.5 49.1 L39.75 46.1 L45 49.1 L50.25 46.1 L55.5 49.1"
          fill="none"
          stroke="#E31B23"
          strokeWidth="2"
          strokeOpacity="0.85"
        />
      </svg>
    </div>
  )
}
