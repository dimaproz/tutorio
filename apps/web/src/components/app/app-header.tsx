'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { getRouteContext } from './app-navigation';
import { ThemeToggle } from './theme-toggle';

export function AppHeaderContent({
  pathname,
  localeControl = <LocaleSwitcher />,
  themeControl = <ThemeToggle />,
}: {
  pathname: string;
  localeControl?: React.ReactNode;
  themeControl?: React.ReactNode;
}) {
  const t = useTranslations('app.nav');
  const context = getRouteContext(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background">
      <div className="flex min-w-0 flex-1 items-center gap-2 px-4 md:px-6">
        <SidebarTrigger aria-label={t('toggle')} />
        <Separator orientation="vertical" className="h-4" />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            {context.map((item, index) => (
              <Fragment key={item.key}>
                {index > 0 ? <BreadcrumbSeparator /> : null}
                <BreadcrumbItem className="min-w-0">
                  {item.href && index < context.length - 1 ? (
                    <BreadcrumbLink asChild className="truncate">
                      <Link href={item.href}>{t(item.key)}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="truncate">{t(item.key)}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex shrink-0 items-center gap-1 px-2 md:px-4">
        {localeControl}
        {themeControl}
      </div>
    </header>
  );
}

export function AppHeader() {
  return <AppHeaderContent pathname={usePathname()} />;
}
