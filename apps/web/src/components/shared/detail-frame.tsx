import type { ReactNode } from 'react';

/**
 * Domain-neutral detail layout. Identity, actions, data, and feedback remain
 * feature slots; the frame owns only the responsive main/aside structure.
 */
export function DetailFrame({
  back,
  identity,
  main,
  aside,
  loading,
  error,
}: {
  back?: ReactNode;
  identity?: ReactNode;
  main?: ReactNode;
  aside?: ReactNode;
  loading?: ReactNode;
  error?: ReactNode;
}) {
  if (loading || error) {
    return <section className="flex flex-col gap-6">{loading ?? error}</section>;
  }

  return (
    <section className="flex flex-col gap-6">
      {back}
      {identity}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className={aside ? 'flex flex-col gap-6 lg:col-span-2' : 'lg:col-span-3'}>{main}</div>
        {aside ? <aside className="flex flex-col gap-6">{aside}</aside> : null}
      </div>
    </section>
  );
}
