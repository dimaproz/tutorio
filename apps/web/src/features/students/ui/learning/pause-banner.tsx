'use client';

import { CalendarClockIcon, PauseIcon, PencilIcon, PlayIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PauseResponse, StudentBillingResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/shared/notice';
import { directionName } from '@/features/students/model/learning';
import { lastPauseDay } from '@/features/students/model/pause';
import { usePauseLabels } from './pause-labels';
import type { LearningActions } from './use-learning-actions';
import { useLearningFormat } from './use-learning-format';

/**
 * The pause banner above the hero (S06 decision 9): a scheduled pause says
 * what it will do, with «Змінити» and «Скасувати паузу»; a running
 * whole-student pause says what it did and when the student comes back, with
 * «Повернути зараз» and «Змінити». A running pause of one direction shows on
 * its pass instead.
 */
export function PauseBanner({
  pause,
  firstName,
  billing,
  actions,
  readOnly = false,
}: {
  pause: PauseResponse;
  firstName: string;
  billing: StudentBillingResponse | undefined;
  actions: LearningActions;
  readOnly?: boolean;
}) {
  const t = useTranslations('students.pauseBanner');
  const format = useLearningFormat();
  const labels = usePauseLabels();
  const scheduled = pause.state === 'SCHEDULED';
  const direction = pause.enrollmentId
    ? billing?.directions.find((row) => row.enrollmentId === pause.enrollmentId)
    : undefined;
  const packages = billing?.directions.flatMap((row) => row.packages) ?? [];
  const extension = pause.extensions.find((row) => row.extendedBySeconds > 0);
  const pkg = extension ? packages.find((row) => row.id === extension.packageId) : undefined;
  const reason = labels.reason(pause.reason);
  const last = pause.endsAt ? lastPauseDay(pause.endsAt) : null;

  const title = [
    scheduled
      ? last
        ? t(direction ? 'scheduledDirection' : 'scheduled', {
            range: format.dayRange(pause.startsAt, last),
            name: direction ? directionName(direction) : '',
          })
        : t(direction ? 'scheduledOpenDirection' : 'scheduledOpen', {
            date: format.dayMonth(pause.startsAt),
            name: direction ? directionName(direction) : '',
          })
      : last
        ? t('running', { name: firstName, date: format.dayMonth(last) })
        : t('runningOpen', { name: firstName }),
    reason,
  ]
    .filter(Boolean)
    .join(' · ');

  const packageText = pkg
    ? scheduled
      ? t('packageWillExtend', {
          name: pkg.name ?? t('packageUnnamed'),
          count: Math.round(extension!.extendedBySeconds / 86_400),
        })
      : pkg.expiresAt
        ? t('packageExtended', {
            name: pkg.name ?? t('packageUnnamed'),
            date: format.dayMonth(new Date(Date.parse(pkg.expiresAt) - 1)),
          })
        : null
    : null;
  const text = [
    scheduled
      ? t('willRemove', { count: pause.removedLessons })
      : t('removed', { count: pause.removedLessons }),
    packageText,
  ]
    .filter(Boolean)
    .join(', ');
  const back = !scheduled
    ? pause.endsAt
      ? t('backOn', { date: format.dayMonth(pause.endsAt) })
      : t('backByHand')
    : null;

  const change = (
    <Button type="button" variant="white" size="xs" onClick={() => actions.changePause(pause)}>
      <PencilIcon data-icon="inline-start" />
      {t('change')}
    </Button>
  );

  return (
    <Notice
      tone="info"
      icon={scheduled ? <CalendarClockIcon /> : <PauseIcon />}
      title={title}
      text={`${text}.${back ? ` ${back}` : ''}`}
      actionPlacement="stacked"
      action={
        readOnly ? undefined : (
          <div className="flex flex-wrap gap-2">
            {scheduled ? (
              <>
                {change}
                <Button
                  type="button"
                  variant="white"
                  size="xs"
                  onClick={() => actions.endPause(pause)}
                >
                  <XIcon data-icon="inline-start" />
                  {t('cancel')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="white"
                  size="xs"
                  onClick={() => actions.endPause(pause)}
                >
                  <PlayIcon data-icon="inline-start" />
                  {t('returnNow')}
                </Button>
                {change}
              </>
            )}
          </div>
        )
      }
    />
  );
}
