import { ISLAND_OUTLINE, HOUSE_POSITIONS, LIGHTHOUSE } from "@fishing/shared";
import { PATHS } from "./island-geometry";
export function IslandPlan() {
  const contour =
    "M" + ISLAND_OUTLINE.map((p) => `${p.x},${p.z}`).join(" L") + " Z";
  return (
    <svg
      viewBox="-55 -78 110 108"
      role="img"
      aria-label="Bản đồ đúng bố cục đảo: hải đăng tây bắc, làng ở giữa, hồ phía đông, bãi biển và bến chữ L phía nam"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <defs>
        <linearGradient id="sea" x2="1" y2="1">
          <stop stopColor="#258dad" />
          <stop offset="1" stopColor="#50cdd5" />
        </linearGradient>
        <linearGradient id="grass" x2="0" y2="1">
          <stop stopColor="#64a551" />
          <stop offset="1" stopColor="#acd273" />
        </linearGradient>
        <pattern id="waves" width="10" height="8" patternUnits="userSpaceOnUse">
          <path
            d="M0 4 Q2 2 4 4 T8 4"
            fill="none"
            stroke="#b1efeb"
            strokeWidth=".3"
            opacity=".6"
          />
        </pattern>
      </defs>
      <rect x="-55" y="-78" width="110" height="108" fill="url(#sea)" />
      <rect x="-55" y="-78" width="110" height="108" fill="url(#waves)" />
      <path d={contour} fill="#88ddd3" stroke="#91ebe1" strokeWidth="8" />
      <path d={contour} fill="#efd69c" stroke="#ffe8ba" strokeWidth="1" />
      <path
        d={contour}
        fill="url(#grass)"
        transform="translate(-.5,-2) scale(.96,.95)"
      />
      <ellipse cx="9" cy="-57" rx="19" ry="8" fill="#91b76b" />
      <path
        d="M-1 -56 L6 -64 L12 -57 L17 -61 L23 -54"
        stroke="#acb4a1"
        strokeWidth="5"
        fill="none"
        strokeLinejoin="round"
      />
      {PATHS.map((path, i) => (
        <polyline
          key={i}
          points={path.map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke="#eedcba"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      <circle cx="-10" cy="-32" r="6.8" fill="#e8d3b2" />
      <circle
        cx="-10"
        cy="-32"
        r="1.5"
        fill="#83c5cb"
        stroke="#d9c6a8"
        strokeWidth=".7"
      />
      <ellipse
        cx="20"
        cy="-33"
        rx="10"
        ry="7.2"
        fill="#6ed1cc"
        stroke="#ead7ad"
        strokeWidth="1.4"
      />
      <path
        d="M11 -38.5 Q20 -40 29 -38.5"
        fill="none"
        stroke="#bb8756"
        strokeWidth="2"
      />
      <path
        d="M-14 -17 V2 H7"
        fill="none"
        stroke="#9b724b"
        strokeWidth="4.6"
        strokeLinejoin="round"
      />
      <path
        d="M-14 -17 V2 H7"
        fill="none"
        stroke="#d1a26b"
        strokeWidth="3.8"
        strokeLinejoin="round"
      />
      {HOUSE_POSITIONS.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.z})`}>
          <rect x="-2" y="-1.5" width="4" height="3.5" rx=".3" fill="#fff0cd" />
          <path
            d="M-2.5 -1 L0 -3.5 L2.5 -1 Z"
            fill={i % 2 ? "#557eaa" : "#ce8067"}
          />
        </g>
      ))}
      <g transform={`translate(${LIGHTHOUSE.x} ${LIGHTHOUSE.z})`}>
        <circle r="4" fill="#d6d4ab" />
        <rect x="-1" y="-4" width="2" height="5" fill="#fff4dd" />
        <path d="M-1 -2 H1" stroke="#dc7d72" strokeWidth="1.2" />
        <path d="M-1.7 -4 L0 -6 L1.7 -4 Z" fill="#cc716d" />
      </g>
      <text
        x="20"
        y="-32"
        fontSize="2.7"
        textAnchor="middle"
        fill="#1e6571"
        fontWeight="800"
      >
        Hồ nước ngọt
      </text>
      <text
        x="-31"
        y="-57"
        fontSize="2.6"
        textAnchor="middle"
        fill="#244f56"
        fontWeight="800"
      >
        Hải đăng
      </text>
      <text x="0" y="10" fontSize="2.5" textAnchor="middle" fill="#f3fff5">
        Bến câu biển
      </text>
      <path d="M44 -64 L46 -71 L48 -64 L46 -66 Z" fill="#fff4d8" />
      <text x="46" y="-73" fontSize="3" fill="#fff4d8" textAnchor="middle">
        BẮC
      </text>
    </svg>
  );
}
