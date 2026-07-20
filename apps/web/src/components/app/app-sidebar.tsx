'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
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

const UPCOMING_ITEMS = [
  { key: 'students', icon: UsersIcon },
  { key: 'groups', icon: GraduationCapIcon },
  { key: 'calendar', icon: CalendarIcon },
  { key: 'finance', icon: WalletIcon },
] as const;

export function AppSidebar() {
  const t = useTranslations('app.nav');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  const session = useSession();

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
