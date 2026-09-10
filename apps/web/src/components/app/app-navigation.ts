import type { LucideIcon } from 'lucide-react';
import {
  CalendarIcon,
  ContactIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  PackageIcon,
  PresentationIcon,
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

export type NavigationGroupLabelKey = 'mainGroup' | 'peopleGroup' | 'managementGroup';

export type NavigationItem = {
  key: NavigationKey;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  ownerOnly?: boolean;
  schoolOnly?: boolean;
};

export type NavigationGroup = {
  key: 'main' | 'people' | 'management';
  labelKey: NavigationGroupLabelKey;
  items: NavigationItem[];
};

export type NavigationAccess = {
  isOwner: boolean;
  isSolo: boolean;
};

const navigationGroups: NavigationGroup[] = [
  {
    key: 'main',
    labelKey: 'mainGroup',
    items: [
      { key: 'dashboard', href: '/app', icon: LayoutDashboardIcon, exact: true },
      { key: 'calendar', href: '/app/calendar', icon: CalendarIcon },
    ],
  },
  {
    key: 'people',
    labelKey: 'peopleGroup',
    items: [
      { key: 'students', href: '/app/students', icon: UsersIcon },
      { key: 'groups', href: '/app/groups', icon: GraduationCapIcon },
      { key: 'parents', href: '/app/parents', icon: ContactIcon },
      { key: 'teachers', href: '/app/teachers', icon: PresentationIcon, schoolOnly: true },
    ],
  },
  {
    key: 'management',
    labelKey: 'managementGroup',
    items: [
      { key: 'patterns', href: '/app/lessons/patterns', icon: RepeatIcon },
      { key: 'packages', href: '/app/packages', icon: PackageIcon },
    ],
  },
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

export function getNavigationGroups(access: NavigationAccess): NavigationGroup[] {
  return navigationGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => isVisible(item, access)),
  }));
}

export function getSettingsNavigation(access: NavigationAccess): NavigationItem | null {
  return isVisible(settingsItem, access) ? settingsItem : null;
}

export function isNavigationActive(pathname: string, item: Pick<NavigationItem, 'href' | 'exact'>) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export type RouteContext = {
  key: NavigationKey | 'detail';
  href?: string;
};

const routeContextItems = [...navigationGroups.flatMap((group) => group.items), settingsItem].sort(
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
