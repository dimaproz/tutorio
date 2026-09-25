'use client';

import { AlertCircleIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TITLE_SIZE = {
  default: 'text-xl font-semibold tracking-tight md:text-2xl',
  md: 'text-[26px] leading-8 font-semibold tracking-[-0.03em] md:text-[32px] md:leading-[38px]',
  lg: 'text-[34px] leading-[38px] font-semibold tracking-[-0.035em] md:text-5xl md:leading-[52px]',
  xl: 'text-[40px] leading-[42px] font-semibold tracking-[-0.04em] md:text-[64px] md:leading-16',
} as const;

/**
 * The page title block: the one `h1`, a subtitle and the page's primary
 * actions aligned to the title's baseline. `md` titles a working screen
 * (the calendar), `lg` a form page, `xl` a collection; `default` remains for
 * screens not yet migrated to Studio.
 */
export function PageHeader({
  title,
  description,
  action,
  size = 'default',
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  size?: keyof typeof TITLE_SIZE;
}) {
  const studio = size !== 'default';

  return (
    <div
      className={cn(
        studio
          ? 'flex flex-row items-end justify-between gap-3 md:gap-6'
          : 'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
      )}
    >
      <div className={cn('flex min-w-0 flex-col', studio ? 'gap-1 md:gap-2' : 'gap-1')}>
        <h1 className={TITLE_SIZE[size]}>{title}</h1>
        {description ? (
          <p
            className={cn(
              'text-muted-foreground',
              studio ? 'text-sm md:text-base md:leading-6' : 'text-sm',
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{action}</div> : null}
    </div>
  );
}

export function QueryErrorAlert({
  error,
  message,
  title,
  onRetry,
}: {
  /** Retained while legacy features migrate to their localized `message` slot. */
  error?: unknown;
  /** Feature-owned, localized error copy. Falls back to the generic message. */
  message?: React.ReactNode;
  title: string;
  onRetry: () => void;
}) {
  void error;
  const t = useTranslations('errors');
  const tCommon = useTranslations('common');

  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <span>{message ?? t('generic')}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {tCommon('retry')}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
