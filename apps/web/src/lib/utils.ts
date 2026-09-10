export { cn } from 'cn';

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
