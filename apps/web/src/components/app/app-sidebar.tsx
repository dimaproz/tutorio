'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  UsersIcon,
  WalletIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useSession } from './session-provider';

// Live in Stage 2.
const NAV_ITEMS = [
  { key: 'students', href: '/app/students', icon: UsersIcon },
  { key: 'groups', href: '/app/groups', icon: GraduationCapIcon },
] as const;

// Enabled in later stages.
const UPCOMING_ITEMS = [
  { key: 'calendar', icon: CalendarIcon },
  { key: 'finance', icon: WalletIcon },
] as const;

export function AppSidebar() {
  const t = useTranslations('app.nav');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  const session = useSession();
  const isOwner = session.role === 'OWNER';

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <div className="flex flex-col gap-0.5 px-2 py-1.5">
          <span className="text-sm font-semibold">{tCommon('appName')}</span>
          <span className="truncate text-xs text-muted-foreground">{session.workspace.name}</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu aria-label={t('label')}>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/app'}>
                  <Link href="/app">
                    <LayoutDashboardIcon />
                    <span>{t('dashboard')}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {NAV_ITEMS.map(({ key, href, icon: Icon }) => (
                <SidebarMenuItem key={key}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(href)}>
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
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/app/settings')}>
                    <Link href="/app/settings">
                      <SettingsIcon />
                      <span>{t('settings')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}

              {UPCOMING_ITEMS.map(({ key, icon: Icon }) => (
                <SidebarMenuItem key={key}>
                  <SidebarMenuButton
                    aria-disabled="true"
                    className="pointer-events-none opacity-60"
                  >
                    <Icon />
                    <span>{t(key)}</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge className="text-xs text-muted-foreground">
                    {t('comingSoon')}
                  </SidebarMenuBadge>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
