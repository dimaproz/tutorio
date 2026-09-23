'use client';

import * as React from 'react';

// Two contexts: the pages that set the crumb consume only the stable setter,
// so a crumb change re-renders the shell bars that read it, never the pages.
const PageCrumbContext = React.createContext<string | null>(null);
const SetPageCrumbContext = React.createContext<((crumb: string | null) => void) | null>(null);

/**
 * Lets a page name itself in the shell's top bar ("Anna Shevchenko › Edit")
 * without the shell knowing about any feature. The shell reads the crumb; the
 * page that knows the record's name sets it.
 */
export function PageCrumbProvider({ children }: { children: React.ReactNode }) {
  const [crumb, setCrumb] = React.useState<string | null>(null);
  return (
    <SetPageCrumbContext.Provider value={setCrumb}>
      <PageCrumbContext.Provider value={crumb}>{children}</PageCrumbContext.Provider>
    </SetPageCrumbContext.Provider>
  );
}

/** The crumb the current page supplied, if any. */
export function usePageCrumb(): string | null {
  return React.useContext(PageCrumbContext);
}

/** Names the current page in the top bar for as long as it is mounted. */
export function useSetPageCrumb(crumb: string | null | undefined) {
  const setCrumb = React.useContext(SetPageCrumbContext);
  React.useEffect(() => {
    if (!setCrumb) return;
    setCrumb(crumb ?? null);
    return () => setCrumb(null);
  }, [crumb, setCrumb]);
}
