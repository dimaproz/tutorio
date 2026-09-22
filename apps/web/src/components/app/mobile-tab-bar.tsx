'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BoxIcon,
  CalendarIcon,
  EllipsisVerticalIcon,
  HomeIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { isNavigationActive, type NavigationKey } from './app-navigation';

const TABS: { key: NavigationKey; href: string; icon: LucideIcon; exact?: boolean }[] = [
  { key: 'dashboard', href: '/app', icon: HomeIcon, exact: true },
  { key: 'calendar', href: '/app/calendar', icon: CalendarIcon },
  { key: 'students', href: '/app/students', icon: UsersIcon },
  { key: 'packages', href: '/app/packages', icon: BoxIcon },
];

const TAB_CLASS =
  'flex min-w-0 flex-1 flex-col items-center gap-1 py-1 text-[11px] font-medium text-muted-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-[current=page]:font-semibold aria-[current=page]:text-foreground';

function TabIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-8 w-13 items-center justify-center rounded-pill transition-colors duration-150 [&_svg]:size-5',
        active && 'bg-tint-indigo text-tint-indigo-foreground',
      )}
    >
      <Icon />
    </span>
  );
}

/**
 * The phone tab bar: four destinations and "More", which opens the full
 * navigation sheet. Fixed to the bottom with the safe-area inset below it.
 */
export function MobileTabBarContent({
  pathname,
  onMore,
}: {
  pathname: string;
  onMore: () => void;
}) {
  const t = useTranslations('app.nav');

  return (
    <nav
      aria-label={t('tabsLabel')}
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card px-2 pt-2 pb-[max(env(safe-area-inset-bottom),18px)] md:hidden"
    >
      {TABS.map((tab) => {
        const active = isNavigationActive(pathname, tab);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={TAB_CLASS}
          >
            <TabIcon icon={tab.icon} active={active} />
            <span className="truncate">{t(tab.key)}</span>
          </Link>
        );
      })}
      <button type="button" onClick={onMore} className={TAB_CLASS}>
        <TabIcon icon={EllipsisVerticalIcon} active={false} />
        <span className="truncate">{t('more')}</span>
      </button>
    </nav>
  );
}

export function MobileTabBar() {
  const { setOpenMobile } = useSidebar();
  return <MobileTabBarContent pathname={usePathname()} onMore={() => setOpenMobile(true)} />;
}
