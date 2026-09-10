'use client';

import { useContext, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EntityFormDialogContext } from './entity-form-dialog';

/** Shared responsive placement for a form's cancel and submit actions. */
export function FormActions({ children }: { children: ReactNode }) {
  const inEntityFormDialog = useContext(EntityFormDialogContext);
  return (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:justify-end',
        inEntityFormDialog && 'sticky bottom-[-1.25rem] -mx-6 border-t bg-popover px-6 py-4',
      )}
    >
      {children}
    </div>
  );
}
