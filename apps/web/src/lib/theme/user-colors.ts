// Teacher colors are user-provided scheduling data, never primitive theme tokens.
export const DEFAULT_TEACHER_COLOR = '#465FFF';

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
