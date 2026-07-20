'use server';

import { cookies } from 'next/headers';
import { LOCALE_COOKIE, localeSchema } from './locale';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setLocale(input: unknown): Promise<void> {
  const locale = localeSchema.parse(input);
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
  });
}
