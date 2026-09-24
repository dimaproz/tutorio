import { cn } from '@/lib/utils';

const DOTS = Array.from({ length: 36 }, (_, index) => ({
  cx: 190 + (index % 6) * 16,
  cy: 24 + Math.floor(index / 6) * 16,
}));

/**
 * The Studio's decorative rings and dot grid, drawn in `currentColor`. The
 * caller places it (absolute, clipped by its block) and sets the colour and
 * the opacity: the payment card and the lesson windows' indigo band use it.
 */
export function RingsArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 160"
      aria-hidden="true"
      className={cn('pointer-events-none absolute h-40 w-75', className)}
    >
      <circle cx="250" cy="110" r="70" fill="none" stroke="currentColor" strokeWidth="18" />
      <circle cx="250" cy="110" r="30" fill="currentColor" />
      <g fill="currentColor">
        {DOTS.map((dot) => (
          <circle key={`${dot.cx}-${dot.cy}`} cx={dot.cx} cy={dot.cy} r="3" />
        ))}
      </g>
    </svg>
  );
}
