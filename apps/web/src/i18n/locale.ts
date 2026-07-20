import { DEFAULT_LOCALE, LOCALES, localeSchema, type Locale } from '@tutorio/validation';

export { DEFAULT_LOCALE, LOCALES, localeSchema };
export type { Locale };

export const LOCALE_COOKIE = 'NEXT_LOCALE';

// Locale priority: NEXT_LOCALE cookie → supported browser language → uk.
// Pure function so the fallback chain is unit-testable.
export function resolveLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  const fromCookie = localeSchema.safeParse(cookieValue);
  if (fromCookie.success) {
    return fromCookie.data;
  }

  if (acceptLanguage) {
    // "uk-UA,uk;q=0.9,en-US;q=0.8" → first entry whose base language we support.
    for (const part of acceptLanguage.split(',')) {
      const tag = part.split(';')[0]?.trim().toLowerCase();
      const base = tag?.split('-')[0];
      const parsed = localeSchema.safeParse(base);
      if (parsed.success) {
        return parsed.data;
      }
    }
  }

  return DEFAULT_LOCALE;
}
