'use client';

import type { ReactNode } from 'react';
import { AlertCircleIcon, FileTextIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const TONE = {
  danger: {
    tile: 'bg-tint-danger text-tint-danger-foreground',
    action: 'danger',
    Icon: AlertCircleIcon,
  },
  neutral: {
    tile: 'bg-tint-indigo text-tint-indigo-foreground',
    action: 'primary',
    Icon: FileTextIcon,
  },
} as const;

export type ConfirmDialogTone = keyof typeof TONE;

/**
 * Every confirmation goes through this dialog: an icon tile, a title, what
 * the action will do, and cancel / confirm. `danger` is for commands that
 * lose or hide work (discard changes, archive); `neutral` for the rest.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  pending = false,
  tone = 'danger',
  icon,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
  tone?: ConfirmDialogTone;
  /** Overrides the tone's default glyph. */
  icon?: ReactNode;
}) {
  const t = useTranslations('common');
  const { tile, action, Icon } = TONE[tone];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-105">
        <AlertDialogHeader className="grid-cols-[auto_1fr] grid-rows-none place-items-start gap-x-3.5 gap-y-1 text-left">
          <span
            aria-hidden="true"
            className={cn(
              'row-span-2 flex size-11 items-center justify-center rounded-item [&_svg]:size-5',
              tile,
            )}
          >
            {icon ?? <Icon />}
          </span>
          <AlertDialogTitle className="text-lg leading-6 font-semibold">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-5">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2.5">
          <AlertDialogCancel disabled={pending}>{cancelLabel ?? t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant={action}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            disabled={pending}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
