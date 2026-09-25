// Generated from the handoff's empty schedule card (S08 board 01, state 06).
// Geometry is kept verbatim; the colours are the feature card's foreground
// and the sky tint it was drawn with, so the art follows the theme.

const WEEK_ROWS = [66, 88, 110];
const WEEK_COLUMNS = [92, 116, 140, 164, 188];
/** The lit weekday slots, by row: Tuesday and Thursday, then Tuesday. */
const LIT = [[116, 164], [116, 164], [116]];

/**
 * A faint calendar page with rings and two lit weekday slots, in the top-right
 * corner of the empty schedule card. Decorative.
 */
export function ScheduleEmptyArt({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="220"
      height="150"
      viewBox="0 0 250 170"
      fill="none"
      className={className}
    >
      <rect x="74" y="22" width="152" height="132" rx="22" className="fill-feature-foreground/7" />
      <rect x="74" y="22" width="152" height="34" rx="17" className="fill-feature-foreground/10" />
      <rect x="104" y="12" width="8" height="22" rx="4" className="fill-feature-foreground/35" />
      <rect x="188" y="12" width="8" height="22" rx="4" className="fill-feature-foreground/35" />
      {WEEK_ROWS.map((y, row) =>
        WEEK_COLUMNS.map((x) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width="16"
            height="14"
            rx="5"
            className={LIT[row]?.includes(x) ? 'fill-tint-sky' : 'fill-feature-foreground/10'}
          />
        )),
      )}
      <path d="M40 40l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" className="fill-tint-sky/90" />
      <circle cx="236" cy="74" r="4" className="fill-tint-sky/80" />
      <circle cx="58" cy="84" r="3" className="fill-feature-foreground/30" />
    </svg>
  );
}
