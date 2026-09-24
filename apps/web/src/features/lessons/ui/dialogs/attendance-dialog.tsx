'use client';

import { CheckCheckIcon, ClipboardCheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type {
  AttendanceStatusDto,
  LessonAttendanceResponse,
  LessonDetailResponse,
} from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { Notice } from '@/components/shared/notice';
import { Segmented } from '@/components/shared/segmented';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useLessonAttendanceQuery, useSetAttendanceMutation } from '../../api';
import { useLessonDates } from '../lesson-format';
import { useErrorToast, useLessonForm } from '../lesson-form-parts';

const MARKS = ['PRESENT', 'ABSENT', 'EXCUSED'] as const;
const MARK_TONE = { PRESENT: 'success', ABSENT: 'danger', EXCUSED: 'info' } as const;

const attendanceFormSchema = z.object({
  marks: z.record(z.enum(MARKS).or(z.literal(''))),
});
type AttendanceFormValues = z.infer<typeof attendanceFormSchema>;

function savedMarks(sheet: LessonAttendanceResponse | undefined): AttendanceFormValues {
  return {
    marks: Object.fromEntries(
      (sheet?.participants ?? []).map((row) => [row.enrollmentId, row.status ?? '']),
    ),
  };
}

/**
 * Who came to a group lesson (L-71…L-74): present, absent or excused per
 * member, "everyone came", and a paused member shown on pause and not
 * markable (L-73). A summary says how many are charged. Only changed marks
 * are sent.
 */
