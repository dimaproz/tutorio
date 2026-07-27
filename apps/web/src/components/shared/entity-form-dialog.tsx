'use client';

import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoadingPanel } from '@/components/shared/loading';
import { cn } from '@/lib/utils';

type DialogWidth = 'sm' | 'md' | 'lg';

const widthClass: Record<DialogWidth, string> = {
  sm: 'sm:max-w-lg',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-2xl',
};

/**
 * The standard create/edit shell. Feature dialogs own fetching and form
 * behaviour; this component owns only the shared accessible dialog layout.
 */
export function EntityFormDialog({
  open,
  onOpenChange,
  title,
  description,
  width = 'sm',
  isLoading = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  width?: DialogWidth;
  isLoading?: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn('flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0', widthClass[width])}
      >
        <DialogHeader className="shrink-0 border-b bg-popover px-6 py-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-5">
          {isLoading ? <LoadingPanel className="min-h-48 rounded-xl border-0 bg-transparent" /> : children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

