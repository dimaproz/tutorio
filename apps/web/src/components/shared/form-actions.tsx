import type { ReactNode } from 'react';

/** Shared responsive placement for a form's cancel and submit actions. */
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">{children}</div>;
}
