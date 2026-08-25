// The CourtVision mark: the wordmark with a basketball net woven into the
// shape of the V. `scale` controls overall size — use a smaller scale in
// tight spaces (the sidebar) and a larger one wherever there's room to
// let it breathe (the login screen).
export default function Logo({ scale = 1, className = '' }) {
  const netWidth = 56 * scale
  const netHeight = netWidth * (63 / 90)
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
        viewBox="0 0 90 63"
        className="mt-1"
        role="img"
        aria-label="CourtVision"
      >
        <line x1="10" y1="8" x2="80" y2="8" stroke="#E31B23" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="10" y1="8" x2="33.8" y2="58" stroke="#E31B23" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="27.5" y1="8" x2="39.4" y2="58" stroke="#E31B23" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="45" y1="8" x2="45" y2="58" stroke="#E31B23" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="62.5" y1="8" x2="50.6" y2="58" stroke="#E31B23" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="80" y1="8" x2="56.2" y2="58" stroke="#E31B23" strokeWidth="2.5" strokeLinecap="round" />
        <path
          d="M19.52 23.5 L32.26 32.5 L45 23.5 L57.74 32.5 L70.48 23.5"
          fill="none"
          stroke="#E31B23"
          strokeWidth="2"
          strokeOpacity="0.85"
        />
        <path
          d="M27.85 42.5 L36.42 48.5 L45 42.5 L53.58 48.5 L62.15 42.5"
          fill="none"
          stroke="#E31B23"
          strokeWidth="2"
          strokeOpacity="0.85"
        />
        <ellipse cx="45" cy="58" rx="11.2" ry="2.2" fill="none" stroke="#E31B23" strokeWidth="2" />
      </svg>
    </div>
  )
}
