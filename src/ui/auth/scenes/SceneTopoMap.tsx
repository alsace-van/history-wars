// v1.0 (08/05/2026) — Scene 4 : carte topographique style etat-major, courbes de niveau
export function SceneTopoMap() {
  return (
    <svg
      viewBox="0 0 340 480"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label="Carte topographique militaire ancienne"
    >
      <defs>
        <linearGradient id="map-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a160d" />
          <stop offset="100%" stopColor="#0f0c07" />
        </linearGradient>
        <pattern id="map-hex" x="0" y="0" width="36" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M 18,0 L 36,10 L 36,30 L 18,40 L 0,30 L 0,10 Z"
            fill="none"
            stroke="#2a2218"
            strokeWidth="0.3"
            opacity="0.5"
          />
        </pattern>
        <linearGradient id="map-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a160d" stopOpacity="0" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="1" />
        </linearGradient>
      </defs>

      <rect width="340" height="480" fill="url(#map-bg)" />
      <rect width="340" height="480" fill="url(#map-hex)" />

      <g fill="none" stroke="#4a3a1c" strokeWidth="0.6" opacity="0.85">
        <ellipse cx="180" cy="240" rx="140" ry="90" />
        <ellipse cx="180" cy="240" rx="115" ry="72" />
        <ellipse cx="180" cy="240" rx="92" ry="58" />
        <ellipse cx="180" cy="240" rx="68" ry="42" />
        <ellipse cx="180" cy="240" rx="45" ry="28" />
        <ellipse cx="180" cy="240" rx="22" ry="14" />
      </g>
      <text x="180" y="244" fill="#6a5028" fontSize="9" textAnchor="middle" fontStyle="italic" opacity="0.8">
        Mont
      </text>

      <g fill="none" stroke="#4a3a1c" strokeWidth="0.5" opacity="0.75">
        <ellipse cx="70" cy="110" rx="44" ry="26" />
        <ellipse cx="70" cy="110" rx="28" ry="16" />
        <ellipse cx="70" cy="110" rx="14" ry="8" />
      </g>

      <g fill="none" stroke="#4a3a1c" strokeWidth="0.5" opacity="0.75">
        <ellipse cx="280" cy="380" rx="38" ry="24" />
        <ellipse cx="280" cy="380" rx="22" ry="14" />
      </g>

      <path
        d="M 0,170 Q 60,160 120,170 Q 180,180 240,165 T 340,170"
        stroke="#3a4a5a"
        strokeWidth="2.2"
        fill="none"
        opacity="0.6"
      />
      <text x="190" y="156" fill="#5a6a7a" fontSize="9" fontStyle="italic" textAnchor="middle" opacity="0.7">
        riviere
      </text>

      <path
        d="M 30,440 L 90,310 L 180,260 L 260,210 L 320,90"
        stroke="#5a4520"
        strokeWidth="1"
        fill="none"
        strokeDasharray="3,2"
        opacity="0.7"
      />

      <g fill="#7a5e2c" stroke="#3a2e18" strokeWidth="0.5">
        <rect x="86" y="306" width="6" height="6" />
        <rect x="176" y="256" width="7" height="7" />
        <rect x="256" y="206" width="6" height="6" />
        <rect x="316" y="86" width="7" height="7" />
      </g>

      <g fill="#6a5028" fontSize="8" fontStyle="italic" opacity="0.8">
        <text x="98" y="312">Beauval</text>
        <text x="190" y="262">Sainte-Marie</text>
        <text x="270" y="212">Le Bourg</text>
      </g>

      <g fill="none" stroke="#3a2e18" strokeWidth="1" opacity="0.7">
        <rect x="6" y="6" width="328" height="468" />
        <rect x="10" y="10" width="320" height="460" />
      </g>

      <text x="20" y="465" fill="#5a4520" fontSize="8" fontStyle="italic" opacity="0.6">
        Echelle 1:50.000
      </text>

      <rect x="0" y="380" width="340" height="100" fill="url(#map-fade)" />
    </svg>
  )
}
