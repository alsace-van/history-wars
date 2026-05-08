// v1.0 (08/05/2026) — Scene 2 : charge de cavalerie au galop dans la plaine
export function SceneCavalryCharge() {
  return (
    <svg
      viewBox="0 0 340 480"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label="Charge de cavalerie en silhouette"
    >
      <defs>
        <linearGradient id="cav-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c1424" />
          <stop offset="60%" stopColor="#0d1729" />
          <stop offset="100%" stopColor="#06101e" />
        </linearGradient>
        <linearGradient id="cav-dust" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a2540" stopOpacity="0" />
          <stop offset="100%" stopColor="#1a2540" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="cav-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a1224" stopOpacity="0" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="1" />
        </linearGradient>
      </defs>

      <rect width="340" height="480" fill="url(#cav-sky)" />

      <circle cx="170" cy="200" r="65" fill="#1a2540" opacity="0.5" />
      <circle cx="170" cy="200" r="42" fill="#243355" opacity="0.4" />

      <path
        d="M 0,310 Q 80,300 170,308 T 340,305 L 340,480 L 0,480 Z"
        fill="#0c1a2e"
        opacity="0.85"
      />

      <rect x="0" y="270" width="340" height="120" fill="url(#cav-dust)" opacity="0.7" />

      {[
        { x: 60, y: 380, scale: 0.85 },
        { x: 130, y: 360, scale: 1 },
        { x: 220, y: 375, scale: 0.95 },
        { x: 290, y: 395, scale: 0.7 }
      ].map((cav, i) => {
        const s = cav.scale
        const x = cav.x
        const y = cav.y
        return (
          <g key={i} fill="#020817" opacity="0.95">
            <ellipse cx={x} cy={y} rx={22 * s} ry={9 * s} />
            <path
              d={`M ${x + 18 * s},${y - 4 * s} L ${x + 32 * s},${y - 14 * s} L ${x + 36 * s},${y - 9 * s} L ${x + 22 * s},${y + 1 * s} Z`}
            />
            <line
              x1={x - 12 * s}
              y1={y + 7 * s}
              x2={x - 18 * s}
              y2={y + 18 * s}
              stroke="#020817"
              strokeWidth={2 * s}
            />
            <line
              x1={x - 4 * s}
              y1={y + 7 * s}
              x2={x - 1 * s}
              y2={y + 20 * s}
              stroke="#020817"
              strokeWidth={2 * s}
            />
            <line
              x1={x + 6 * s}
              y1={y + 7 * s}
              x2={x + 13 * s}
              y2={y + 20 * s}
              stroke="#020817"
              strokeWidth={2 * s}
            />
            <line
              x1={x + 14 * s}
              y1={y + 7 * s}
              x2={x + 20 * s}
              y2={y + 17 * s}
              stroke="#020817"
              strokeWidth={2 * s}
            />
            <line
              x1={x - 22 * s}
              y1={y - 1 * s}
              x2={x - 32 * s}
              y2={y + 4 * s}
              stroke="#020817"
              strokeWidth={2 * s}
            />
            <ellipse cx={x + 4 * s} cy={y - 14 * s} rx={3.5 * s} ry={7 * s} />
            <circle cx={x + 4 * s} cy={y - 23 * s} r={3.5 * s} />
            <line
              x1={x + 8 * s}
              y1={y - 18 * s}
              x2={x + 30 * s}
              y2={y - 32 * s}
              stroke="#020817"
              strokeWidth={1.5 * s}
            />
          </g>
        )
      })}

      <rect x="0" y="380" width="340" height="100" fill="url(#cav-fade)" />
    </svg>
  )
}
