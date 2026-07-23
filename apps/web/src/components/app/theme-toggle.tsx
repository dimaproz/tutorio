'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

// A single icon button that flips between light and dark — no system option.
// The visible icon is chosen with CSS from the `dark` class on <html> (set by
// next-themes), so there is no hydration flash: the click handler reads the
// resolved theme, which is always defined by the time a user can click.
export function ThemeToggle() {
  const t = useTranslations('app.userMenu');
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11 md:size-9"
      aria-label={t('theme')}
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <SunIcon className="dark:hidden" data-icon />
      <MoonIcon className="hidden dark:block" data-icon />
    </Button>
  );
}
