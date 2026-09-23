import type { ReactNode } from 'react';
import { ArchiveIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * The destructive block at the end of an edit form: a danger-tinted card with
 * an icon tile, a title, one line saying exactly what is lost and what is not,
 * and the action. It exists so deleting a record never sits in the same
 * visual weight as saving it, and never in the sticky save bar.
 *
 * The action opens the caller's `ConfirmDialog tone="danger"`. A viewer who
 * cannot perform it must not get this block at all: the caller renders
 * nothing rather than a disabled one.
 */
export function DangerZone({
  title,
  text,
  action,
  onAction,
  icon,
  disabled = false,
}: {
  title: ReactNode;
  /** What exactly is destroyed, and what is not. */
  text: ReactNode;
  /** Label of the destructive button. */
  action: string;
  onAction: () => void;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Card
      tone="danger"
      data-slot="danger-zone"
      className="flex-col items-start gap-4 px-5 py-5.5 sm:flex-row sm:items-center md:px-6"
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-control bg-tint-danger-foreground/12 [&_svg]:size-5"
      >
        {icon ?? <ArchiveIcon />}
      </span>
      <div className="flex min-w-0 grow flex-col gap-0.75">
        <h2 className="text-[15px] leading-5 font-semibold">{title}</h2>
        <p className="text-[13px] leading-[18px]">{text}</p>
      </div>
      <Button type="button" variant="danger" disabled={disabled} onClick={onAction}>
        <XIcon data-icon="inline-start" />
        {action}
      </Button>
    </Card>
  );
}
