'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftIcon, BellIcon, SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { IconButton } from '@/components/shared/icon-button';
import { usePageCrumb } from '@/components/shared/page-crumb';
import { getRouteContext } from './app-navigation';

/**
 * The phone top bar. A section root shows the logo with search and
 * notifications; a detail route shows the way back and a centred title.
 */
export function MobileAppBarContent({
  pathname,
  crumb,
}: {
  pathname: string;
  crumb?: string | null;
}) {
  const t = useTranslations('app.nav');
  const tHeader = useTranslations('app.header');
  const context = getRouteContext(pathname);
  const parent = context.length === 2 && context[0].href ? context[0] : null;

  if (parent?.href) {
    return (
      <header className="relative flex h-14 shrink-0 items-center justify-center px-1">
        <Link
          href={parent.href}
          className="absolute left-0 inline-flex h-11 items-center gap-1.5 rounded-pill px-2 text-[15px] font-medium outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4.5" />
          {t(parent.key)}
        </Link>
        <span className="max-w-[55%] truncate text-base font-semibold">{crumb ?? t('detail')}</span>
      </header>
    );
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between">
      <Link
        href="/app"
        className="flex items-center gap-2.5 rounded-control outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span
          aria-hidden="true"
          className="flex size-8.5 items-center justify-center rounded-logo bg-brand-soft text-xl font-bold text-brand-soft-foreground"
        >
          t
        </span>
        <span className="text-xl font-semibold tracking-[-0.02em]">tutorio</span>
      </Link>
      <div className="flex items-center gap-1">
        <IconButton tone="ghost" icon={<SearchIcon />} label={tHeader('search')} />
        <IconButton tone="ghost" icon={<BellIcon />} label={tHeader('notifications')} indicator />
      </div>
    </header>
  );
}

export function MobileAppBar() {
  return <MobileAppBarContent pathname={usePathname()} crumb={usePageCrumb()} />;
}
