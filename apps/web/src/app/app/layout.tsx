import { cookies } from 'next/headers';
import { AppHeader } from '@/components/app/app-header';
import { AppSidebar } from '@/components/app/app-sidebar';
import { SessionProvider } from '@/components/app/session-provider';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false';

  return (
    <SessionProvider>
      <SidebarProvider
        defaultOpen={defaultOpen}
        style={
          {
            // 276px card + 16px page padding + the 24px gutter to the content.
            '--sidebar-width': '316px',
            '--header-height': '3rem',
          } as React.CSSProperties
        }
      >
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex flex-1 flex-col gap-6 p-4 md:pt-5 md:pr-6 md:pb-4 md:pl-0">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  );
}
