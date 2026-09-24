'use client';

import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * The lesson panel's window (S01 layout): on desktop a centred 920×720 window
 * with the hero radius over the scrim, above the whole shell; on phones a
 * full-screen sheet. `compact` is the narrow window of the "not found" state.
 * The content owns the title (the lesson date) as a `DialogTitle`.
 */
export function LessonPanelWindow({
  open,
  onOpenChange,
  description,
  mobile,
  compact = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string;
  mobile: boolean;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        data-slot="lesson-panel"
        className={cn(
          'flex gap-0 overflow-hidden p-0',
          mobile
            ? 'top-0 left-0 h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col rounded-none bg-card sm:max-w-none'
            : compact
              ? 'w-130 max-w-[calc(100%-2rem)] flex-col rounded-hero bg-card p-5 sm:max-w-130'
              : 'h-180 max-h-[calc(100dvh-2rem)] w-230 max-w-[calc(100%-2rem)] rounded-hero bg-card sm:max-w-230',
        )}
      >
        <DialogDescription className="sr-only">{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The two columns of the desktop panel, or the one column of the phone sheet.
 *
 * - Desktop: the left column (card) scrolls its summary between the top bar
 *   and the pinned actions; the right column (paper) holds the payment or
 *   attendance block and the history, and only the history list scrolls —
 *   unless `asideScrolls`, for a group whose member list is long.
 * - Phone: the top bar, then one scrolling column (summary, then the aside
 *   blocks), and a footer with full-width actions.
 */
export function LessonPanelLayout({
  mobile,
  topBar,
  main,
  aside,
  footer,
  asideScrolls = false,
}: {
  mobile: boolean;
  topBar: ReactNode;
  main: ReactNode;
  aside: ReactNode;
  footer?: ReactNode;
  asideScrolls?: boolean;
}) {
  if (mobile) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="px-4 pt-4 pb-2">{topBar}</div>
        <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-2 pb-6">
          {main}
          {aside}
        </div>
        {footer ? (
          <div className="flex gap-3 border-t border-border bg-card px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)] *:flex-1">
            {footer}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-card">
        <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-4.5 overflow-y-auto px-6 pt-6 pb-4">
          {topBar}
          {main}
        </div>
        {footer ? <div className="flex flex-wrap gap-3 px-6 pt-2 pb-6">{footer}</div> : null}
      </div>
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col gap-5.5 bg-background p-6',
          asideScrolls ? 'scrollbar-thin overflow-y-auto' : 'overflow-hidden',
        )}
      >
        {aside}
      </div>
    </>
  );
}
