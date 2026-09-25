import type { CSSProperties } from 'react';

/**
 * The two notches of a ticket's tear line, cut out of the card: a mask of
 * two radial gradients, so the scrim or the page shows through them. `y`
 * cuts the left and right edges at that height (a vertical ticket); `x` the
 * top and bottom edges at that offset (the horizontal one).
 */
export function notchMask(at: { y: number } | { x: number }, radius: number): CSSProperties {
  const hole = (position: string) =>
    `radial-gradient(circle at ${position}, transparent ${radius}px, black ${radius + 0.5}px)`;
  const [first, second] =
    'y' in at ? [`0 ${at.y}px`, `100% ${at.y}px`] : [`${at.x}px 0`, `${at.x}px 100%`];
  return {
    maskImage: `${hole(first)}, ${hole(second)}`,
    maskComposite: 'intersect',
    WebkitMaskComposite: 'source-in',
  };
}
