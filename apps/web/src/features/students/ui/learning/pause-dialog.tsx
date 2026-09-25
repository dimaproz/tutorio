'use client';

import { useMemo, useState } from 'react';
import {
  BanknoteIcon,
  BookOpenIcon,
  CalendarPlusIcon,
  CirclePauseIcon,
  LayersIcon,
  PauseIcon,
  RepeatIcon,
  Trash2Icon,
  UsersIcon,
} from 'lucide-react';
import { useNow, useTranslations } from 'next-intl';
import { Controller, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { PausePreviewResponse, PauseResponse, ScheduleConflict } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { ChoiceCardGroup } from '@/components/shared/choice-card';
import { DateField } from '@/components/shared/date-field';
import { EntityPicker } from '@/components/shared/entity-picker';
import { ImpactList, type ImpactItem } from '@/components/shared/impact-list';
import { FieldFrame } from '@/components/shared/text-field';
import { ConflictPairs, scheduleConflicts } from '@/features/lessons';
import {
  useCreatePauseMutation,
  usePausePreviewQuery,
  useUpdatePauseMutation,
} from '@/features/students/api';
import { directionName, type BillingDirection } from '@/features/students/model/learning';
import {
  dateKey,
  lastPauseDay,
  PAUSE_REASONS,
  pauseCreateDto,
  pauseFormDefaults,
  pauseFormSchema,
  pausePreviewDto,
  pausePreviewReady,
  pauseUpdateDto,
  type PauseFormValues,
} from '@/features/students/model/pause';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDateFnsLocale } from '@/lib/i18n/format';
import { FooterNote, useBillingErrorToast, useBillingForm } from './dialog-parts';
import { useLearningFormat } from './use-learning-format';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * «Пауза» (board 02, states 08–10; L-100…L-104): the whole student or one
 * direction, from and until (optional: until the tutor brings them back) and
 * why, with what it does before it is saved — the lessons taken off per
 * direction, the packages pushed later, the groups going on without the
 * student and the schedules kept. `pause` changes an existing pause: one that
 * has not begun takes everything, a running one its end and reason.
 */
export function PauseDialog({
  open,
  onOpenChange,
  student,
  directions,
  enrollmentId,
  pause,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: { id: string; fullName: string };
  directions: readonly BillingDirection[];
  /** Opened from a direction: that direction is picked. */
  enrollmentId?: string | null;
  /** The pause to change. */
  pause?: PauseResponse | null;
}) {
  return open ? (
    <PauseForm
      student={student}
      directions={directions}
      enrollmentId={enrollmentId ?? null}
      pause={pause ?? null}
      onOpenChange={onOpenChange}
    />
  ) : null;
}

