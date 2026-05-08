// v1.0 (08/05/2026) — Illustration SVG champ de bataille pour split-screen auth
// Placeholder : remplaceable par une image reelle (gravure historique) plus tard
export function AuthBackground() {
  return (
    <svg
      viewBox="0 0 340 480"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label="Illustration de troupes en marche sur un champ de bataille stylise"
    >
      <defs>
        <pattern id="hex-pattern" x="0" y="0" width="28" height="32" patternUnits="userSpaceOnUse">
          <path
            d="M 14,0 L 28,8 L 28,24 L 14,32 L 0,24 L 0,8 Z"
            fill="none"
            stroke="#1e3a5f"
            strokeWidth="0.4"
            opacity="0.5"
          />
        </pattern>
        <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a1224" />
          <stop offset="40%" stopColor="#0f1c33" />
          <stop offset="100%" stopColor="#06101e" />
        </linearGradient>
        <linearGradient id="fade-bottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a1224" stopOpacity="0" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="1" />
        </linearGradient>
      </defs>

      <rect width="340" height="480" fill="url(#sky-grad)" />
      <rect width="340" height="480" fill="url(#hex-pattern)" />

      <circle cx="265" cy="95" r="38" fill="#1e293b" opacity="0.55" />
      <circle cx="265" cy="95" r="26" fill="#334155" opacity="0.4" />

      <path
        d="M 0,300 Q 60,285 120,295 T 240,288 T 340,295 L 340,480 L 0,480 Z"
        fill="#0c1a2e"
        opacity="0.85"
      />
      <path
        d="M 0,340 Q 80,328 160,338 T 340,332 L 340,480 L 0,480 Z"
        fill="#0a1525"
        opacity="0.9"
      />

      <g fill="#020817" opacity="0.95">
        {[
          [35, 320, 22], [55, 318, 24], [78, 316, 26], [100, 320, 22],
          [123, 318, 24], [148, 316, 26], [172, 320, 22], [198, 318, 24],
          [223, 316, 26], [248, 320, 22], [275, 318, 24], [300, 320, 22]
        ].map(([x, y, h], i) => (
          <g key={i}>
            <rect x={x} y={y} width="3" height={h} />
            <circle cx={x + 1.5} cy={y - 4} r="2.5" />
            <line x1={x + 3} y1={y - 2} x2={x + 11} y2={y - 8} stroke="#020817" strokeWidth="1.5" />
          </g>
        ))}
      </g>

      <g fill="#020817" opacity="0.7">
        {[
          [60, 380], [155, 395], [245, 385]
        ].map(([cx, cy], i) => (
          <g key={i}>
            <ellipse cx={cx} cy={cy} rx="9" ry="5" />
            <rect x={cx - 2} y={cy - 8} width="4" height="10" />
            <circle cx={cx} cy={cy - 12} r="3" />
            <line x1={cx + 3} y1={cy - 8} x2={cx + 11} y2={cy - 15} stroke="#020817" strokeWidth="1.5" />
          </g>
        ))}
      </g>

      <rect x="0" y="380" width="340" height="100" fill="url(#fade-bottom)" />
    </svg>
  )
}
