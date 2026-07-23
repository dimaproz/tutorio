'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Flag, type FlagCode } from '@/components/app/flag';
import { setLocale } from '@/i18n/actions';
import { LOCALES, type Locale } from '@/i18n/locale';

// Which flag represents each supported UI language.
const LOCALE_FLAG: Record<string, FlagCode> = {
  uk: 'ua',
  en: 'gb',
};

// Single button that flips between the two supported locales. With only uk/en a
// toggle is clearer than a dropdown; the visible code shows the CURRENT locale.
export function LocaleSwitcher() {
  const t = useTranslations('app.localeSwitcher');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const next: Locale = LOCALES.find((entry) => entry !== locale) ?? LOCALES[0];

  function toggle() {
    startTransition(async () => {
      await setLocale(next);
      // Same URL, new locale: refresh re-renders the current route.
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={isPending}
      onClick={toggle}
      aria-label={`${t('label')}: ${t(next)}`}
      title={t(next)}
    >
      {LOCALE_FLAG[locale] ? (
        <Flag code={LOCALE_FLAG[locale]} className="size-5" />
      ) : (
        <span className="text-xs uppercase">{locale}</span>
      )}
    </Button>
  );
}
