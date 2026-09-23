import { AppHeader } from '@/components/app/app-header';
import { AppSidebar } from '@/components/app/app-sidebar';
import { MobileAppBar } from '@/components/app/mobile-app-bar';
import { MobileTabBar } from '@/components/app/mobile-tab-bar';
import { OwnerAccessGate } from '@/components/app/owner-access-gate';
import { PageCrumbProvider } from '@/components/shared/page-crumb';
import { SessionProvider } from '@/components/app/session-provider';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PageCrumbProvider>
        {/* The desktop sidebar is always open, so there is no persisted collapse
          state to restore — and a stale one would strand a user behind a
          sidebar nothing can reopen. */}
        <SidebarProvider
          defaultOpen
          style={
            {
              // 276px card + 16px page padding + the 24px gutter to the content.
              '--sidebar-width': '316px',
              '--header-height': '3rem',
            } as React.CSSProperties
          }
        >
          <AppSidebar />
          {/* The page ground carries 16px of padding and a 24px rhythm; the top
            bar is the first item in that column, not a band above it. */}
          {/* Phones get their own bar and a fixed tab bar; the bottom padding
            keeps the last card clear of it. */}
          <SidebarInset className="gap-4 px-4 pt-1 pb-[calc(var(--mobile-tab-bar-height)+24px)] md:gap-6 md:pt-5 md:pr-6 md:pb-4 md:pl-0">
            <div className="md:hidden">
              <MobileAppBar />
            </div>
            <div className="hidden md:block">
              <AppHeader />
            </div>
            <div className="flex flex-1 flex-col gap-4 md:gap-6">
              <OwnerAccessGate>{children}</OwnerAccessGate>
            </div>
          </SidebarInset>
          <MobileTabBar />
        </SidebarProvider>
      </PageCrumbProvider>
    </SessionProvider>
  );
}
