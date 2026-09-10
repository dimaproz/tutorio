'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { GraduationCapIcon, LogOutIcon, SettingsIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { AuthMe } from '@tutorio/validation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { useLogoutMutation } from '@/lib/auth/client';
import { nameInitials } from '@/lib/utils';
import {
  closeMobileNavigation,
  getNavigationGroups,
  getSettingsNavigation,
  isNavigationActive,
  type NavigationItem,
} from './app-navigation';
import { performLogout } from './app-shell-actions';
import { useIsSoloWorkspace, useSession } from './session-provider';

function SidebarNavigationLink({ item, pathname }: { item: NavigationItem; pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const t = useTranslations('app.nav');
  const Icon = item.icon;
  const isActive = isNavigationActive(pathname, item);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={t(item.key)}>
        <Link
          href={item.href}
          aria-current={isActive ? 'page' : undefined}
          onClick={() => closeMobileNavigation(isMobile, setOpenMobile)}
        >
          <Icon />
          <span>{t(item.key)}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function SidebarUserMenu({
  session,
  canAccessSettings,
  isLogoutPending = false,
  onLogout,
}: {
  session: AuthMe;
  canAccessSettings: boolean;
  isLogoutPending?: boolean;
  onLogout: () => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const t = useTranslations('app.userMenu');
  const tNav = useTranslations('app.nav');

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip={t('label')} aria-label={t('label')}>
              <Avatar>
                <AvatarFallback>{nameInitials(session.user.name)}</AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate">{session.user.name}</span>
                <span className="truncate text-muted-foreground">{session.user.email}</span>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? 'bottom' : 'right'} align="end" sideOffset={4}>
            <DropdownMenuLabel>
              <div className="flex min-w-0 items-center gap-2">
                <Avatar size="lg">
                  <AvatarFallback>{nameInitials(session.user.name)}</AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate text-foreground">{session.user.name}</span>
                  <span className="truncate">{session.user.email}</span>
                  <span>{t(`roles.${session.role}`)}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            {canAccessSettings ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/app/settings"
                      onClick={() => closeMobileNavigation(isMobile, setOpenMobile)}
                    >
                      <SettingsIcon />
                      {tNav('settings')}
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={isLogoutPending} onSelect={onLogout}>
              <LogOutIcon />
              {t('logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function AppSidebarContent({
  pathname,
  session,
  isSolo,
  isLogoutPending,
  onLogout,
}: {
  pathname: string;
  session: AuthMe;
  isSolo: boolean;
  isLogoutPending?: boolean;
  onLogout: () => void;
}) {
  const t = useTranslations('app.nav');
  const { isMobile, setOpenMobile } = useSidebar();
  const access = { isOwner: session.role === 'OWNER', isSolo };
  const groups = getNavigationGroups(access);
  const settings = getSettingsNavigation(access);

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip={t('dashboard')}>
              <Link href="/app" onClick={() => closeMobileNavigation(isMobile, setOpenMobile)}>
                <GraduationCapIcon />
                <span className="truncate">Tutorio</span>
                <span className="truncate text-muted-foreground">{session.workspace.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.key}>
            <SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu aria-label={t(group.labelKey)}>
                {group.items.map((item) => (
                  <SidebarNavigationLink key={item.key} item={item} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        {settings ? (
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarNavigationLink item={settings} pathname={pathname} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <SidebarUserMenu
          session={session}
          canAccessSettings={settings !== null}
          isLogoutPending={isLogoutPending}
          onLogout={onLogout}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const isSolo = useIsSoloWorkspace();
  const logout = useLogoutMutation();
  const tErrors = useTranslations('auth.errors');

  async function onLogout() {
    await performLogout({
      logout: () => logout.mutateAsync(),
      redirectToLogin: () => router.replace('/login'),
      reportError: () => toast.error(tErrors('generic')),
    });
  }

  return (
    <AppSidebarContent
      pathname={pathname}
      session={session}
      isSolo={isSolo}
      isLogoutPending={logout.isPending}
      onLogout={() => void onLogout()}
    />
  );
}
