import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Domain-neutral detail layout. Identity, actions, data, and feedback remain
 * feature slots; the frame owns only the responsive main/aside structure.
 */
export function DetailFrame({
  back,
  identity,
  metrics,
  main,
  aside,
  loading,
  error,
  ratio = 'thirds',
}: {
  back?: ReactNode;
  identity?: ReactNode;
  /** Full-width metric band between the identity block and the columns. */
  metrics?: ReactNode;
  main?: ReactNode;
  aside?: ReactNode;
  loading?: ReactNode;
  error?: ReactNode;
  /**
   * `wide` is the Studio 2.1/1 split with a tighter gutter; `balanced` the
   * 1.55/1 split of the group page, whose aside carries more.
   */
  ratio?: 'thirds' | 'wide' | 'balanced';
}) {
  if (loading || error) {
    return <section className="flex flex-col gap-6">{loading ?? error}</section>;
  }

  if (ratio === 'wide' || ratio === 'balanced') {
    return (
      <section className="flex flex-col gap-6">
        {back}
        {identity}
        {metrics}
        <div
          className={cn(
            'grid gap-4',
            ratio === 'wide'
              ? 'lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]'
              : 'items-start lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]',
          )}
        >
          <div className="flex min-w-0 flex-col gap-4">{main}</div>
          {aside ? <aside className="flex min-w-0 flex-col gap-4">{aside}</aside> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      {back}
      {identity}
      {metrics}
      <div className="grid gap-6 lg:grid-cols-3">
        <div
          className={
            aside ? 'flex min-w-0 flex-col gap-6 lg:col-span-2' : 'min-w-0 lg:col-span-3'
          }
        >
          {main}
        </div>
        {aside ? <aside className="flex min-w-0 flex-col gap-6">{aside}</aside> : null}
      </div>
    </section>
  );
}
