'use client';

import { AlertCircleIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export function PageHeader({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Visible but non-blocking feedback while cached query data is refreshing. */
export function QueryRefreshIndicator({ isFetching }: { isFetching: boolean }) {
  const t = useTranslations('common');

  if (!isFetching) {
    return null;
  }

  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner aria-hidden="true" />
      {t('loading')}
    </span>
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
