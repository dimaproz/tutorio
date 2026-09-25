// The small illustrations of a direction's pass stub (S06 handoff, board
// «ProfileLearning»). Geometry is kept verbatim from the handoff; each art is
// drawn in `currentColor`, so the stub's tone colours it through a text token
// and the art follows the theme. The coins carry no currency glyph: the
// amount beside them names the currency.

/** A package: a ticket with a stub line, over a second one. */
export function TicketArt({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="76"
      height="60"
      viewBox="0 0 190 150"
      fill="none"
      className={className}
    >
      <g transform="rotate(-10 95 75)">
        <rect x="30" y="22" width="130" height="78" rx="14" fill="currentColor" opacity=".18" />
      </g>
      <g transform="rotate(4 95 75)">
        <rect x="24" y="36" width="140" height="84" rx="16" fill="currentColor" opacity=".32" />
        <rect x="24" y="36" width="140" height="84" rx="16" stroke="currentColor" strokeWidth="3" />
        <line
          x1="118"
          y1="42"
          x2="118"
          y2="114"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="6 6"
        />
        <circle cx="141" cy="78" r="12" stroke="currentColor" strokeWidth="3" />
        <rect x="40" y="58" width="58" height="9" rx="4.5" fill="currentColor" />
        <rect x="40" y="76" width="40" height="9" rx="4.5" fill="currentColor" opacity=".6" />
        <rect x="40" y="94" width="50" height="9" rx="4.5" fill="currentColor" opacity=".4" />
      </g>
    </svg>
  );
}

/** Money owed: a torn receipt with an exclamation mark. */
export function ReceiptArt({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="76"
      height="71"
      viewBox="0 0 170 160"
      fill="none"
      className={className}
    >
      <path
        d="M42 14h86v128l-10.75-8-10.75 8-10.75-8-10.75 8-10.75-8-10.75 8-10.75-8L42 142z"
        fill="currentColor"
        fillOpacity=".18"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect x="58" y="36" width="54" height="8" rx="4" fill="currentColor" />
      <rect x="58" y="54" width="38" height="8" rx="4" fill="currentColor" opacity=".55" />
      <rect x="58" y="72" width="46" height="8" rx="4" fill="currentColor" opacity=".55" />
      <circle cx="124" cy="112" r="26" fill="currentColor" />
      <rect x="121" y="96" width="6" height="20" rx="3" className="fill-card" />
      <circle cx="124" cy="124" r="3.6" className="fill-card" />
    </svg>
  );
}

/** Money paid ahead: a stack of coins and one more beside it. */
export function CoinsArt({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="76"
      height="63"
      viewBox="0 0 180 150"
      fill="none"
      className={className}
    >
      {[118, 102, 86, 70].map((cy, index) => (
        <ellipse
          key={cy}
          cx="70"
          cy={cy}
          rx="44"
          ry="14"
          fill="currentColor"
          fillOpacity={0.25 + index * 0.05}
          stroke="currentColor"
          strokeWidth="3"
        />
      ))}
      <circle
        cx="128"
        cy="62"
        r="34"
        fill="currentColor"
        fillOpacity=".25"
        stroke="currentColor"
        strokeWidth="3"
      />
      <circle cx="128" cy="62" r="20" stroke="currentColor" strokeWidth="3" strokeDasharray="5 5" />
    </svg>
  );
}

/** A pause: two bars in a rounded tile. */
export function PausedArt({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="70"
      height="60"
      viewBox="0 0 70 60"
      fill="none"
      className={className}
    >
      <rect
        x="6"
        y="6"
        width="58"
        height="48"
        rx="14"
        fill="currentColor"
        fillOpacity=".14"
        stroke="currentColor"
        strokeWidth="3"
      />
      <rect x="24" y="18" width="7" height="24" rx="3.5" fill="currentColor" />
      <rect x="39" y="18" width="7" height="24" rx="3.5" fill="currentColor" />
    </svg>
  );
}
