import type { ReactNode } from 'react';

/** Shared responsive layout for search and filter controls. */
export function CollectionToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>
  );
}
