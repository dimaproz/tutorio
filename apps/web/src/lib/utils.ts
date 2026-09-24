import { createCn } from 'cn/config';

/**
 * Class merging that knows the product radius scale (`rounded-pill`,
 * `rounded-field`, …) from globals.css. Without it a caller's `rounded-field`
 * would not replace a primitive's `rounded-pill`: both stay and the one later
 * in the stylesheet wins.
 */
export const cn = createCn({
  extend: {
    theme: {
      radius: ['pill', 'logo', 'control', 'item', 'field', 'tile', 'row', 'block', 'card', 'hero'],
    },
  },
});

/** First letters of up to two name parts, for avatar fallbacks. */
export function nameInitials(fullName: string): string {
  return (
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

/** Upper-cases the first letter, for dates that open a line ("чт" → "Чт"). */
export function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
