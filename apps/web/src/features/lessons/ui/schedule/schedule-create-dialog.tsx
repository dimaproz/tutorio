'use client';

import { useState } from 'react';
import { CalendarPlusIcon, PencilIcon, RepeatIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, FormProvider, useWatch, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import type { ScheduleResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { DurationField } from '@/components/shared/duration-field';
import { Notice } from '@/components/shared/notice';
import { FieldFrame, TextField } from '@/components/shared/text-field';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocalFormatter } from '@/lib/i18n/local-formatter';
import type { GatewayError } from '@/lib/auth/client';
import { useCreateScheduleMutation, useScheduleCreatePreviewQuery } from '../../api';
import type { CreateFormValues } from '../../model/create';
import {
  HORIZON_CHOICES,
  scheduleCreateDto,
  scheduleFormDefaults,
  scheduleFormReady,
  scheduleFormSchema,
  type ScheduleFormValues,
} from '../../model/schedule';
import { CreateBand } from '../create/create-band';
import { WeeklyBlock } from '../create/create-when';
import { useCreateData } from '../create/use-create-data';
import { useCreatePrefill } from '../create/use-create-prefill';
import { useDurationHint, useDurationLabels, useSlotsLabel } from '../field-labels';
import { TeacherField } from '../lesson-form-kit';
import { useErrorToast, useLessonForm, useTeacherOptions } from '../lesson-form-parts';
import { LessonPanelWindow, LessonWindowLayout } from '../lesson-panel-window';
import { ScheduleChangeDialog } from './schedule-change-dialog';
import { ScheduleCheckDialog } from './schedule-check';
import { useLengthLabel } from './schedule-parts';

/** Monday of the next week (today when it is a Monday): a new schedule's first day. */
function nextMonday(now: number): string {
  const date = new Date(now);
  date.setDate(date.getDate() + ((8 - date.getDay()) % 7));
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type ScheduleCreateInitial = { studentId?: string; groupId?: string };

type Step = 'form' | 'check' | 'existing';

/**
 * «Новий розклад» (S05 board 02): the S02 band with the student or group,
 * the teacher, the days each with a time, the length, how many weeks ahead,
 * the first day and an optional last one; then «Перевірте розклад» with the
 * dates and what they overlap, and the save — with `force` after conflicts
 * (L-111). A direction or group that has a schedule already (L-20) gets the
 * callout whose «Відкрити розклад» opens that schedule's change.
 */
export function ScheduleCreateDialog({
  open,
  onOpenChange,
  initial = {},
  nowMs,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ScheduleCreateInitial;
  nowMs?: number;
  onCreated?: (schedule: ScheduleResponse) => void;
}) {
  return open ? (
    <ScheduleCreateFlow
      initial={initial}
      nowMs={nowMs}
      onClose={() => onOpenChange(false)}
      onCreated={onCreated}
    />
  ) : null;
}

function ScheduleCreateFlow({
  initial,
  nowMs,
  onClose,
  onCreated,
}: {
  initial: ScheduleCreateInitial;
  nowMs?: number;
  onClose: () => void;
  onCreated?: (schedule: ScheduleResponse) => void;
}) {
  const t = useTranslations('schedules.form');
  const mobile = useIsMobile();
  const [now] = useState(() => nowMs ?? Date.now());
  const [step, setStep] = useState<Step>('form');
  const showError = useErrorToast();
  const form = useLessonForm<ScheduleFormValues>(
    scheduleFormSchema,
    scheduleFormDefaults({
      who: initial.groupId ? 'group' : 'student',
      studentId: initial.studentId,
      groupId: initial.groupId,
      from: nextMonday(now),
      horizonWeeks: 4,
    }),
  );
  const values = useWatch({ control: form.control }) as ScheduleFormValues;
  const data = useCreateData({
    who: values.who,
    studentId: values.studentId,
    groupId: values.groupId,
    teacherId: values.teacherId,
    firstStart: null,
    now,
  });
  const picked = values.who === 'student' ? values.studentId : values.groupId;
  useCreatePrefill({
    form: form as unknown as UseFormReturn<CreateFormValues>,
    data,
    picked,
    lengthGiven: false,
  });
  const [horizonSet, setHorizonSet] = useState(false);
  if (!horizonSet && data.horizonWeeks) {
    setHorizonSet(true);
    if (!form.getFieldState('horizonWeeks').isDirty) {
      form.setValue('horizonWeeks', String(data.horizonWeeks));
    }
  }

  const ready = scheduleFormReady(values);
  const preview = useScheduleCreatePreviewQuery(ready ? scheduleCreateDto(values) : null);
  const create = useCreateScheduleMutation();
  const existing = data.schedule;
  const slotsLabel = useSlotsLabel();
  const length = useLengthLabel();
  const format = useLocalFormatter();
  const teachers = useTeacherOptions();
  const who = data.student?.fullName ?? data.group?.group.name ?? '';
  const teacherName = teachers.names.get(values.teacherId) ?? data.group?.group.teacher?.name ?? '';

  if (step === 'existing' && existing) {
    return (
      <ScheduleChangeDialog open onOpenChange={() => onClose()} schedule={existing} nowMs={nowMs} />
    );
  }

  const lastDate = preview.data?.dates.at(-1);
  const footerNote =
    preview.data && lastDate
      ? t.rich('willCreate', {
          count: preview.data.created,
          date: format.dateTime(new Date(lastDate), { day: 'numeric', month: 'long' }),
          strong: (chunks) => <strong className="font-semibold text-foreground">{chunks}</strong>,
        })
      : null;

  const next = form.handleSubmit(() => {
    if (!preview.data) return;
    setStep('check');
  });

  const save = async (force: boolean) => {
    try {
      const schedule = await create.mutateAsync({ dto: scheduleCreateDto(values), force });
      toast.success(t('created', { name: who }));
      onCreated?.(schedule);
      onClose();
    } catch (error) {
      const code = (error as GatewayError).code;
      if (code === 'SCHEDULE_CONFLICT') {
        await preview.refetch();
      } else if (code === 'SCHEDULE_EXISTS') {
        setStep('form');
      } else {
        showError(error);
      }
    }
  };

  const credits =
    data.credits && data.student
      ? {
          owner: data.student.fullName.split(' ')[0] ?? data.student.fullName,
          left: data.credits.left,
          total: data.credits.total,
        }
      : null;

  return (
    <FormProvider {...form}>
      <LessonPanelWindow
        open={step === 'form'}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        description={t('description')}
        mobile={mobile}
      >
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void next();
          }}
        >
          <LessonWindowLayout
            mobile={mobile}
            band={
              <CreateBand
                data={data}
                mobile={mobile}
                onClose={onClose}
                heading={{
                  title: t('title'),
                  subtitle: t('subtitle'),
                  icon: <RepeatIcon />,
                  noScheduleChip: t('noSchedule'),
                }}
              />
            }
            footerNote={footerNote}
            footer={
              <>
                <Button type="button" variant="outline" onClick={onClose}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={Boolean(existing) || (ready && !preview.data)}>
                  {t('next')}
                </Button>
              </>
            }
          >
            {existing ? (
              <Notice
                tone="warning"
                appearance="callout"
                title={t('existsTitle', { name: who, teacher: teacherName })}
                text={t('existsText', {
                  rule: slotsLabel(existing.slots) ?? '',
                  length: length(existing.durationMin),
                })}
                action={
                  <Button
                    type="button"
                    variant="white"
                    size="sm"
                    onClick={() => setStep('existing')}
                  >
                    <PencilIcon data-icon="inline-start" />
                    {t('openSchedule')}
                  </Button>
                }
              />
            ) : null}
            {data.solo ? null : (
              <Controller
                control={form.control}
                name="teacherId"
                render={({ field, fieldState }) => (
                  <TeacherField
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    regularTeacherId={data.regularTeacherId}
                    hint={values.who === 'group' ? t('teacherHintGroup') : t('teacherHint')}
                    substitution={false}
                    locked={values.who === 'group'}
                    lessons={[]}
                    start={null}
                    durationMin={Number(values.durationMin)}
                    error={fieldState.error?.message}
                  />
                )}
              />
            )}
            <WeeklyBlock
              labels={{ from: t('from'), until: t('until'), untilHint: t('untilHint') }}
              between={<LengthAndHorizon studioWeeks={data.horizonWeeks} mobile={mobile} />}
            />
          </LessonWindowLayout>
        </form>
      </LessonPanelWindow>
      {preview.data ? (
        <ScheduleCheckDialog
          open={step === 'check'}
          onOpenChange={(next) => {
            if (!next) onClose();
          }}
          subtitle={[who, teacherName].filter(Boolean).join(' · ')}
          who={who}
          rule={`${slotsLabel(preview.data ? scheduleCreateDto(values).slots : []) ?? ''} · ${length(
            Number(values.durationMin),
          )}`}
          horizonWeeks={Number(values.horizonWeeks)}
          preview={preview.data}
          durationMin={Number(values.durationMin)}
          credits={credits}
          busy={create.isPending}
          onBack={() => setStep('form')}
          onConfirm={(force) => void save(force)}
        />
      ) : null}
    </FormProvider>
  );
}