export function AttendanceDialog({
  lesson,
  open,
  onOpenChange,
}: {
  lesson: LessonDetailResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('lessons.attendanceDialog');
  const tPanel = useTranslations('lessons.panel');
  const tMembers = useTranslations('lessons.members');
  const dates = useLessonDates();
  const showError = useErrorToast();
  const mobile = useIsMobile();
  const sheet = useLessonAttendanceQuery(lesson.id, open);
  const save = useSetAttendanceMutation(lesson.id);
  // The sheet arrives after the dialog opens: the form follows its saved marks.
  const form = useLessonForm<AttendanceFormValues>(
    attendanceFormSchema,
    savedMarks(sheet.data),
    sheet.data ? savedMarks(sheet.data) : undefined,
  );
  const marks = useWatch({ control: form.control, name: 'marks' }) ?? {};

  const participants = sheet.data?.participants ?? [];
  const active = participants.filter((row) => !row.paused);
  const paused = participants.filter((row) => row.paused);
  const markOf = (id: string) => marks[id] || null;
  const counts = {
    present: active.filter((row) => markOf(row.enrollmentId) === 'PRESENT').length,
    absent: active.filter((row) => markOf(row.enrollmentId) === 'ABSENT').length,
    excused: active.filter((row) => markOf(row.enrollmentId) === 'EXCUSED').length,
    paused: paused.length,
  };
  // An unmarked member counts as present when the lesson is held (L-72).
  const charged = active.length - counts.excused;
  const saved = savedMarks(sheet.data).marks;
  const changed = active.filter(
    (row) => (marks[row.enrollmentId] ?? '') !== (saved[row.enrollmentId] ?? ''),
  );

  const close = (next: boolean) => {
    if (!next) form.reset(savedMarks(sheet.data));
    onOpenChange(next);
  };
  const submit = form.handleSubmit(async (values) => {
    const payload = active
      .map((row) => ({ enrollmentId: row.enrollmentId, status: values.marks[row.enrollmentId] }))
      .filter(
        (mark): mark is { enrollmentId: string; status: AttendanceStatusDto } =>
          Boolean(mark.status) && mark.status !== (saved[mark.enrollmentId] ?? ''),
      );
    if (payload.length === 0) {
      close(false);
      return;
    }
    try {
      await save.mutateAsync({ marks: payload });
      toast.success(t('done'));
      close(false);
    } catch (error) {
      showError(error);
    }
  });

  const chips = [
    { key: 'present', count: counts.present, variant: 'success' },
    { key: 'absent', count: counts.absent, variant: 'danger' },
    { key: 'excused', count: counts.excused, variant: 'info' },
    { key: 'paused', count: counts.paused, variant: 'warning' },
  ] as const;
  const allCame = (
    <Button
      type="button"
      variant="white"
      size="xs"
      className={cn(mobile && 'h-10 w-full')}
      disabled={sheet.data?.markable === false}
      onClick={() =>
        active.forEach((row) =>
          form.setValue(`marks.${row.enrollmentId}`, 'PRESENT', { shouldDirty: true }),
        )
      }
    >
      <CheckCheckIcon data-icon="inline-start" />
      {t('allCame')}
    </Button>
  );

  const segments = [
    { tone: 'bg-success', count: counts.present },
    { tone: 'bg-danger-mark', count: counts.absent },
    { tone: 'bg-brand', count: counts.excused },
    { tone: 'bg-warning', count: counts.paused },
  ].filter((segment) => segment.count > 0);

  const body = sheet.isError ? (
    <Notice tone="danger" text={t('loadError')} />
  ) : sheet.isPending ? (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-28 w-full rounded-row" />
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-control" />
      ))}
    </div>
  ) : participants.length === 0 ? (
    <p className="text-sm text-muted-foreground">{t('empty')}</p>
  ) : (
    <>
      {sheet.data && !sheet.data.markable ? (
        <Notice appearance="callout" tone="info" text={t('notMarkable')} />
      ) : null}
      <div className="flex flex-col gap-3 rounded-row bg-secondary p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[15px] font-semibold">
              {t('summary', { charged, active: active.length })}
            </span>
            <span className="text-[13px] text-muted-foreground">
              {paused.length > 0
                ? t('pausedNote', {
                    names: paused.map((row) => row.student.fullName).join(', '),
                  })
                : t('allMarkedNote')}
            </span>
          </div>
          {mobile ? null : allCame}
        </div>
        {segments.length > 0 ? (
          <div aria-hidden="true" className="flex gap-1">
            {segments.map((segment) => (
              <span
                key={segment.tone}
                style={{ flexGrow: segment.count }}
                className={cn('h-1.5 rounded-pill', segment.tone)}
              />
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {chips
            .filter((chip) => chip.count > 0)
            .map((chip) => (
              <Badge key={chip.key} variant={chip.variant}>
                {t(`chip.${chip.key}`, { count: chip.count })}
              </Badge>
            ))}
        </div>
        {/* On a phone the command takes the full width under the chips. */}
        {mobile ? allCame : null}
      </div>
      <ul className="flex flex-col">
        {participants.map((row) => {
          const mark = markOf(row.enrollmentId);
          return (
            <li
              key={row.enrollmentId}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border py-2.5 last:border-b-0"
            >
              <EntityAvatar
                avatarKey={row.student.avatarKey}
                fullName={row.student.fullName}
                size="md"
              />
              <div className="flex min-w-0 grow flex-col">
                <span className="truncate text-[15px] font-semibold">{row.student.fullName}</span>
                <span
                  className={cn(
                    'text-[13px]',
                    row.paused
                      ? 'text-tint-warning-foreground'
                      : mark === 'EXCUSED'
                        ? 'text-tint-info-foreground'
                        : 'text-muted-foreground',
                  )}
                >
                  {row.paused
                    ? t('rowPaused')
                    : mark === 'EXCUSED'
                      ? t('rowFree')
                      : mark
                        ? t('rowCharged')
                        : t('rowUnmarked')}
                </span>
              </div>
              {row.paused ? (
                <Badge variant="warning" dot>
                  {tMembers('badge.paused')}
                </Badge>
              ) : (
                <Controller
                  control={form.control}
                  name={`marks.${row.enrollmentId}`}
                  render={({ field }) => (
                    <Segmented
                      label={t('rowLabel', { name: row.student.fullName })}
                      variant="paper"
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                      items={MARKS.map((value) => ({
                        value,
                        label: t(`marks.${value}`),
                        tone: MARK_TONE[value],
                        disabled: sheet.data?.markable === false,
                      }))}
                    />
                  )}
                />
              )}
            </li>
          );
        })}
      </ul>
    </>
  );

  return (
    <AdaptiveDialog
      open={open}
      onOpenChange={close}
      closeLabel={tPanel('close')}
      size="lg"
      icon={<ClipboardCheckIcon />}
      iconClassName="bg-tile-indigo text-tile-indigo-foreground"
      title={t('title')}
      description={t('subtitle', {
        group: lesson.group?.name ?? '',
        date: dates.longDay(lesson.startsAtUtc),
        time: `${dates.time(lesson.startsAtUtc)}–${dates.endTime(lesson)}`,
      })}
      secondary={
        <Button type="button" variant="outline" onClick={() => close(false)}>
          {t('cancel')}
        </Button>
      }
      primary={
        <Button
          type="button"
          disabled={save.isPending || changed.length === 0 || sheet.data?.markable === false}
          onClick={() => void submit()}
        >
          {save.isPending ? <Spinner data-icon="inline-start" /> : null}
          {t('save')}
        </Button>
      }
    >
      {body}
    </AdaptiveDialog>
  );
}
