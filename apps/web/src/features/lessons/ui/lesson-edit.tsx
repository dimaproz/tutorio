'use client';

import { useState } from 'react';
import { PackageIcon, PencilIcon, RepeatIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type {
  LessonDetailResponse,
  RescheduleScopeDto,
  ScheduleResponse,
} from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { CreditMeter } from '@/components/shared/credit-meter';
import { DateRowsField } from '@/components/shared/date-rows-field';
import { DurationField } from '@/components/shared/duration-field';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { FieldNote } from '@/components/shared/field-note';
import { PriceField } from '@/components/shared/price-field';
import { FieldFrame, TextField } from '@/components/shared/text-field';
import { timeSteps } from '@/components/shared/time-field';
import { AvatarStack, WhoCard, WhoChip } from '@/components/shared/who-picker';
import { capitalizeFirst } from '@/lib/utils';
import { useRescheduleLessonMutation, useUpdateLessonMutation } from '../api';
import { busySlots, localInstant } from '../model/busy';
import {
  editFormDefaults,
  editFormSchema,
  editPlan,
  rescheduleDto,
  type EditFormValues,
  type EditPlan,
} from '../model/edit';
import { MoveDialog } from './dialogs/move-dialog';
import { useConflictGuard } from './dialogs/use-conflict-guard';
import {
  useDateRowsLabels,
  useDurationHint,
  useDurationLabels,
  useFormDates,
} from './field-labels';
import { LessonFormBand, TeacherField, useDayLessons, WhenHeading } from './lesson-form-kit';
import { useLessonDates, useMoneyParts } from './lesson-format';
import { useLessonForm, useTeacherOptions } from './lesson-form-parts';
import { LessonWindowLayout } from './lesson-panel-window';

export type PriceMode = 'editable' | 'paid' | 'package' | 'group';

/** What the locked card of an edit shows about the lesson's student or group. */
export type LockedEntity = {
  studentLevel: string | null;
  studentAvatar: string | null;
  /** The direction's teacher, for "B2 · з Dmytro Tutor". */
  directionTeacher: string | null;
  /** Credits of the package paying for it. */
  credits: { left: number; total: number } | null;
  /** "Пн і Пт · 17:00". */
  schedule: string | null;
  groupMembers: { id: string; fullName: string; avatarKey: string | null }[];
  pausedMembers: number;
};

/**
 * The lesson's student or group in the edit band: the white card with a lock
 * instead of «Змінити» — the student or group of a lesson cannot change.
 */
function LessonLockedCard({
  lesson,
  entity,
}: {
  lesson: LessonDetailResponse;
  entity: LockedEntity;
}) {
  const t = useTranslations('lessons.create');
  const tPeople = useTranslations('lessons.people');
  const schedule = entity.schedule ? (
    <WhoChip icon={<RepeatIcon />}>{entity.schedule}</WhoChip>
  ) : null;
  if (lesson.group) {
    return (
      <WhoCard
        media={<AvatarStack people={entity.groupMembers} max={4} size="sm" />}
        name={lesson.group.name}
        meta={
          entity.pausedMembers > 0
            ? tPeople('groupMetaPaused', {
                count: entity.groupMembers.length,
                paused: entity.pausedMembers,
              })
            : tPeople('groupMeta', { count: entity.groupMembers.length })
        }
        chips={schedule}
        locked
        lockLabel={t('lockedGroup')}
      />
    );
  }
  if (!lesson.student) return null;
  const meta = entity.directionTeacher
    ? entity.studentLevel
      ? t('studentMeta', { level: entity.studentLevel, teacher: entity.directionTeacher })
      : t('studentMetaNoLevel', { teacher: entity.directionTeacher })
    : entity.studentLevel;
  return (
    <WhoCard
      media={
        <EntityAvatar
          avatarKey={entity.studentAvatar}
          fullName={lesson.student.fullName}
          size="lg"
        />
      }
      name={lesson.student.fullName}
      meta={meta}
      chips={
        entity.credits || schedule ? (
          <>
            {entity.credits ? (
              <span className="inline-flex h-6.5 items-center rounded-pill bg-background px-2.5">
                <CreditMeter
                  inline
                  left={entity.credits.left}
                  total={entity.credits.total}
                  lowThreshold={1}
                  label={t('chipPackage', entity.credits)}
                />
              </span>
            ) : null}
            {schedule}
          </>
        ) : undefined
      }
      locked
      lockLabel={t('lockedStudent')}
    />
  );
}

/**
 * Edit inside the lesson window (S01 decision 3, layout A): the S02 form in
 * edit mode — the locked card in the band; the teacher (a substitute for this
 * lesson only); one date row with its time, and the schedule line; length and
 * price; topic and notes. A new date or time of a schedule lesson asks "this
 * lesson only / this and following" first (L-41); every save that can overlap
 * goes through the conflict dialog (L-111).
 */
export function LessonEdit({
  lesson,
  schedule,
  priceMode,
  entity,
  mobile,
  onDone,
}: {
  lesson: LessonDetailResponse;
  schedule: ScheduleResponse | undefined;
  priceMode: PriceMode;
  entity: LockedEntity;
  mobile: boolean;
  onDone: () => void;
}) {
  const t = useTranslations('lessons.edit');
  const tFields = useTranslations('lessons.fields');
  const tCreate = useTranslations('lessons.create');
  const lessonDates = useLessonDates();
  const moneyParts = useMoneyParts();
  const teachers = useTeacherOptions();
  const update = useUpdateLessonMutation(lesson.id);
  const reschedule = useRescheduleLessonMutation(lesson.id);
  const guard = useConflictGuard();
  const form = useLessonForm<EditFormValues>(editFormSchema, editFormDefaults(lesson));
  const [moving, setMoving] = useState<EditPlan | null>(null);
  const [date, time, durationMin, teacherId] = useWatch({
    control: form.control,
    name: ['date', 'time', 'durationMin', 'teacherId'],
  });
  const formDates = useFormDates();
  const dateLabels = useDateRowsLabels([date]);
  const durationLabels = useDurationLabels();
  const durationHint = useDurationHint();
  const dayLessons = useDayLessons([date]);

  const scheduled = lesson.status === 'SCHEDULED';
  const fromSchedule =
    scheduled && lesson.seriesId !== null && !lesson.isDetached && schedule?.state === 'ACTIVE';
  const priceLocked = priceMode !== 'editable';
  const busy = update.isPending || reschedule.isPending;
  const minutes = Number(durationMin);
  const scope = {
    teacherId,
    studentId: lesson.student?.id ?? null,
    groupIds: lesson.groupId ? [lesson.groupId] : [],
    excludeLessonId: lesson.id,
  };
  const start =
    /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time)
      ? localInstant(date, time)
      : null;

  const save = (plan: EditPlan, moveScope: RescheduleScopeDto) => {
    let moved = false;
    const startsAtUtc = plan.move?.startsAtUtc ?? lesson.startsAtUtc;
    return guard.run(
      {
        startsAtUtc,
        durationMin: plan.move?.durationMin ?? plan.update?.durationMin ?? lesson.durationMin,
        title: lesson.student?.fullName ?? lesson.group?.name ?? '',
        teacherName:
          teachers.names.get(plan.update?.teacherId ?? lesson.teacherId) ?? lesson.teacher.name,
      },
      async (force) => {
        if (plan.move && !moved) {
          await reschedule.mutateAsync({ dto: rescheduleDto(plan.move, moveScope), force });
          moved = true;
        }
        if (plan.update) await update.mutateAsync({ dto: plan.update, force });
      },
      () => {
        toast.success(t('saved'));
        setMoving(null);
        onDone();
      },
    );
  };

  const submit = form.handleSubmit(async (values) => {
    const plan = editPlan(values, lesson, { priceLocked });
    if (!plan.move && !plan.update) {
      onDone();
      return;
    }
    if (plan.move && fromSchedule && schedule) {
      setMoving(plan);
      return;
    }
    await save(plan, 'this');
  });

  const errors = form.formState.errors;
  const priceField =
    priceMode === 'group' ? null : priceMode === 'package' ? (
      <PriceField
        label={tFields('price')}
        state="package"
        value=""
        currency=""
        packageLabel={mobile ? tFields('pricePackageShort', { count: 1 }) : t('pricePackage')}
        packageIcon={<PackageIcon />}
        hint={t('priceHintPackage')}
      />
    ) : (
      <Controller
        control={form.control}
        name="price"
        render={({ field, fieldState }) => (
          <PriceField
            label={tFields('price')}
            state={priceMode === 'paid' ? 'locked' : 'amount'}
            currency={moneyParts(0, lesson.currency).symbol}
            hint={priceMode === 'paid' ? t('priceHintPaid') : t('priceHintEditable')}
            error={fieldState.error?.message}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
          />
        )}
      />
    );

  const body = (
    <>
      <Controller
        control={form.control}
        name="teacherId"
        render={({ field, fieldState }) => (
          <TeacherField
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            regularTeacherId={lesson.teacherId}
            hint={t('teacherHint')}
            substitution={false}
            lessons={dayLessons}
            start={start}
            durationMin={minutes}
            excludeLessonId={lesson.id}
            error={fieldState.error?.message}
          />
        )}
      />
      <section className="flex flex-col gap-3.5">
        <WhenHeading title={tCreate('when')} />
        <DateRowsField
          fixed
          rows={[{ key: 'lesson', date, time }]}
          labels={dateLabels}
          formatDate={formDates.field}
          locale={formDates.locale}
          disabled={!scheduled}
          onDateChange={(_, value) =>
            form.setValue('date', value, {
              shouldDirty: true,
              shouldValidate: form.formState.isSubmitted,
            })
          }
          onTimeChange={(_, value) =>
            form.setValue('time', value, {
              shouldDirty: true,
              shouldValidate: form.formState.isSubmitted,
            })
          }
          busy={[busySlots(dayLessons, scope, date, timeSteps(15))]}
          errors={[{ date: errors.date?.message, time: errors.time?.message }]}
          notes={[
            !scheduled ? (
              <FieldNote key="locked">{tFields('timeLocked')}</FieldNote>
            ) : fromSchedule ? (
              <FieldNote key="schedule" icon={<RepeatIcon />}>
                {tFields('scheduleLine')}
              </FieldNote>
            ) : null,
          ]}
        />
      </section>
      <div className="grid grid-cols-2 items-start gap-3">
        <Controller
          control={form.control}
          name="durationMin"
          render={({ field, fieldState }) => (
            <FieldFrame
              label={tFields('duration')}
              hint={durationHint(Number(field.value), time)}
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
                  usual={schedule?.durationMin ?? null}
                />
              )}
            </FieldFrame>
          )}
        />
        {priceField}
      </div>
      <Controller
        control={form.control}
        name="topic"
        render={({ field, fieldState }) => (
          <TextField label={t('topic')} error={fieldState.error?.message} {...field} />
        )}
      />
      <Controller
        control={form.control}
        name="notes"
        render={({ field, fieldState }) => (
          <TextField
            type="textarea"
            rows={3}
            label={t('notes')}
            error={fieldState.error?.message}
            {...field}
          />
        )}
      />
    </>
  );

  return (
    <form
      id="lesson-edit-form"
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <LessonWindowLayout
        mobile={mobile}
        band={
          <LessonFormBand
            icon={<PencilIcon />}
            title={t('title')}
            subtitle={t('subtitle', {
              date: capitalizeFirst(lessonDates.longDay(lesson.startsAtUtc)),
              time: `${lessonDates.time(lesson.startsAtUtc)}–${lessonDates.endTime(lesson)}`,
            })}
            mobile={mobile}
            onClose={onDone}
          >
            <LessonLockedCard lesson={lesson} entity={entity} />
          </LessonFormBand>
        }
        footer={
          <>
            <Button type="button" variant="outline" onClick={onDone}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner data-icon="inline-start" /> : null}
              {t('save')}
            </Button>
          </>
        }
      >
        {body}
      </LessonWindowLayout>
      {moving?.move && schedule ? (
        <MoveDialog
          lesson={lesson}
          schedule={schedule}
          target={moving.move}
          open
          onOpenChange={(open) => {
            if (!open) setMoving(null);
          }}
          busy={busy}
          onConfirm={(moveScope) => void save(moving, moveScope)}
        />
      ) : null}
      {guard.dialog}
    </form>
  );
}
