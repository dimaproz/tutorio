'use client';

import type { ComponentType, ReactNode } from 'react';
import { sectionToneClass, type SectionTone } from '@/components/app/section-tone';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type IconType = ComponentType<{ className?: string }>;

/**
 * A single headline number with its label — the TailAdmin analytics stat card.
 * Shared by the dashboard and the finance screens so KPI figures look the same
 * wherever they appear.
 */
export function StatTile({
  label,
  value,
  icon: Icon,
  tone = 'primary',
  hint,
  isLoading = false,
}: {
  label: string;
  value: ReactNode;
  icon?: IconType;
  tone?: SectionTone;
  hint?: ReactNode;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        {Icon ? (
          <span
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-xl',
              sectionToneClass[tone],
            )}
          >
            <Icon className="size-5" />
          </span>
        ) : null}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-muted-foreground text-sm font-medium">{label}</span>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <span className="tabular text-2xl font-semibold tracking-tight">{value}</span>
          )}
          {hint ? (
            <span className="text-muted-foreground text-xs">{hint}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
