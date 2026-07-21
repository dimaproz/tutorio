'use client';

import { Suspense, useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Header } from '@/components/design/shell/header';
import { Sidebar } from '@/components/design/shell/sidebar';
import { cn } from '@/lib/utils';

// Lab chrome, styled after TailAdmin: a fixed left sidebar on desktop, a Sheet
// on mobile, and a sticky top header over a grey content column. The real app
// keeps its own theme handling — this only exists so the whole system can be
// reviewed on one screen.
export function DesignShell({
  fontVariables,
  children,
}: {
  fontVariables: string;
  children: React.ReactNode;
}) {
  const [isDark, setIsDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Tailwind's dark variant is `&:is(.dark *)`, so the app root's `.dark`
  // switches on every `dark:` override inside shadcn components regardless of
  // what this shell asks for. Mirroring the root class while the lab is
  // mounted keeps component internals and our tokens in the same theme; the
  // previous value is restored on unmount so app screens are untouched.
  useEffect(() => {
    const root = document.documentElement;
    const had = root.classList.contains('dark');

    const assert = () => {
      if (root.classList.contains('dark') !== isDark) {
        root.classList.toggle('dark', isDark);
      }
    };
    assert();

    // The app's theme provider re-applies its own class after hydration, which
    // lands after this effect. Re-assert rather than fight the ordering.
    const observer = new MutationObserver(assert);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
      root.classList.toggle('dark', had);
    };
  }, [isDark]);

  return (
    <div
      className={cn(
        fontVariables,
        'theme-tailadmin',
        isDark && 'dark',
        'bg-background text-foreground min-h-svh font-sans antialiased',
      )}
    >
      <TooltipProvider>
        <div className="flex min-h-svh">
          <aside className="fixed inset-y-0 left-0 z-40 hidden lg:block">
            <Suspense fallback={<div className="w-[290px]" />}>
              <Sidebar />
            </Suspense>
          </aside>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-[290px] p-0">
              <SheetTitle className="sr-only">Меню лабораторії</SheetTitle>
              <Suspense fallback={<div className="w-[290px]" />}>
                <Sidebar onNavigate={() => setMobileOpen(false)} />
              </Suspense>
            </SheetContent>
          </Sheet>

          <div className="flex min-w-0 flex-1 flex-col lg:pl-[290px]">
            <Header
              isDark={isDark}
              onToggleDark={() => setIsDark((value) => !value)}
              onOpenSidebar={() => setMobileOpen(true)}
            />
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </TooltipProvider>

      <Toaster position="bottom-center" />
    </div>
  );
}
