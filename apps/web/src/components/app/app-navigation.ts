import type { LucideIcon } from 'lucide-react';
import {
  BoxIcon,
  CalendarIcon,
  GraduationCapIcon,
  HeartIcon,
  HomeIcon,
  LayersIcon,
  RepeatIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react';

export type NavigationKey =
  | 'dashboard'
  | 'calendar'
  | 'students'
  | 'groups'
  | 'parents'
  | 'teachers'
  | 'patterns'
  | 'packages'
  | 'settings';

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

// One flat list, in the order the design reads it. Grouping headings were
// dropped with the Studio shell: eight destinations do not need three labels.
// Every destination reads business data, so every one is owner-only.
const navigationItems: NavigationItem[] = [
  { key: 'dashboard', href: '/app', icon: HomeIcon, exact: true, ownerOnly: true },
  { key: 'calendar', href: '/app/calendar', icon: CalendarIcon, ownerOnly: true },
  { key: 'students', href: '/app/students', icon: UsersIcon, ownerOnly: true },
  { key: 'groups', href: '/app/groups', icon: LayersIcon, ownerOnly: true },
  { key: 'parents', href: '/app/parents', icon: HeartIcon, ownerOnly: true },
  {
    key: 'teachers',
    href: '/app/teachers',
    icon: GraduationCapIcon,
    ownerOnly: true,
    schoolOnly: true,
  },
  { key: 'packages', href: '/app/packages', icon: BoxIcon, ownerOnly: true },
  { key: 'patterns', href: '/app/lessons/patterns', icon: RepeatIcon, ownerOnly: true },
];

const settingsItem: NavigationItem = {
  key: 'settings',
  href: '/app/settings',
  icon: SettingsIcon,
  ownerOnly: true,
};

function isVisible(item: NavigationItem, { isOwner, isSolo }: NavigationAccess): boolean {
  return (!item.ownerOnly || isOwner) && (!item.schoolOnly || !isSolo);
}

export function getNavigationItems(access: NavigationAccess): NavigationItem[] {
  return navigationItems.filter((item) => isVisible(item, access));
}

export function getSettingsNavigation(access: NavigationAccess): NavigationItem | null {
  return isVisible(settingsItem, access) ? settingsItem : null;
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

const routeContextItems = [...navigationItems, settingsItem].sort(
  (left, right) => right.href.length - left.href.length,
);

export function getRouteContext(pathname: string): RouteContext[] {
  const matchedItem = routeContextItems.find((item) => isNavigationActive(pathname, item));

  if (!matchedItem) {
    return [{ key: 'dashboard', href: '/app' }];
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
