'use client';

import { useState } from 'react';
import { GraduationCapIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';
import type {
  LessonDetailResponse,
  RescheduleScopeDto,
  ScheduleResponse,
} from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { EntityPicker } from '@/components/shared/entity-picker';
import { TextField } from '@/components/shared/text-field';
import { useRescheduleLessonMutation, useUpdateLessonMutation } from '../api';
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
import { LessonTopBar } from './lesson-actions';
import { useMoneyParts } from './lesson-format';
import {
  FieldSlot,
  LessonDateField,
  useDurationOptions,
  useLessonForm,
  useTeacherOptions,
} from './lesson-form-parts';
import { LessonPanelLayout } from './lesson-panel-window';

export type PriceMode = 'editable' | 'paid' | 'package' | 'group';

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="text-xs leading-4 font-semibold tracking-[0.04em] text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

/**
 * Edit inside the panel (S01 decision 3): "when and who" on the left — date,
 * start, length and a substitute teacher — and "price and content" on the
 * right with cancel and save. A new date or time of a schedule lesson asks
 * "this lesson only / this and following" first (L-41); every save that can
 * overlap goes through the conflict dialog (L-111).
 */
export function LessonEdit({
  lesson,
  schedule,
  priceMode,
  mobile,
  onDone,
}: {
  lesson: LessonDetailResponse;
  schedule: ScheduleResponse | undefined;
  priceMode: PriceMode;
  mobile: boolean;
  onDone: () => void;
}) {
  const t = useTranslations('lessons.edit');
  const moneyParts = useMoneyParts();
  const teachers = useTeacherOptions();
  const durations = useDurationOptions(lesson.durationMin);
  const update = useUpdateLessonMutation(lesson.id);
  const reschedule = useRescheduleLessonMutation(lesson.id);
  const guard = useConflictGuard();
  const form = useLessonForm<EditFormValues>(editFormSchema, editFormDefaults(lesson));
  const [moving, setMoving] = useState<EditPlan | null>(null);

  const scheduled = lesson.status === 'SCHEDULED';
  const fromSchedule =
    scheduled && lesson.seriesId !== null && !lesson.isDetached && schedule?.state === 'ACTIVE';
  const priceLocked = priceMode !== 'editable';
  const busy = update.isPending || reschedule.isPending;

  const save = (plan: EditPlan, scope: RescheduleScopeDto) => {
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
          await reschedule.mutateAsync({ dto: rescheduleDto(plan.move, scope), force });
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

  const whenWho = (
    <div className="flex flex-col gap-4">
      <SectionTitle>{t('whenWho')}</SectionTitle>
      <Controller
        control={form.control}
        name="date"
        render={({ field, fieldState }) => (
          <FieldSlot
            label={t('date')}
            hint={
              !scheduled ? t('dateHintLocked') : fromSchedule ? t('dateHintSchedule') : undefined
            }
            error={fieldState.error?.message}
          >
            {(a11y) => (
              <LessonDateField
                id={a11y.id}
                describedBy={a11y.describedBy}
                invalid={a11y.invalid}
                disabled={!scheduled}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          </FieldSlot>
        )}
      />
      <div className="grid grid-cols-2 gap-3">
        <Controller
          control={form.control}
          name="time"
          render={({ field, fieldState }) => (
            <TextField
              type="time"
              label={t('start')}
              disabled={!scheduled}
              error={fieldState.error?.message}
              {...field}
            />
          )}
        />
        <Controller
          control={form.control}
          name="durationMin"
          render={({ field, fieldState }) => (
            <TextField
              type="select"
              label={t('duration')}
              options={durations}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />
      </div>
      <Controller
        control={form.control}
        name="teacherId"
        render={({ field, fieldState }) => (
          <FieldSlot label={t('teacher')} hint={t('teacherHint')} error={fieldState.error?.message}>
            {(a11y) => (
              <EntityPicker
                id={a11y.id}
                aria-describedby={a11y.describedBy}
                invalid={a11y.invalid}
                appearance="field"
                icon={<GraduationCapIcon />}
                value={field.value}
                options={teachers.options}
                isLoading={teachers.loading}
                onChange={(value) => field.onChange(value ?? field.value)}
                placeholder={t('teacherPlaceholder')}
                searchPlaceholder={t('teacherSearch')}
                emptyLabel={t('teacherEmpty')}
              />
            )}
          </FieldSlot>
        )}
      />
    </div>
  );

  const priceField =
    priceMode === 'group' ? null : priceMode === 'package' ? (
      <TextField
        label={t('price')}
        value={t('pricePackage')}
        hint={t('priceHintPackage')}
        disabled
        readOnly
      />
    ) : (
      <Controller
        control={form.control}
        name="price"
        render={({ field, fieldState }) => (
          <TextField
            label={t('price')}
            inputMode="decimal"
            suffix={moneyParts(0, lesson.currency).symbol}
            disabled={priceMode === 'paid'}
            hint={priceMode === 'paid' ? t('priceHintPaid') : t('priceHintEditable')}
            error={fieldState.error?.message}
            {...field}
          />
        )}
      />
    );

  const content = (
    <div className="flex flex-col gap-4">
      <SectionTitle>{priceMode === 'group' ? t('content') : t('priceContent')}</SectionTitle>
      {priceField}
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
    </div>
  );

  const actions = (
    <>
      <Button type="button" variant="outline" onClick={onDone}>
        {t('cancel')}
      </Button>
      <Button type="submit" form="lesson-edit-form" disabled={busy}>
        {busy ? <Spinner data-icon="inline-start" /> : null}
        {t('save')}
      </Button>
    </>
  );

  return (
    <form
      id="lesson-edit-form"
      noValidate
      className="contents"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <LessonPanelLayout
        mobile={mobile}
        topBar={
          <LessonTopBar
            mobile={mobile}
            menu={null}
            onClose={onDone}
            onAction={() => undefined}
            title={<DialogTitle className="text-lg font-semibold">{t('title')}</DialogTitle>}
          />
        }
        main={
          mobile ? (
            <>
              {whenWho}
              {content}
            </>
          ) : (
            whenWho
          )
        }
        aside={
          mobile ? null : (
            <>
              {content}
              <div className="flex justify-end gap-3">{actions}</div>
            </>
          )
        }
        footer={mobile ? actions : undefined}
        asideScrolls
      />
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
          onConfirm={(scope) => void save(moving, scope)}
        />
      ) : null}
      {guard.dialog}
    </form>
  );
}
