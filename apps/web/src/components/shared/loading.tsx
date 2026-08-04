'use client';

import { useTranslations } from 'next-intl';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

// One loading language for the whole product: a spinner floating on a blurred
// scrim. Stale content stays readable underneath instead of being swapped for
// a skeleton, so nothing jumps when the data lands.

/** Spinner scale: the bigger the area being covered, the bigger the spinner. */
export type LoadingSize = 'sm' | 'md' | 'lg' | 'xl';

const spinnerSizeClass: Record<LoadingSize, string> = {
  sm: 'size-5',
  md: 'size-8',
  lg: 'size-11',
  xl: 'size-14',
};

export function LoadingOverlay({
  className,
  size = 'md',
}: {
  className?: string;
  size?: LoadingSize;
}) {
  const t = useTranslations('common');

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'absolute inset-0 z-20 grid place-items-center rounded-[inherit] bg-background/40 backdrop-blur-[3px]',
        className,
      )}
    >
      <Spinner
        className={cn('text-primary', spinnerSizeClass[size])}
        role="presentation"
        aria-hidden="true"
      />
      <span className="sr-only">{t('loading')}</span>
    </div>
  );
}

/**
 * Wraps content that has to keep its place while it refreshes — a table, a
 * card, a calendar grid. The overlay only mounts while `loading` is true.
 */
export function LoadingRegion({
  loading,
  className,
  size = 'md',
  children,
}: {
  loading: boolean;
  className?: string;
  size?: LoadingSize;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('relative', className)} aria-busy={loading || undefined}>
      <div className={loading ? 'pointer-events-none select-none' : undefined}>{children}</div>
      {loading ? <LoadingOverlay size={size} /> : null}
    </div>
  );
}

/** First load, when there is no content yet for the overlay to sit on. */
export function LoadingPanel({
  className,
  size = 'md',
}: {
  className?: string;
  size?: LoadingSize;
}) {
  return (
    <div className={cn('relative min-h-64 rounded-2xl border bg-card', className)}>
      <LoadingOverlay size={size} />
    </div>
  );
}

/** Whole-screen boot state: the session check before the shell can render. */
export function LoadingScreen() {
  return (
    <div className="relative grid min-h-svh flex-1 place-items-center">
      <LoadingOverlay className="bg-transparent backdrop-blur-none" size="xl" />
    </div>
  );
}
