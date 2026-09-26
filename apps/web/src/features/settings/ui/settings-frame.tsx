'use client';

import { useState, type ReactNode } from 'react';
import { RotateCcwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ActionBar } from '@/components/shared/action-bar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Notice } from '@/components/shared/notice';
import { PageHeader } from '@/components/shared/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

/** «● змінено» beside the label of a setting that differs from the saved one. */
export function ChangedMark() {
  const t = useTranslations('settings.page');
  return (
    <span className="inline-flex items-center gap-1.5 text-xs leading-4 font-semibold text-tint-warning-foreground">
      <span aria-hidden="true" className="size-1.5 rounded-pill bg-warning" />
      {t('changed')}
    </span>
  );
}

/** A setting's label with its «змінено» mark and the hint under it. */
export function SettingHeading({
  id,
  title,
  hint,
  changed,
}: {
  id: string;
  title: ReactNode;
  hint?: ReactNode;
  changed: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h2 id={id} className="text-[15px] leading-5 font-bold">
          {title}
        </h2>
        {changed ? <ChangedMark /> : null}
      </div>
      {hint ? <p className="text-[13px] leading-[19px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * A settings page (S10 boards 02 and 03): the title, one card of at most
 * 920px and the save bar. The bar reads «Усі зміни збережено» or how many
 * changes wait, with «Скасувати» and «Зберегти» (phones: «Зберегти» only, above
 * the tab bar). Leaving with unsaved changes asks first.
 */
export function SettingsFrame({
  title,
  subtitle,
  changed,
  saving,
  error,
  onCancel,
  onRetry,
  children,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  /** How many settings differ from the saved ones. */
  changed: number;
  saving: boolean;
  /** The failed save's message, shown above the card with a retry. */
  error?: string | null;
  onCancel: () => void;
  onRetry: () => void;
  children: ReactNode;
}) {
  const t = useTranslations('settings.page');
  const router = useRouter();
  const mobile = useIsMobile();
  const [leavingTo, setLeavingTo] = useState<string | null>(null);

  useLeaveGuard(changed > 0 && !saving, setLeavingTo);

  const note = saving ? t('saving') : changed > 0 ? t('unsaved', { count: changed }) : t('saved');

  return (
    <div className="flex flex-col gap-5 md:gap-7">
      <PageHeader size="lg" title={title} description={subtitle} />
      {error ? (
        <Notice
          tone="danger"
          title={t('saveErrorTitle')}
          text={error}
          action={
            <Button type="button" variant="white" size="xs" disabled={saving} onClick={onRetry}>
              <RotateCcwIcon data-icon="inline-start" />
              {t('save')}
            </Button>
          }
        />
      ) : null}
      <Card className="w-full max-w-[920px] py-0">
        <CardContent className="flex flex-col gap-7 px-5 py-6 md:px-9 md:py-8">
          {children}
        </CardContent>
      </Card>
      <ActionBar
        tone={changed > 0 ? 'warning' : 'success'}
        note={note}
        className={cn(mobile && 'bottom-[calc(var(--mobile-tab-bar-height)+16px)]')}
        secondary={
          mobile ? undefined : (
            <Button
              type="button"
              variant="outline"
              disabled={changed === 0 || saving}
              onClick={onCancel}
            >
              {t('cancel')}
            </Button>
          )
        }
        primary={
          <Button type="submit" disabled={changed === 0 || saving}>
            {saving ? <Spinner data-icon="inline-start" /> : null}
            {t('save')}
          </Button>
        }
      />
      <ConfirmDialog
        open={leavingTo !== null}
        onOpenChange={(open) => !open && setLeavingTo(null)}
        tone="danger"
        title={t('discardTitle')}
        description={t('discardText')}
        confirmLabel={t('discardAction')}
        cancelLabel={t('stay')}
        onConfirm={() => {
          const href = leavingTo;
          setLeavingTo(null);
          onCancel();
          if (href) router.push(href);
        }}
      />
    </div>
  );
}
