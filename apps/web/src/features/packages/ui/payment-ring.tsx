const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * How much of a package is paid (S07 components «Payment ring»): a 64px
 * ring, stroke 8, in warning on a faint warning track, with the percentage
 * in the centre — the same ring as the ticket's «Сплачено».
 */
export function PaymentRing({ percent }: { percent: number }) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const filled = (CIRCUMFERENCE * clamped) / 100;
  return (
    <span className="relative flex size-16 shrink-0 items-center justify-center">
      <svg aria-hidden="true" viewBox="0 0 64 64" className="absolute inset-0 size-16">
        <circle
          cx="32"
          cy="32"
          r={RADIUS}
          fill="none"
          strokeWidth="8"
          className="stroke-warning/22"
        />
        <circle
          cx="32"
          cy="32"
          r={RADIUS}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled.toFixed(1)} ${CIRCUMFERENCE.toFixed(1)}`}
          transform="rotate(-90 32 32)"
          className="stroke-warning"
        />
      </svg>
      <span className="relative text-sm font-bold text-tint-warning-foreground tabular-nums">
        {`${clamped}%`}
      </span>
    </span>
  );
}
