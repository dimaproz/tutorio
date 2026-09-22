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

/** Upper-cases the first letter, for dates that open a line ("чт" → "Чт"). */
export function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
