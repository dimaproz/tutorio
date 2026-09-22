import type { ComponentType, ReactNode } from 'react';
import { EmptyState } from '@/components/shared/empty-state';

/** Standard empty collection state used by every entity list. */
export function CollectionEmptyState({
  icon: Icon,
  title,
  description,
  action,
  framed = true,
  minHeight,
}: {
  icon: ComponentType<{ className?: string }>;
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  framed?: boolean;
  minHeight?: number;
}) {
  return (
    <EmptyState
      icon={<Icon />}
      title={title}
      text={description}
      action={action}
      framed={framed}
      minHeight={minHeight}
    />
  );
}
