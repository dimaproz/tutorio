'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, LanguagesIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { setLocale } from '@/i18n/actions';
import { LOCALES, type Locale } from '@/i18n/locale';

export function LocaleSwitcher() {
  const t = useTranslations('app.localeSwitcher');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale) {
      return;
    }
    startTransition(async () => {
      await setLocale(next);
      // Same URL, new locale: refresh re-renders the current route.
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          aria-label={t('label')}
          className="h-11 md:h-8"
        >
          <LanguagesIcon data-icon="inline-start" />
          <span className="uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {LOCALES.map((entry) => (
            <DropdownMenuItem key={entry} onSelect={() => switchTo(entry)}>
              {t(entry)}
              {entry === locale ? <CheckIcon data-icon="inline-end" className="ml-auto" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
