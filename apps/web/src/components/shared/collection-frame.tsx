import type { ReactNode } from 'react';

/**
 * Domain-neutral collection layout. Features own queries, filters, columns,
 * mobile cards, and every slot's localized content.
 */
export function CollectionFrame({
  header,
  summary,
  toolbar,
  refresh,
  loading,
  error,
  empty,
  desktop,
  mobile,
  pagination,
}: {
  header: ReactNode;
  /** Optional feature-owned summary, such as collection-level metrics. */
  summary?: ReactNode;
  toolbar?: ReactNode;
  refresh?: ReactNode;
  loading?: ReactNode;
  error?: ReactNode;
  empty?: ReactNode;
  desktop?: ReactNode;
  mobile?: ReactNode;
  pagination?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6">
      {header}
      {summary}
      {toolbar}
      {refresh}
      {loading}
      {error}
      {empty ?? (
        <>
          {mobile ? <div className="flex flex-col gap-3 md:hidden">{mobile}</div> : null}
          {desktop ? <div className={mobile ? 'hidden md:block' : undefined}>{desktop}</div> : null}
          {pagination}
        </>
      )}
    </section>
  );
}
