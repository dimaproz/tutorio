import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * A titled aside block: a heading, an optional action on the right, and a
 * stack of rows. The rows themselves are the caller's, typically `ContactRow`
 * or `PersonItem`.
 */
export function InfoCard({
  title,
  action,
  children,
  tone = 'surface',
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  tone?: 'surface' | 'info' | 'warning' | 'indigo';
  className?: string;
}) {
  return (
    <Card tone={tone} className={cn('gap-4 p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </Card>
  );
}
