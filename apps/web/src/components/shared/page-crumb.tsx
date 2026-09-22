'use client';

import * as React from 'react';

type CrumbStore = {
  crumb: string | null;
  setCrumb: (crumb: string | null) => void;
};

const PageCrumbContext = React.createContext<CrumbStore | null>(null);

/**
 * Lets a page name itself in the shell's top bar ("Anna Shevchenko › Edit")
 * without the shell knowing about any feature. The shell reads the crumb; the
 * page that knows the record's name sets it.
 */
export function PageCrumbProvider({ children }: { children: React.ReactNode }) {
  const [crumb, setCrumb] = React.useState<string | null>(null);
  const value = React.useMemo(() => ({ crumb, setCrumb }), [crumb]);
  return <PageCrumbContext.Provider value={value}>{children}</PageCrumbContext.Provider>;
}

/** The crumb the current page supplied, if any. */
export function usePageCrumb(): string | null {
  return React.useContext(PageCrumbContext)?.crumb ?? null;
}

/** Names the current page in the top bar for as long as it is mounted. */
export function useSetPageCrumb(crumb: string | null | undefined) {
  const setCrumb = React.useContext(PageCrumbContext)?.setCrumb;
  React.useEffect(() => {
    if (!setCrumb) return;
    setCrumb(crumb ?? null);
    return () => setCrumb(null);
  }, [crumb, setCrumb]);
}
