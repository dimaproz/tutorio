'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOutIcon, MoreVerticalIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { AuthMe } from '@tutorio/validation';
import {
  DropdownMenu,
  DropdownMenuContent,
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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { PersonItem } from '@/components/shared/person-item';
import { useLogoutMutation } from '@/lib/auth/client';
import {
  closeMobileNavigation,
  getNavigationItems,
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

/**
 * The workspace context row. A school shows its name and scale; a solo tutor
 * shows their own identity. Switching workspaces is not built yet, so the row
 * is information, not a control — no chevron, no tab stop — until a real
 * switcher exists.
 */
function WorkspaceSwitcher({ session, isSolo }: { session: AuthMe; isSolo: boolean }) {
  const t = useTranslations('app.workspace');

  return (
    <div
      data-slot="workspace-context"
      className="flex h-16 w-full items-center gap-3 rounded-row bg-sidebar-accent pr-3.5 pl-2.5 text-left text-sidebar-accent-foreground"
    >
      {isSolo ? (
        <EntityAvatar fullName={session.user.name} size="md" />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-item border border-border bg-card text-lg font-bold text-tint-indigo-foreground"
        >
          {(isSolo ? session.user.name : session.workspace.name).slice(0, 1)}
        </span>
      )}
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="truncate text-sm leading-[18px] font-semibold">
          {isSolo ? session.user.name : session.workspace.name}
        </span>
        <span className="truncate text-xs leading-4 text-muted-foreground">
          {isSolo ? t('soloTutor') : t('school')}
        </span>
      </span>
    </div>
  );
}

export function SidebarUserMenu({
  session,
  isLogoutPending = false,
  onLogout,
}: {
  session: AuthMe;
  isLogoutPending?: boolean;
  onLogout: () => void;
}) {
  const { isMobile } = useSidebar();
  const t = useTranslations('app.userMenu');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          // Named by its visible content (the name and role), so voice control
          // can reach it; the trigger itself announces the menu popup.
          className="w-full rounded-tile bg-sidebar-accent p-2.5 text-left text-sidebar-accent-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <PersonItem
            size="sm"
            media={<EntityAvatar fullName={session.user.name} size="sm" />}
            name={session.user.name}
            subtitle={t(`roles.${session.role}`)}
            trail={<MoreVerticalIcon className="size-4.5" />}
            className="text-sidebar-accent-foreground"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={isMobile ? 'bottom' : 'right'} align="end" sideOffset={4}>
        <DropdownMenuLabel>
          <div className="flex min-w-0 items-center gap-2">
            <EntityAvatar fullName={session.user.name} size="sm" />
            <div className="grid min-w-0 flex-1 gap-0.5">
              <span className="truncate text-foreground">{session.user.name}</span>
              <span className="truncate">{session.user.email}</span>
              <span>{t(`roles.${session.role}`)}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={isLogoutPending} onSelect={onLogout}>
          <LogOutIcon />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
  const items = getNavigationItems(access);

  return (
    // `offcanvas` is the mobile behaviour: below md the sidebar is a sheet.
    // On desktop it never collapses — the design has no control for it, and
    // nothing here offers one.
    <Sidebar variant="floating" collapsible="offcanvas" className="p-4 pr-6">
      <SidebarHeader className="gap-5.5 p-0 px-3.5 pt-5">
        <Link
          href="/app"
          onClick={() => closeMobileNavigation(isMobile, setOpenMobile)}
          className="flex items-center gap-2.5 px-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <span
            aria-hidden="true"
            className="flex size-8.5 items-center justify-center rounded-logo bg-brand-soft text-xl font-bold text-brand-soft-foreground"
          >
            t
          </span>
          <span className="text-[22px] font-semibold tracking-[-0.02em]">tutorio</span>
        </Link>
        <WorkspaceSwitcher session={session} isSolo={isSolo} />
      </SidebarHeader>
      <SidebarContent className="gap-5.5 pt-5.5">
        <SidebarGroup className="p-0 px-3.5">
          <SidebarGroupContent>
            <SidebarMenu aria-label={t('label')} className="gap-1">
              {items.map((item) => (
                <SidebarNavigationLink key={item.key} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-0 px-3.5 pt-2 pb-5">
        <SidebarUserMenu
          session={session}
          isLogoutPending={isLogoutPending}
          onLogout={onLogout}
        />
      </SidebarFooter>
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
