// v1.0 (08/05/2026) — Scene 3 : champ de bataille vu de haut, formations carrees + drapeaux
export function SceneBattleFormation() {
  return (
    <svg
      viewBox="0 0 340 480"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label="Formations de bataille vues du dessus"
    >
      <defs>
        <linearGradient id="form-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a1628" />
          <stop offset="100%" stopColor="#040d1a" />
        </linearGradient>
        <pattern id="form-hex" x="0" y="0" width="32" height="36" patternUnits="userSpaceOnUse">
          <path
            d="M 16,0 L 32,9 L 32,27 L 16,36 L 0,27 L 0,9 Z"
            fill="none"
            stroke="#1e3a5f"
            strokeWidth="0.4"
            opacity="0.45"
          />
        </pattern>
        <linearGradient id="form-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a1628" stopOpacity="0" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="1" />
        </linearGradient>
      </defs>

      <rect width="340" height="480" fill="url(#form-bg)" />
      <rect width="340" height="480" fill="url(#form-hex)" />

      <path
        d="M 0,250 Q 100,235 200,245 T 340,240 L 340,260 Q 240,265 140,255 T 0,265 Z"
        fill="#1a2540"
        opacity="0.4"
      />

      {[
        [40, 80], [90, 80], [40, 110], [90, 110]
      ].map(([x, y], i) => (
        <g key={`r-${i}`}>
          <rect x={x} y={y} width="38" height="22" fill="#3d1010" stroke="#A32D2D" strokeWidth="1.2" opacity="0.85" />
          {[0, 1, 2, 3, 4, 5].map((c) =>
            [0, 1].map((r) => (
              <circle
                key={`r-${i}-${c}-${r}`}
                cx={x + 4 + c * 6}
                cy={y + 6 + r * 10}
                r="1.3"
                fill="#E24B4A"
                opacity="0.9"
              />
            ))
          )}
        </g>
      ))}

      <line x1="20" y1="78" x2="20" y2="55" stroke="#A32D2D" strokeWidth="1.5" />
      <path d="M 21,53 L 38,57 L 38,68 L 21,64 Z" fill="#A32D2D" opacity="0.9" />

      {[
        [200, 350], [250, 350], [200, 380], [250, 380]
      ].map(([x, y], i) => (
        <g key={`b-${i}`}>
          <rect x={x} y={y} width="38" height="22" fill="#0c2746" stroke="#185fa5" strokeWidth="1.2" opacity="0.85" />
          {[0, 1, 2, 3, 4, 5].map((c) =>
            [0, 1].map((r) => (
              <circle
                key={`b-${i}-${c}-${r}`}
                cx={x + 4 + c * 6}
                cy={y + 6 + r * 10}
                r="1.3"
                fill="#378ADD"
                opacity="0.9"
              />
            ))
          )}
        </g>
      ))}

      <line x1="298" y1="378" x2="298" y2="355" stroke="#185fa5" strokeWidth="1.5" />
      <path d="M 299,353 L 316,357 L 316,368 L 299,364 Z" fill="#185fa5" opacity="0.9" />

      <g stroke="#5a4520" strokeWidth="0.8" strokeDasharray="3,2" fill="none" opacity="0.5">
        <path d="M 0,200 Q 80,210 160,220 T 340,230" />
      </g>

      <rect x="0" y="380" width="340" height="100" fill="url(#form-fade)" />
    </svg>
  )
}
