import type { ReactNode } from 'react';

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
  /** `wide` is the Studio 2.1/1 split with a tighter gutter. */
  ratio?: 'thirds' | 'wide';
}) {
  if (loading || error) {
    return <section className="flex flex-col gap-6">{loading ?? error}</section>;
  }

  if (ratio === 'wide') {
    return (
      <section className="flex flex-col gap-6">
        {back}
        {identity}
        {metrics}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">{main}</div>
          {aside ? <aside className="flex flex-col gap-4">{aside}</aside> : null}
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
        <div className={aside ? 'flex flex-col gap-6 lg:col-span-2' : 'lg:col-span-3'}>{main}</div>
        {aside ? <aside className="flex flex-col gap-6">{aside}</aside> : null}
      </div>
    </section>
  );
}