function PauseForm({
  student,
  directions,
  enrollmentId,
  pause,
  onOpenChange,
}: {
  student: { id: string; fullName: string };
  directions: readonly BillingDirection[];
  enrollmentId: string | null;
  pause: PauseResponse | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('students.pause');
  const format = useLearningFormat();
  const dateLocale = useDateFnsLocale();
  const mobile = useIsMobile();
  const clock = useNow();
  const [today] = useState(() => dateKey(clock));
  const create = useCreatePauseMutation();
  const update = useUpdatePauseMutation();
  const showError = useBillingErrorToast();
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const running = pause?.state === 'ACTIVE';
  const firstName = student.fullName.split(/\s+/)[0] || student.fullName;
  const form = useBillingForm<PauseFormValues>(
    pauseFormSchema,
    pauseFormDefaults({ today, enrollmentId, pause }),
  );
  const values = useWatch({ control: form.control }) as PauseFormValues;
  const ready = pausePreviewReady(values);
  // A key, not the object: the form hands a new object on every render.
  const previewKey = useDebouncedValue(
    ready ? JSON.stringify(pausePreviewDto(values, student.id, today, pause?.id)) : '',
  );
  const preview = usePausePreviewQuery(previewKey ? JSON.parse(previewKey) : null);
  const pending = create.isPending || update.isPending;

  const close = () => onOpenChange(false);
  const save = (mode: 'check' | 'skip') =>
    form.handleSubmit((submitted) => {
      const done = () => {
        toast.success(
          pause
            ? t('changed')
            : t('done', { name: firstName, date: format.dayMonth(`${submitted.from}T12:00`) }),
        );
        close();
      };
      const fail = (error: unknown) => {
        const overlaps = scheduleConflicts(error);
        if (overlaps && overlaps.length > 0) setConflicts(overlaps);
        else showError(error);
      };
      if (pause) {
        update.mutate(
          { pauseId: pause.id, dto: pauseUpdateDto(submitted, pause, today), mode },
          { onSuccess: done, onError: fail },
        );
      } else {
        create.mutate(pauseCreateDto(submitted, student.id, today), {
          onSuccess: done,
          onError: fail,
        });
      }
    })();

  const names = directions.map(directionName);
  const directionOptions = directions.map((direction) => ({
    value: direction.enrollmentId,
    label: directionName(direction),
    description: direction.group
      ? t('groupWith', { teacher: direction.teacher.name })
      : t('individualWith', { teacher: direction.teacher.name }),
    avatarKey: direction.group ? null : direction.teacher.avatarKey,
    media: direction.group ? (
      <span className="flex size-7 items-center justify-center rounded-control bg-tile-indigo text-tile-indigo-foreground [&_svg]:size-4">
        <LayersIcon />
      </span>
    ) : undefined,
  }));

  const impact = usePauseImpact({
    preview: preview.data,
    directions,
    scope: values.scope,
    enrollmentId: values.enrollmentId,
    firstName,
    format,
  });

  return (
    <AdaptiveDialog
      open
      onOpenChange={(next) => (next ? undefined : close())}
      closeLabel={t('close')}
      size="lg"
      sheetLayout="compact"
      icon={<CirclePauseIcon />}
      iconClassName="bg-tint-warning text-tint-warning-foreground"
      title={pause ? t('titleChange') : t('title')}
      description={t('subtitle', { name: student.fullName, count: directions.length })}
      tertiary={
        <FooterNote>
          {values.scope === 'student' ? t('noteStatus') : t('noteStatusStays')}
        </FooterNote>
      }
      secondary={
        <Button type="button" variant="outline" onClick={close}>
          {t('cancel')}
        </Button>
      }
      primary={
        <Button type="button" disabled={pending} onClick={() => save(conflicts ? 'skip' : 'check')}>
          {pending ? (
            <Spinner data-icon="inline-start" />
          ) : pause ? null : (
            <PauseIcon data-icon="inline-start" />
          )}
          {conflicts ? t('saveWithout') : pause ? t('save') : t('confirm')}
        </Button>
      }
    >
      {conflicts ? (
        <ConflictPairs
          conflicts={conflicts}
          durationMin={conflicts[0]?.durationMin ?? 60}
          title={firstName}
          newLabel={t('returns')}
          mobile={mobile}
          heading={t('conflictsTitle', { count: conflicts.length })}
          explanation={t('conflictsText')}
        />
      ) : null}
      <div className="flex flex-col gap-2">
        <span className="text-sm leading-5 font-medium">{t('what')}</span>
        <Controller
          control={form.control}
          name="scope"
          render={({ field }) => (
            <ChoiceCardGroup
              label={t('what')}
              value={field.value}
              disabled={running}
              onValueChange={(next) => {
                field.onChange(next);
                if (next === 'direction' && !form.getValues('enrollmentId') && directions[0]) {
                  form.setValue('enrollmentId', directions[0].enrollmentId);
                }
              }}
              options={[
                {
                  value: 'student',
                  icon: <UsersIcon />,
                  title: t('whole'),
                  hint: names.length > 0 ? format.list(names) : t('wholeHint'),
                },
                {
                  value: 'direction',
                  icon: <BookOpenIcon />,
                  title: t('one'),
                  hint: t('oneHint'),
                },
              ]}
            />
          )}
        />
      </div>
      {values.scope === 'direction' ? (
        <Controller
          control={form.control}
          name="enrollmentId"
          render={({ field, fieldState }) => (
            <FieldFrame label={t('direction')} error={fieldState.error?.message}>
              {(a11y) => (
                <EntityPicker
                  id={a11y.id}
                  aria-describedby={a11y.describedBy}
                  invalid={Boolean(a11y.invalid)}
                  appearance="field"
                  locked={running}
                  value={field.value || undefined}
                  onChange={(next) => field.onChange(next ?? '')}
                  options={directionOptions}
                  placeholder={t('directionPlaceholder')}
                  searchPlaceholder={t('directionSearch')}
                  emptyLabel={t('directionEmpty')}
                />
              )}
            </FieldFrame>
          )}
        />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={form.control}
          name="from"
          render={({ field, fieldState }) => (
            <FieldFrame label={t('from')} error={fieldState.error?.message}>
              {(a11y) => (
                <DateField
                  id={a11y.id}
                  aria-describedby={a11y.describedBy}
                  invalid={Boolean(a11y.invalid)}
                  disabled={running}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  formatValue={format.field}
                  placeholder={t('fromPlaceholder')}
                  locale={dateLocale}
                />
              )}
            </FieldFrame>
          )}
        />
        <Controller
          control={form.control}
          name="until"
          render={({ field, fieldState }) => (
            <FieldFrame
              label={t('until')}
              error={fieldState.error?.message}
              hint={t('untilHint')}
              labelAction={
                field.value ? (
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    className="h-auto p-0"
                    onClick={() => field.onChange('')}
                  >
                    {t('untilClear')}
                  </Button>
                ) : undefined
              }
            >
              {(a11y) => (
                <DateField
                  id={a11y.id}
                  aria-describedby={a11y.describedBy}
                  invalid={Boolean(a11y.invalid)}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  formatValue={format.field}
                  placeholder={t('untilPlaceholder')}
                  locale={dateLocale}
                />
              )}
            </FieldFrame>
          )}
        />
      </div>
      <div className="flex flex-col gap-2.5">
        <span className="text-sm leading-5 font-medium">{t('reason')}</span>
        <Controller
          control={form.control}
          name="reason"
          render={({ field }) => (
            <ToggleGroup
              type="single"
              aria-label={t('reason')}
              value={field.value}
              onValueChange={(next) => (next ? field.onChange(next) : undefined)}
              className="flex-wrap gap-2"
            >
              {PAUSE_REASONS.map((reason) => (
                <ToggleGroupItem
                  key={reason}
                  value={reason}
                  className="h-10 rounded-pill bg-secondary px-4 text-[15px] data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {t(`reasons.${reason}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        />
      </div>
      {!ready ? null : impact ? (
        <ImpactList items={impact} label={t('impactLabel')} />
      ) : preview.isError ? (
        <p className="text-sm text-destructive">{t('previewFailed')}</p>
      ) : (
        <Skeleton className="h-40 w-full rounded-tile" />
      )}
    </AdaptiveDialog>
  );
}

/** The impact list of a pause, from its preview (L-101, L-102, L-73). */
function usePauseImpact({
  preview,
  directions,
  scope,
  enrollmentId,
  firstName,
  format,
}: {
  preview: PausePreviewResponse | undefined;
  directions: readonly BillingDirection[];
  scope: PauseFormValues['scope'];
  enrollmentId: string;
  firstName: string;
  format: ReturnType<typeof useLearningFormat>;
}): ImpactItem[] | null {
  const t = useTranslations('students.pause.impact');
  return useMemo(() => {
    if (!preview) return null;
    const byId = new Map(directions.map((direction) => [direction.enrollmentId, direction]));
    const range = preview.endsAt
      ? format.dayRange(preview.startsAt, lastPauseDay(preview.endsAt).toISOString())
      : t('fromDate', { date: format.dayMonth(preview.startsAt) });
    const items: ImpactItem[] = [];
    const rows = preview.directions.flatMap((row) => {
      const direction = byId.get(row.enrollmentId);
      return direction ? [{ ...row, direction }] : [];
    });

    if (scope === 'direction') {
      const row = rows.find((item) => item.enrollmentId === enrollmentId) ?? rows[0];
      if (row) {
        const name = directionName(row.direction);
        items.push(
          row.direction.group
            ? {
                id: 'lessons',
                icon: <Trash2Icon />,
                tone: 'danger',
                title: t('groupWithout', { count: row.groupLessons, name, student: firstName }),
                text: t('groupWithoutText', { range }),
              }
            : {
                id: 'lessons',
                icon: <Trash2Icon />,
                tone: 'danger',
                title: t('removedOne', { count: row.removedLessons, name }),
                text: range,
              },
          {
            id: 'charges',
            icon: <BanknoteIcon />,
            tone: 'neutral',
            title: t('noCharges'),
          },
        );
      }
      for (const other of directions) {
        if (other.enrollmentId === enrollmentId || other.status === 'ARCHIVED') continue;
        items.push({
          id: `other-${other.enrollmentId}`,
          icon: <BookOpenIcon />,
          tone: 'neutral',
          title: t('otherGoesOn', { name: directionName(other) }),
        });
      }
    } else {
      const total = rows.reduce((sum, row) => sum + row.removedLessons + row.groupLessons, 0);
      items.push({
        id: 'lessons',
        icon: <Trash2Icon />,
        tone: 'danger',
        title: t('removed', { count: total }),
        text: [
          range,
          format.list(
            rows.map(
              (row) => `${directionName(row.direction)} ${row.removedLessons + row.groupLessons}`,
            ),
          ),
        ]
          .filter(Boolean)
          .join(' · '),
      });
    }

    const [first, ...rest] = preview.extensions;
    if (first) {
      const days = Math.round(
        (Date.parse(first.nextExpiresAt) - Date.parse(first.expiresAt)) / DAY_MS,
      );
      items.push({
        id: 'packages',
        icon: <CalendarPlusIcon />,
        tone: 'indigo',
        title: t('extended', { count: days }),
        text: t('extendedText', {
          name: first.name ?? t('packageUnnamed'),
          date: format.dayMonth(new Date(Date.parse(first.nextExpiresAt) - 1)),
          more: rest.length,
        }),
      });
    } else if (!preview.endsAt) {
      items.push({
        id: 'packages',
        icon: <CalendarPlusIcon />,
        tone: 'indigo',
        title: t('extendOnReturn'),
      });
    }

    if (scope === 'student') {
      for (const row of rows) {
        if (!row.direction.group) continue;
        items.push({
          id: `group-${row.enrollmentId}`,
          icon: <UsersIcon />,
          tone: 'neutral',
          title: t('groupGoesOn', { name: row.direction.group.name, student: firstName }),
          text: t('groupGoesOnText'),
        });
      }
      items.push({
        id: 'schedules',
        icon: <RepeatIcon />,
        tone: 'neutral',
        title: t('schedulesKept'),
        text: preview.endsAt
          ? t('backFrom', { date: format.dayMonth(preview.endsAt) })
          : t('backByHand'),
      });
    }
    return items;
  }, [preview, directions, scope, enrollmentId, firstName, format, t]);
}
