import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Six product statuses driven by semantic CSS variables — never raw Tailwind
// colours. `cancelled` also carries a strike, so the state survives a
// greyscale print and does not rely on hue alone.
export const STATUSES = {
  active: { label: 'Активний', variant: 'primary' },
  paused: { label: 'Призупинено', variant: 'warning' },
  overdue: { label: 'Прострочено', variant: 'destructive' },
  paid: { label: 'Оплачено', variant: 'success' },
  cancelled: { label: 'Скасовано', variant: 'secondary' },
  archived: { label: 'В архіві', variant: 'secondary' },
} as const;

export type StatusKey = keyof typeof STATUSES;

export function StatusBadge({ status, className }: { status: StatusKey; className?: string }) {
  const { label, variant } = STATUSES[status];

  return (
    <Badge
      variant={variant}
      className={cn(status === 'cancelled' && 'line-through decoration-1', className)}
    >
      {label}
    </Badge>
  );
}
