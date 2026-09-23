'use client';

import type { ReactNode } from 'react';
import { XIcon } from 'lucide-react';
import { LinkPicker, type LinkPickerProps } from '@/components/shared/link-picker';
import { IconButton } from '@/components/shared/icon-button';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Spinner } from '@/components/ui/spinner';
import { useIsMobile } from '@/hooks/use-mobile';

/** The picker props the dialog passes through; framing and the linked list are its own. */
type PickerProps = Omit<
  LinkPickerProps,
  | 'title'
  | 'description'
  | 'tag'
  | 'icon'
  | 'framed'
  | 'linked'
  | 'showLinked'
  | 'linkedLabel'
  | 'emptyText'
  | 'onUnlink'
  | 'unlinkLabel'
  | 'fieldLabel'
  | 'open'
  | 'onOpenChange'
  | 'popover'
  | 'hint'
  | 'autoFocus'
>;

export type LinkPickerDialogProps = PickerProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** The record being linked to, e.g. the student's name. */
  subtitle?: ReactNode;
  /** Defaults to a modal from `sm` up and a bottom sheet on phones. */
  layout?: 'modal' | 'sheet';
  /** The count is the caller's: "Link · 2". */
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  onConfirm: (ids: string[]) => void;
  /** Disables the picker and the confirm while saving. */
  busy?: boolean;
};

/**
 * `LinkPicker` in a 520px modal on desktop and a bottom sheet on phones: a
 * title naming the job, a subtitle naming the record, and the confirm. The
 * sheet has the grab handle and one full-width confirm; the modal also offers
 * cancel. Confirm is disabled while nothing is picked.
 */
export function LinkPickerDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  layout,
  confirmLabel,
  cancelLabel,
  closeLabel,
  onConfirm,
  busy = false,
  selected,
  disabled,
  ...picker
}: LinkPickerDialogProps) {
  const mobile = useIsMobile();
  const sheet = (layout ?? (mobile ? 'sheet' : 'modal')) === 'sheet';
  const locked = busy || disabled;

  const body = (
    <LinkPicker
      {...picker}
      selected={selected}
      disabled={locked}
      framed={false}
      showLinked={false}
      popover={false}
      open
      autoFocus={!sheet}
      hint={!sheet}
    />
  );
  const confirm = (
    <Button
      type="button"
      size={sheet ? 'xl' : 'default'}
      className={sheet ? 'w-full' : undefined}
      disabled={locked || selected.length === 0}
      onClick={() => onConfirm(selected)}
    >
      {busy ? <Spinner data-icon="inline-start" /> : null}
      {confirmLabel}
    </Button>
  );
  const close = (
    <IconButton size={36} tone="ghost" icon={<XIcon />} label={closeLabel} disabled={busy} />
  );

  if (sheet) {
    return (
      <Drawer open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
        <DrawerContent>
          <DrawerHeader className="flex-row items-start justify-between gap-4 px-4 pt-3 pb-0 text-left">
            <div className="flex flex-col gap-0.5">
              <DrawerTitle className="text-lg leading-6 font-semibold">{title}</DrawerTitle>
              {subtitle ? (
                <DrawerDescription className="text-[13px] leading-[18px]">
                  {subtitle}
                </DrawerDescription>
              ) : null}
            </div>
            <DrawerClose asChild>{close}</DrawerClose>
          </DrawerHeader>
          <div className="min-h-0 overflow-x-hidden overflow-y-auto px-4 pt-3.5 pb-1">{body}</div>
          <DrawerFooter className="px-4 pt-3.5">{confirm}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogContent showCloseButton={false} className="gap-4 sm:max-w-130">
        <DialogHeader className="flex-row items-start justify-between gap-4 text-left">
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="text-xl leading-[26px] font-semibold">{title}</DialogTitle>
            {subtitle ? (
              <DialogDescription className="text-[13px] leading-[18px]">
                {subtitle}
              </DialogDescription>
            ) : null}
          </div>
          <DialogClose asChild>{close}</DialogClose>
        </DialogHeader>
        {/* The inset keeps the focus ring of the search field clear of the clip. */}
        <div className="-m-1 max-h-[min(440px,55vh)] min-h-0 overflow-x-hidden overflow-y-auto p-1">
          {body}
        </div>
        <DialogFooter className="gap-2.5">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={busy}>
              {cancelLabel}
            </Button>
          </DialogClose>
          {confirm}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
