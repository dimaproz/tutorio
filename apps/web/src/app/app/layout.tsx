import { AppHeader } from '@/components/app/app-header';
import { AppSidebar } from '@/components/app/app-sidebar';
import { SessionProvider } from '@/components/app/session-provider';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
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
        <SidebarInset className="gap-6 p-4 md:pt-5 md:pr-6 md:pb-4 md:pl-0">
          <AppHeader />
          <div className="flex flex-1 flex-col gap-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  );
}
