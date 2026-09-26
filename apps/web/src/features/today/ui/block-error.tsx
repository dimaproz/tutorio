'use client';

import { RotateCcwIcon, TriangleAlertIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

/**
 * A block that failed to load (S11 state 14): the reason inside the block and
 * «Спробувати ще»; the rest of the page keeps working.
 */
export function BlockError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('today.error');
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-control bg-tint-danger text-tint-danger-foreground [&_svg]:size-4.5"
        >
          <TriangleAlertIcon />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] leading-5 font-semibold">{t('title')}</span>
          <span className="text-[13px] leading-[18px] text-muted-foreground">{t('text')}</span>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <RotateCcwIcon data-icon="inline-start" />
        {t('retry')}
      </Button>
    </div>
  );
}
