import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_TIME_ZONE } from '@/lib/datetime';
import { LOCALE_COOKIE, resolveLocale } from './locale';

export default getRequestConfig(async () => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale(
    cookieStore.get(LOCALE_COOKIE)?.value,
    headerStore.get('accept-language'),
  );

  return {
    locale,
    // The studio's zone replaces it once the session is known
    // (`SessionProvider`); until then dates read on the default studio clock,
    // never the server's or the browser's.
    timeZone: DEFAULT_TIME_ZONE,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
