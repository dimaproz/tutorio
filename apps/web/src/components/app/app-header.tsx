'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';
import { BellIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LocaleSwitcher } from '@/components/locale-switcher';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { IconButton } from '@/components/shared/icon-button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { BackButton } from '@/components/shared/back-button';
import { usePageCrumb } from '@/components/shared/page-crumb';
import { SearchField } from '@/components/shared/search-field';
import { canUseBusinessRoutes, getRouteContext } from './app-navigation';
import { useSession } from './session-provider';
import { ThemeToggle } from './theme-toggle';

export function AppHeaderContent({
  pathname,
  workspaceName,
  crumb,
  businessAccess = true,
  localeControl = (
    <LocaleSwitcher className="size-11 border border-border bg-card hover:border-line-hover" />
  ),
  themeControl = (
    <ThemeToggle className="size-11 border border-border bg-card hover:border-line-hover" />
  ),
}: {
  pathname: string;
  workspaceName?: string;
  /** The page's own name for itself, e.g. "Anna Shevchenko › Edit". */
  crumb?: string | null;
  /**
   * False for a membership without business access: the bar then names only
   * the workspace, with no section trail, search or notifications.
   */
  businessAccess?: boolean;
  localeControl?: React.ReactNode;
  themeControl?: React.ReactNode;
}) {
  const t = useTranslations('app.nav');
  const tHeader = useTranslations('app.header');
  const context = businessAccess ? getRouteContext(pathname) : [];
  const parentHref = context.length === 2 ? context[0].href : undefined;
  const parent = parentHref ? { key: context[0].key, href: parentHref } : null;

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2">
        {/* The Studio sidebar is always open on desktop, so the trigger only
            has a job where the navigation is an off-canvas sheet. */}
        <SidebarTrigger aria-label={t('toggle')} className="md:hidden" />
        {/* A detail route is a place you came from, not a path you browse: the
            bar carries the way back instead of a three-level trail. */}
        {parent ? (
          <div className="flex min-w-0 items-center gap-3">
            <BackButton href={parent.href} label={t(parent.key)} />
            <span className="truncate text-sm text-muted-foreground">{crumb ?? t('detail')}</span>
          </div>
        ) : (
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap text-sm">
              {workspaceName ? (
                <>
                  <BreadcrumbItem className="min-w-0">
                    <span className="truncate">{workspaceName}</span>
                  </BreadcrumbItem>
                  {context.length > 0 ? <BreadcrumbSeparator /> : null}
                </>
              ) : null}
              {context.map((item, index) => (
                <Fragment key={item.key}>
                  {index > 0 ? <BreadcrumbSeparator /> : null}
                  <BreadcrumbItem className="min-w-0">
                    {item.href && index < context.length - 1 ? (
                      <BreadcrumbLink asChild className="truncate">
                        <Link href={item.href}>{t(item.key)}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="truncate font-medium">
                        {t(item.key)}
                      </BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <div className={businessAccess ? 'hidden w-85 lg:block' : 'hidden'}>
          <SearchField
            label={tHeader('search')}
            placeholder={tHeader('searchPlaceholder')}
            shortcut="⌘K"
          />
        </div>
        {localeControl}
        {themeControl}
        {businessAccess ? (
          <IconButton border icon={<BellIcon />} label={tHeader('notifications')} indicator />
        ) : null}
      </div>
    </header>
  );
}

export function AppHeader() {
  const session = useSession();
  return (
    <AppHeaderContent
      pathname={usePathname()}
      workspaceName={session.workspace.name}
      crumb={usePageCrumb()}
      businessAccess={canUseBusinessRoutes(session.role)}
    />
  );
}
