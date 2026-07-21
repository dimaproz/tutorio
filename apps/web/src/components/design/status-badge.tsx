import { cn } from '@/lib/utils';

// Six product statuses driven by semantic CSS variables — never raw Tailwind
// colours. `cancelled` also carries a strike, so the state survives a
// greyscale print and does not rely on hue alone.
export const STATUSES = {
  active: { label: 'Активний', token: 'active' },
  paused: { label: 'Призупинено', token: 'paused' },
  overdue: { label: 'Прострочено', token: 'overdue' },
  paid: { label: 'Оплачено', token: 'paid' },
  cancelled: { label: 'Скасовано', token: 'cancelled' },
  archived: { label: 'В архіві', token: 'archived' },
} as const;

export type StatusKey = keyof typeof STATUSES;

export function StatusBadge({
  status,
  className,
}: {
  status: StatusKey;
  className?: string;
}) {
  const { label, token } = STATUSES[status];

  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap',
        status === 'cancelled' && 'line-through decoration-1',
        className,
      )}
      style={{
        backgroundColor: `var(--status-${token}-wash)`,
        color: `var(--status-${token})`,
      }}
    >
      {label}
    </span>
  );
}
