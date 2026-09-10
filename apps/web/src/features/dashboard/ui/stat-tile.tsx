'use client';

import type { ComponentType, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

type IconType = ComponentType<{ className?: string }>;

/**
 * A dashboard-only headline metric; entity metrics use shared MetricCard.
 */
export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  isLoading = false,
}: {
  label: string;
  value: ReactNode;
  icon?: IconType;
  hint?: ReactNode;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        {Icon ? (
          <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : null}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-muted-foreground text-sm font-medium">{label}</span>
          {isLoading ? (
            <Spinner className="my-1 size-6 text-primary" />
          ) : (
            <span className="tabular text-2xl font-semibold tracking-tight">{value}</span>
          )}
          {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
