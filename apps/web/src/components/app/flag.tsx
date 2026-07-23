import { cn } from '@/lib/utils';

// ISO-ish flag codes we ship an SVG for under /public/images/flags. Kept small
// and explicit — add a file plus a union member to support a new one.
export type FlagCode = 'ua' | 'eu' | 'pl' | 'us' | 'gb';

// A small circular flag. The source SVGs are 3:2 (or wider); object-cover fills
// the circle the way the TailAdmin language menu shows them. Decorative by
// default — pass a label only when the flag is the sole meaning of a control.
export function Flag({
  code,
  label,
  className,
}: {
  code: FlagCode;
  label?: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static SVG, no Image optimisation needed
    <img
      src={`/images/flags/${code}.svg`}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      className={cn('inline-block size-5 shrink-0 rounded-full object-cover', className)}
    />
  );
}
