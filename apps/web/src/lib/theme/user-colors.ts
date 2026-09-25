// Teacher colors are user-provided scheduling data, never primitive theme tokens.
export const DEFAULT_TEACHER_COLOR = '#465FFF';

/**
 * The ten calendar colours a teacher can take (S09 form), in the order the
 * field shows them. Teacher colours are user data, never theme tokens.
 */
export const TEACHER_COLORS = [
  '#4B4FE0',
  '#D6336C',
  '#12A150',
  '#F08C00',
  '#1C7ED6',
  '#AE3EC9',
  '#0CA678',
  '#E8590C',
  '#5C7CFA',
  '#868E96',
] as const;

const LIGHT_INK = '#FFFFFF';
const DARK_INK = '#1B1F3B';

function luminance(hex: string): number | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1]!, 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 0xff) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

/**
 * The ink that reads best on a user's colour (initials on a teacher's
 * colour): white or the dark ink, whichever has the higher contrast.
 */
export function inkOn(color: string): string {
  const lum = luminance(color);
  if (lum === null) return LIGHT_INK;
  const onWhite = 1.05 / (lum + 0.05);
  const onDark = (lum + 0.05) / ((luminance(DARK_INK) ?? 0) + 0.05);
  return onWhite >= onDark ? LIGHT_INK : DARK_INK;
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** A hex colour mixed towards black by `ratio` (0 = unchanged, 1 = black). */
function darken(hex: string, ratio: number): string {
  const value = parseInt(hex.replace('#', ''), 16);
  const channel = (shift: number) =>
    Math.round(((value >> shift) & 0xff) * (1 - ratio))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(16)}${channel(8)}${channel(0)}`.toUpperCase();
}

/**
 * A solid fill in a user's colour that text can sit on (WCAG AA, 4.5:1): the
 * colour itself when white or the dark ink already reads on it, otherwise
 * the colour darkened step by step until white does. The ink comes with it.
 */
export function readableFill(color: string): { fill: string; ink: string } {
  if (luminance(color) === null) return { fill: color, ink: LIGHT_INK };
  const white = luminance(LIGHT_INK)!;
  const dark = luminance(DARK_INK)!;
  for (let step = 0; step <= 10; step += 1) {
    const fill = step === 0 ? color.toUpperCase() : darken(color, step * 0.05);
    const lum = luminance(fill)!;
    if (contrast(lum, white) >= 4.5) return { fill, ink: LIGHT_INK };
    if (step === 0 && contrast(lum, dark) >= 4.5) return { fill, ink: DARK_INK };
  }
  return { fill: darken(color, 0.5), ink: LIGHT_INK };
}
