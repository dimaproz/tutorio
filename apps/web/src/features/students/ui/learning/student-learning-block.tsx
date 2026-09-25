'use client';

import { PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PauseResponse, ScheduleResponse, StudentBillingResponse } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { QueryErrorAlert } from '@/components/shared/page-shell';
import {
  currencyChips,
  directionName,
  passView,
  scheduleOf,
  visibleDirections,
} from '@/features/students/model/learning';
import { DirectionMenu } from './direction-menu';
import { DirectionPass } from './direction-pass';
import type { LearningActions } from './use-learning-actions';
import { useLearningFormat } from './use-learning-format';

/**
 * «Навчання й оплата» (S06 board 01): the student's directions as passes
 * stacked one under another, under the metrics and above the tabs. The
 * header counts the directions and, with more than one currency, shows what
 * is owed and paid ahead per currency — never summed into one number.
 */
export function StudentLearningBlock({
  billing,
  pauses,
  schedules,
  actions,
  error,
  onRetry,
  onOpenPackage,
  readOnly = false,
}: {
  billing: StudentBillingResponse | undefined;
  pauses: readonly PauseResponse[];
  schedules: readonly ScheduleResponse[];
  actions: LearningActions;
  error?: unknown;
  onRetry?: () => void;
  /** Opens a package's ticket (S07). */
  onOpenPackage?: (packageId: string) => void;
  readOnly?: boolean;
}) {
  const t = useTranslations('students.learningBlock');
  const format = useLearningFormat();
  const directions = billing ? visibleDirections(billing.directions) : [];
  const chips = billing ? currencyChips(billing.totals) : [];
  const currencies = new Set(directions.map((direction) => direction.currency));

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
        <h2 className="flex items-baseline gap-2.5 text-xl leading-7 font-semibold tracking-[-0.01em]">
          {t('title')}
          {directions.length > 1 ? (
            <span className="text-sm font-normal text-muted-foreground">
              {t('count', { count: directions.length })}
            </span>
          ) : null}
        </h2>
        {currencies.size > 1
          ? chips.map((chip) => (
              <Badge
                key={`${chip.kind}-${chip.currency}`}
                variant={chip.kind === 'debt' ? 'danger' : 'success'}
                size="lg"
              >
                {t(chip.kind === 'debt' ? 'chipDebt' : 'chipAdvance', {
                  amount: format.money(chip.amountMinor, chip.currency),
                })}
              </Badge>
            ))
          : null}
      </div>
      {readOnly ? null : (
        <Button type="button" variant="outline" size="sm" onClick={actions.newDirection}>
          <PlusIcon data-icon="inline-start" />
          {t('add')}
        </Button>
      )}
    </div>
  );

  if (!billing) {
    return (
      <section aria-label={t('title')} className="flex flex-col gap-3">
        {header}
        {error ? (
          <QueryErrorAlert
            error={error}
            title={t('error')}
            onRetry={onRetry ?? (() => undefined)}
          />
        ) : (
          <Skeleton className="h-36 w-full rounded-block" />
        )}
      </section>
    );
  }

  return (
    <section aria-label={t('title')} className="flex flex-col gap-3">
      {header}
      {directions.length === 0 ? (
        <EmptyState
          title={t('empty')}
          text={readOnly ? t('emptyArchived') : t('emptyText')}
          minHeight={160}
        />
      ) : (
        directions.map((direction) => {
          const view = passView(direction, pauses, billing.lowCreditThreshold);
          const schedule = scheduleOf(schedules, direction);
          const name = directionName(direction);
          return (
            <DirectionPass
              key={direction.enrollmentId}
              view={view}
              schedule={schedule}
              studioDeadlineHours={billing.cancellationDeadlineHours}
              format={format}
              onPay={readOnly ? undefined : () => actions.pay(direction.enrollmentId)}
              onSell={readOnly ? undefined : () => actions.sell(direction.enrollmentId)}
              onOpenPackage={onOpenPackage}
              onReturn={readOnly || !view.pause ? undefined : () => actions.endPause(view.pause!)}
              menu={
                readOnly || direction.status === 'ARCHIVED' ? undefined : (
                  <DirectionMenu
                    name={name}
                    subtitle={
                      direction.group
                        ? t('subtitleGroup', { teacher: direction.teacher.name })
                        : t('subtitleIndividual', { teacher: direction.teacher.name })
                    }
                    paused={view.action === 'return'}
                    onAction={(action) => {
                      if (action === 'pay') actions.pay(direction.enrollmentId);
                      if (action === 'sell') actions.sell(direction.enrollmentId);
                      if (action === 'settings') actions.settings(direction.enrollmentId);
                      if (action === 'schedule') actions.schedule(direction, schedule);
                      if (action === 'pause') actions.pause(direction.enrollmentId);
                      if (action === 'return' && view.pause) actions.endPause(view.pause);
                      if (action === 'end') actions.endDirection(direction.enrollmentId);
                    }}
                  />
                )
              }
            />
          );
        })
      )}
    </section>
  );
}
