'use client';

import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * The lesson windows' dialog (S01 layout A, the S02 form): on desktop one
 * centred 640px column with the hero radius over the scrim, as tall as its
 * content up to the viewport less 48px; on phones a full-screen sheet.
 * `compact` is the 520px window of the "not found" state. The content owns
 * the title as a `DialogTitle`.
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
          'flex flex-col gap-0 overflow-hidden bg-card p-0',
          mobile
            ? 'top-0 left-0 h-dvh w-full max-w-none translate-x-0 translate-y-0 rounded-none sm:max-w-none'
            : compact
              ? 'w-130 max-w-[calc(100%-2rem)] rounded-hero p-5 sm:max-w-130'
              : 'max-h-[calc(100dvh-48px)] w-160 max-w-[calc(100%-2rem)] rounded-hero sm:max-w-160',
        )}
      >
        <DialogDescription className="sr-only">{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Layout A of every lesson window: the indigo band, the body and the pinned
 * footer.
 *
 * - Desktop: the band stays put, only the body scrolls, and the footer holds
 *   an optional note on the left and the actions on the right.
 * - Phone: the band and the body scroll together; the footer is pinned, its
 *   note centred above equal-width actions.
 */
export function LessonWindowLayout({
  mobile,
  band,
  children,
  footer,
  footerNote,
}: {
  mobile: boolean;
  band: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** The result before saving, e.g. "3 заняття · з пакета". */
  footerNote?: ReactNode;
}) {
  const body = (
    <div className={cn('flex flex-col gap-5.5', mobile ? 'px-4 pt-5 pb-6' : 'px-6 pt-5.5 pb-6')}>
      {children}
    </div>
  );

  const footerBlock = footer ? (
    <div
      className={cn(
        'shrink-0 border-t border-border bg-card',
        mobile
          ? 'flex flex-col gap-2.5 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]'
          : 'flex items-center gap-3 px-6 pt-4 pb-6',
      )}
    >
      {footerNote ? (
        <div
          className={cn(
            'min-w-0 text-[13px] leading-[18px] text-muted-foreground',
            mobile ? 'text-center' : 'grow',
          )}
        >
          {footerNote}
        </div>
      ) : mobile ? null : (
        <span className="grow" />
      )}
      <div className={cn('flex gap-3', mobile && '*:flex-1')}>{footer}</div>
    </div>
  ) : null;

  if (mobile) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          {band}
          {body}
        </div>
        {footerBlock}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {band}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">{body}</div>
      {footerBlock}
    </div>
  );
}
