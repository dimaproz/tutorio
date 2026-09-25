import type { LucideIcon } from 'lucide-react';
import {
  CalendarDaysIcon,
  ClipboardListIcon,
  HeartIcon,
  LayersIcon,
  PackageIcon,
  RepeatIcon,
  UsersIcon,
} from 'lucide-react';

// The rebuilt destinations only; teachers, home and settings return with
// their new screens.
export type NavigationKey =
  'calendar' | 'lessons' | 'schedules' | 'packages' | 'students' | 'groups' | 'parents';

export type NavigationItem = {
  key: NavigationKey;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  ownerOnly?: boolean;
  schoolOnly?: boolean;
};

export type NavigationAccess = {
  isOwner: boolean;
  isSolo: boolean;
};

/**
 * The pilot is owner-operated (ADR 0004): every business read and command is
 * owner-only in the API, and a legacy TEACHER membership can only see who it
 * is. The shell mirrors that exactly: a non-owner gets no destinations and a
 * single "no access yet" screen, never pages built from 403s.
 */
export function canUseBusinessRoutes(role: string): boolean {
  return role === 'OWNER';
}

// One flat list, in the order the design reads it. Every destination reads
// business data, so every one is owner-only.
const navigationItems: NavigationItem[] = [
  { key: 'calendar', href: '/app/calendar', icon: CalendarDaysIcon, ownerOnly: true },
  { key: 'lessons', href: '/app/lessons', icon: ClipboardListIcon, ownerOnly: true },
  { key: 'schedules', href: '/app/schedules', icon: RepeatIcon, ownerOnly: true },
  { key: 'packages', href: '/app/packages', icon: PackageIcon, ownerOnly: true },
  { key: 'students', href: '/app/students', icon: UsersIcon, ownerOnly: true },
  { key: 'groups', href: '/app/groups', icon: LayersIcon, ownerOnly: true },
  { key: 'parents', href: '/app/parents', icon: HeartIcon, ownerOnly: true },
];

function isVisible(item: NavigationItem, { isOwner, isSolo }: NavigationAccess): boolean {
  return (!item.ownerOnly || isOwner) && (!item.schoolOnly || !isSolo);
}

export function getNavigationItems(access: NavigationAccess): NavigationItem[] {
  return navigationItems.filter((item) => isVisible(item, access));
}

export function isNavigationActive(pathname: string, item: Pick<NavigationItem, 'href' | 'exact'>) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export type RouteContext = {
  key: NavigationKey | 'detail';
  href?: string;
};

const routeContextItems = [...navigationItems].sort(
  (left, right) => right.href.length - left.href.length,
);

export function getRouteContext(pathname: string): RouteContext[] {
  const matchedItem = routeContextItems.find((item) => isNavigationActive(pathname, item));

  if (!matchedItem) {
    return [{ key: 'students', href: '/app/students' }];
  }

  if (pathname === matchedItem.href) {
    return [{ key: matchedItem.key, href: matchedItem.href }];
  }

  return [{ key: matchedItem.key, href: matchedItem.href }, { key: 'detail' }];
}

export function closeMobileNavigation(
  isMobile: boolean,
  setOpenMobile: (open: boolean) => void,
): void {
  if (isMobile) {
    setOpenMobile(false);
  }
}
