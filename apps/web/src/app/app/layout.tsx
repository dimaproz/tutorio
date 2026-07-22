import { AppHeader } from '@/components/app/app-header';
import { AppSidebar } from '@/components/app/app-sidebar';
import { SessionProvider } from '@/components/app/session-provider';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          {/* Cap and centre content at the design-lab width so cards, tables
              and whitespace read the same on wide viewports. */}
          <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  );
}
