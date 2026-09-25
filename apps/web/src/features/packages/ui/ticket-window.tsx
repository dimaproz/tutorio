'use client';

import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription } from '@/components/ui/drawer';

/**
 * The ticket modal's window (S07 board 02, components): on desktop the
 * 580px ticket centred over the scrim, 24px from the top and bottom, the
 * whole ticket scrolling (a click beside it closes it); on phones a bottom
 * sheet that leaves 44px of the page above it and scrolls, its handle drawn
 * on the stub. The content owns the title.
 */
export function TicketWindow({
  open,
  onOpenChange,
  mobile,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mobile: boolean;
  description: string;
  children: ReactNode;
}) {
  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[calc(100dvh-44px)] pb-0 before:hidden data-[vaul-drawer-direction=bottom]:pb-0 [&>div:first-child]:hidden">
          <DrawerDescription className="sr-only">{description}</DrawerDescription>
          <div
            data-slot="ticket-window"
            className="scrollbar-thin min-h-0 overflow-y-auto rounded-t-card"
          >
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        data-slot="ticket-window"
        className="scrollbar-thin top-0 left-0 block h-dvh w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none bg-transparent p-6 shadow-none sm:max-w-none"
        onClick={(event) => {
          if (event.target === event.currentTarget) onOpenChange(false);
        }}
      >
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <div className="mx-auto w-145 max-w-full rounded-hero shadow-dialog">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
