'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftIcon, BellIcon, SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { IconButton } from '@/components/shared/icon-button';
import { usePageCrumb } from '@/components/shared/page-crumb';
import { canUseBusinessRoutes, getRouteContext } from './app-navigation';
import { useSession } from './session-provider';

/**
 * The phone top bar. A section root shows the logo with search and
 * notifications; a detail route shows the way back and a centred title.
 */
export function MobileAppBarContent({
  pathname,
  crumb,
  businessAccess = true,
}: {
  pathname: string;
  crumb?: string | null;
  /** False for a membership without business access: logo only, no actions. */
  businessAccess?: boolean;
}) {
  const t = useTranslations('app.nav');
  const tHeader = useTranslations('app.header');
  const context = businessAccess ? getRouteContext(pathname) : [];
  const parent = context.length === 2 && context[0].href ? context[0] : null;

  if (parent?.href) {
    return (
      // Three columns keep the title centred; a long way back shortens
      // instead of running under it («Налаштування» and «Заняття й пакети»).
      <header className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <Link
          href={parent.href}
          className="inline-flex h-11 max-w-full min-w-0 items-center gap-1.5 justify-self-start rounded-pill px-2 text-[15px] font-medium outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4.5 shrink-0" />
          <span className="truncate">{t(parent.key)}</span>
        </Link>
        <span className="max-w-[55vw] truncate text-base font-semibold">
          {crumb ?? t('detail')}
        </span>
        <span aria-hidden="true" />
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
      {businessAccess ? (
        <div className="flex items-center gap-1">
          <IconButton tone="ghost" icon={<SearchIcon />} label={tHeader('search')} />
          <IconButton tone="ghost" icon={<BellIcon />} label={tHeader('notifications')} indicator />
        </div>
      ) : null}
    </header>
  );
}

export function MobileAppBar() {
  const session = useSession();
  return (
    <MobileAppBarContent
      pathname={usePathname()}
      crumb={usePageCrumb()}
      businessAccess={canUseBusinessRoutes(session.role)}
    />
  );
}
