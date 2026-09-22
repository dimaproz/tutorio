'use client';

import type { CSSProperties, ReactNode } from 'react';
import { AppHeaderContent } from '@/components/app/app-header';
import { AppSidebarContent } from '@/components/app/app-sidebar';
import { MobileAppBarContent } from '@/components/app/mobile-app-bar';
import { MobileTabBarContent } from '@/components/app/mobile-tab-bar';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { PageCrumbProvider, usePageCrumb } from '@/components/shared/page-crumb';
import { IconButton } from '@/components/shared/icon-button';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { MoonIcon } from 'lucide-react';
import { storySession } from './story-backend';

function Chrome({ pathname, children }: { pathname: string; children: ReactNode }) {
  const crumb = usePageCrumb();
  return (
    <>
      <AppSidebarContent
        pathname={pathname}
        session={storySession}
        isSolo={false}
        onLogout={() => undefined}
      />
      <SidebarInset className="gap-4 px-4 pt-1 pb-[110px] md:gap-6 md:pt-5 md:pr-6 md:pb-4 md:pl-0">
        <div className="md:hidden">
          <MobileAppBarContent pathname={pathname} crumb={crumb} />
        </div>
        <div className="hidden md:block">
          <AppHeaderContent
            pathname={pathname}
            workspaceName={storySession.workspace.name}
            crumb={crumb}
            localeControl={<LocaleSwitcher className="size-11 border border-border bg-card" />}
            themeControl={<IconButton border icon={<MoonIcon />} label="Dark theme" />}
          />
        </div>
        <div className="flex flex-1 flex-col gap-4 md:gap-6">{children}</div>
      </SidebarInset>
      <MobileTabBarContent pathname={pathname} onMore={() => undefined} />
    </>
  );
}

/**
 * The authenticated frame for screen stories: the same sidebar, top bars and
 * tab bar the app layout renders, without the session request.
 */
export function StoryAppShell({ pathname, children }: { pathname: string; children: ReactNode }) {
  return (
    <PageCrumbProvider>
      <SidebarProvider
        defaultOpen
        style={{ '--sidebar-width': '316px', '--header-height': '3rem' } as CSSProperties}
      >
        <Chrome pathname={pathname}>{children}</Chrome>
      </SidebarProvider>
    </PageCrumbProvider>
  );
}