/** «Тривалість» and «Заняття наперед» side by side (one under the other on phones). */
function LengthAndHorizon({ studioWeeks, mobile }: { studioWeeks: number; mobile: boolean }) {
  const t = useTranslations('schedules.form');
  const tFields = useTranslations('lessons.fields');
  const durationLabels = useDurationLabels();
  const durationHint = useDurationHint();
  const [horizonWeeks] = useWatch<ScheduleFormValues, ['horizonWeeks']>({
    name: ['horizonWeeks'],
  });
  const weeks = [...new Set([...HORIZON_CHOICES, studioWeeks])].sort((a, b) => a - b);
  return (
    <div className={mobile ? 'flex flex-col gap-4' : 'grid grid-cols-2 items-start gap-3'}>
      <Controller<ScheduleFormValues, 'durationMin'>
        name="durationMin"
        render={({ field, fieldState }) => (
          <FieldFrame
            label={tFields('duration')}
            hint={durationHint(Number(field.value), null)}
            error={fieldState.error?.message}
          >
            {(a11y) => (
              <DurationField
                id={a11y.id}
                aria-describedby={a11y.describedBy}
                invalid={Boolean(a11y.invalid)}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                labels={durationLabels}
              />
            )}
          </FieldFrame>
        )}
      />
      <Controller<ScheduleFormValues, 'horizonWeeks'>
        name="horizonWeeks"
        render={({ field }) => (
          <TextField
            type="select"
            label={t('horizon')}
            icon={<CalendarPlusIcon />}
            hint={Number(horizonWeeks) === studioWeeks ? t('horizonStudio') : undefined}
            value={field.value}
            onValueChange={field.onChange}
            options={weeks.map((count) => ({
              value: String(count),
              label: t('weeks', { count }),
            }))}
          />
        )}
      />
    </div>
  );
}
