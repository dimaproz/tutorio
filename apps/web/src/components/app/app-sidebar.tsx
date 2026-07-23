'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarIcon,
  ContactIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  UsersIcon,
  WalletIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { nameInitials } from '@/lib/utils';
import { useSession } from './session-provider';

// Primary product sections (Stage 2 / 2.5).
type NavItem = {
  key: string;
  href: string;
  icon: typeof LayoutDashboardIcon;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', href: '/app', icon: LayoutDashboardIcon, exact: true },
  { key: 'students', href: '/app/students', icon: UsersIcon },
  { key: 'parents', href: '/app/parents', icon: ContactIcon },
  { key: 'groups', href: '/app/groups', icon: GraduationCapIcon },
];

// Enabled in later stages — shown disabled with a "coming soon" badge.
const UPCOMING_ITEMS = [
  { key: 'calendar', icon: CalendarIcon },
  { key: 'finance', icon: WalletIcon },
] as const;

// Roomier rows than the shadcn default (h-8) — matches the design lab / TailAdmin
// rail: larger hit area, size-5 icons, brand-tinted pill on the active item
// (driven by --sidebar-accent).
const ITEM_CLASS = 'h-11 gap-3 rounded-lg px-3 [&_svg]:size-5';

export function AppSidebar() {
  const t = useTranslations('app.nav');
  const tCommon = useTranslations('common');
  const tRoles = useTranslations('app.userMenu.roles');
  const pathname = usePathname();
  const session = useSession();
  const isOwner = session.role === 'OWNER';

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-2">
          <span className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-lg">
            <GraduationCapIcon className="size-5" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{tCommon('appName')}</span>
            <span className="text-muted-foreground truncate text-xs">
              {session.workspace.name}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium tracking-wider uppercase">
            {t('menuLabel')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu aria-label={t('label')} className="gap-1">
              {NAV_ITEMS.map(({ key, href, icon: Icon, exact }) => (
                <SidebarMenuItem key={key}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(href, exact)}
                    className={ITEM_CLASS}
                  >
                    <Link href={href}>
                      <Icon />
                      <span>{t(key)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Settings is owner-only in the UI; the API enforces it too. */}
              {isOwner ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/app/settings')}
                    className={ITEM_CLASS}
                  >
                    <Link href="/app/settings">
                      <SettingsIcon />
                      <span>{t('settings')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium tracking-wider uppercase">
            {t('comingSoon')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {UPCOMING_ITEMS.map(({ key, icon: Icon }) => (
                <SidebarMenuItem key={key}>
                  <SidebarMenuButton
                    aria-disabled="true"
                    className={`${ITEM_CLASS} pointer-events-none opacity-60`}
                  >
                    <Icon />
                    <span>{t(key)}</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge className="top-3 text-xs text-muted-foreground">
                    {t('comingSoon')}
                  </SidebarMenuBadge>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/60 px-3 py-2.5">
          <Avatar className="size-9">
            <AvatarFallback className="text-xs">
              {nameInitials(session.user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-medium">{session.user.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {tRoles(session.role)}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
