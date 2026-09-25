'use client';

import { useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, FormProvider, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { DurationField } from '@/components/shared/duration-field';
import { FieldFrame, TextField } from '@/components/shared/text-field';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  useApplyScheduleChangePreview,
  useCreateSubmit,
  type CreateSubmitContext,
} from './use-create-submit';
import { useScheduleCreatePreviewQuery } from '../../api';
import { localInstant } from '../../model/busy';
import {
  chargedCount,
  createFormDefaults,
  createScheduleDto,
  createFormSchema,
  localDate,
  newScheduleLessonCount,
  packageCoverage,
  pastRows,
  scheduleChangeDto,
  typedPrice,
  weeklySlots,
  type CreateFormValues,
} from '../../model/create';
import { useDurationHint, useDurationLabels } from '../field-labels';
import { TeacherField, useDayLessons } from '../lesson-form-kit';
import { useLessonForm, useTeacherOptions } from '../lesson-form-parts';
import { LessonPanelWindow, LessonWindowLayout } from '../lesson-panel-window';
import { CreateBand } from './create-band';
import { useCreateFooter } from './create-footer';
import { CreatePriceField } from './create-price';
import { CreateParticipants, CreatePast, CreateWeeklyImpact } from './create-extras';
import { CreateWhen } from './create-when';
import { useCreateData } from './use-create-data';
import { useCreatePrefill } from './use-create-prefill';

const DAY_MS = 24 * 60 * 60 * 1000;
const firstName = (fullName: string) => fullName.split(' ')[0] ?? fullName;

export type LessonCreateInitial = {
  studentId?: string;
  groupId?: string;
  /** "yyyy-MM-dd" of the first row; tomorrow otherwise. */
  date?: string;
  /** "HH:mm" of the first row; 17:00 otherwise. */
  time?: string;
  /** Every row at once, e.g. several dates picked elsewhere (the calendar, S03). */
  dates?: { date: string; time: string }[];
  /** The length, e.g. from a drag on the calendar (S03); 60 otherwise. */
  durationMin?: number;
};

/**
 * The lesson form (S02, layout B): who in the indigo band, then the teacher,
 * «Коли» (dates once or «Щотижня»), length and price, what a past lesson
 * became, the group's participants or what the schedule becomes, topic and
 * notes; the footer shows the result before saving. One-off dates book with
 * `POST /lessons`; «Щотижня» creates a schedule or adds the days to the
 * direction's schedule (L-23). Every save goes through the conflict dialog
 * (L-111).
 */
export function LessonCreateDialog({
  open,
  onOpenChange,
  initial = {},
  nowMs,
  searchOnOpen,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: LessonCreateInitial;
  /** Pins the clock (stories); the live clock otherwise. */
  nowMs?: number;
  /** Opens the student search at once (stories). */
  searchOnOpen?: boolean;
  onCreated?: () => void;
}) {
  const t = useTranslations('lessons.create');
  const mobile = useIsMobile();
  return (
    <LessonPanelWindow
      open={open}
      onOpenChange={onOpenChange}
      description={t('description')}
      mobile={mobile}
    >
      {open ? (
        <LessonCreateForm
          initial={initial}
          nowMs={nowMs}
          mobile={mobile}
          searchOnOpen={searchOnOpen}
          onClose={() => onOpenChange(false)}
          onCreated={onCreated}
        />
      ) : null}
    </LessonPanelWindow>
  );
}

function LessonCreateForm({
  initial,
  nowMs,
  mobile,
  searchOnOpen,
  onClose,
  onCreated,
}: {
  initial: LessonCreateInitial;
  nowMs?: number;
  mobile: boolean;
  searchOnOpen?: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const t = useTranslations('lessons.create');
  const tFields = useTranslations('lessons.fields');
  const durationLabels = useDurationLabels();
  const durationHint = useDurationHint();
  const teachers = useTeacherOptions();
  const [now] = useState(() => nowMs ?? Date.now());
  const [defaults] = useState(() => {
    const base = createFormDefaults({
      who: initial.groupId ? 'group' : 'student',
      studentId: initial.studentId,
      groupId: initial.groupId,
      date: initial.date ?? localDate(now + DAY_MS),
      time: initial.time ?? '17:00',
      durationMin: initial.durationMin ?? 60,
    });
    return initial.dates?.length ? { ...base, dates: initial.dates } : base;
  });
  const form = useLessonForm<CreateFormValues>(createFormSchema, defaults);
  const values = useWatch({ control: form.control }) as CreateFormValues;
  const { who, studentId, groupId, teacherId, frequency, dates, durationMin } = values;
  const [showTopic, setShowTopic] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const firstRow = dates.find(
    (row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && /^\d{2}:\d{2}$/.test(row.time),
  );
  const firstStart = firstRow ? localInstant(firstRow.date, firstRow.time) : null;
  const data = useCreateData({ who, studentId, groupId, teacherId, firstStart, now });
  const picked = who === 'student' ? studentId : groupId;
  const minutes = Number(durationMin);

  const { rate, usual, updatedFrom, clearUpdated } = useCreatePrefill({
    form,
    data,
    picked,
    lengthGiven: initial.durationMin !== undefined,
  });

  const dayLessons = useDayLessons(frequency === 'once' ? dates.map((row) => row.date) : []);
  const scope = {
    teacherId: teacherId || null,
    studentId: who === 'student' ? studentId : null,
    groupIds:
      who === 'group'
        ? [groupId]
        : data.student
          ? (data.billing?.directions ?? []).flatMap((item) => (item.group ? [item.group.id] : []))
          : [],
  };

  // «Щотижня»: a new schedule, or the days added to the direction's schedule.
  const existing = frequency === 'weekly' && data.schedule ? data.schedule : null;
  const added = weeklySlots(values).filter((slot) => /^\d{2}:\d{2}$/.test(slot.localTime));
  // The query key is hashed deeply, so the change can be rebuilt every render.
  const change =
    existing && added.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(values.from) && minutes >= 5
      ? scheduleChangeDto(values, existing.slots)
      : null;
  const preview = useApplyScheduleChangePreview(existing?.id ?? null, change);
  // A new schedule is previewed too: its lessons and overlaps before saving.
  const createPreview = useScheduleCreatePreviewQuery(
    frequency === 'weekly' &&
      !existing &&
      picked &&
      added.length > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(values.from) &&
      minutes >= 5 &&
      minutes <= 480 &&
      (who === 'group' || teacherId)
      ? createScheduleDto(values, { priceMinor: null, currency: data.defaultCurrency })
      : null,
  );
  const newCount = newScheduleLessonCount({
    slots: added,
    from: values.from,
    until: values.until,
    horizonWeeks: data.horizonWeeks,
    now,
  });

  // What the save books and what it costs.
  const past = pastRows(values, now);
  const allPast = past.length > 0 && past.every(Boolean);
  const count = dates.length;
  const charged = chargedCount(values, now);
  const coverage = data.credits ? packageCoverage(charged, data.credits.left) : null;
  const typed = typedPrice(values);
  const currency = data.group?.currency ?? data.booking?.currency ?? data.defaultCurrency;
  const studentName = data.student ? firstName(data.student.fullName) : '';
  const teacherName = teachers.names.get(teacherId) ?? '';

  const submitContext: CreateSubmitContext = {
    values,
    data,
    existing,
    now,
    priceMinor:
      data.priceMode === 'amount' ? (typed ?? 0) : data.group ? data.group.rateMinor : (rate ?? 0),
    currency,
    candidate: {
      startsAtUtc: new Date(firstStart ?? now).toISOString(),
      durationMin: minutes,
      title: data.student?.fullName ?? data.group?.group.name ?? '',
      teacherName,
    },
    count,
  };
  const save = useCreateSubmit({
    onSaved: (message) => {
      toast.success(message);
      onCreated?.();
      onClose();
    },
  });
  const submit = form.handleSubmit(() => save.run(submitContext));

  const teacherHint =
    frequency === 'weekly'
      ? tFields('teacherHintWeekly')
      : who === 'group'
        ? data.group
          ? tFields('teacherHintGroup')
          : undefined
        : data.student
          ? data.primary
            ? tFields('teacherHintDirection', { name: studentName })
            : tFields('teacherHintNew')
          : undefined;

  const footer = useCreateFooter({
    who,
    picked: Boolean(picked),
    frequency,
    hasDate: Boolean(firstRow),
    count,
    allPast,
    priceMode: data.priceMode,
    coverage,
    groupRate: data.group?.rateMinor ?? null,
    typed,
    charged,
    currency,
    existing: Boolean(existing),
    addedSlots: added.length,
    previewCreated: preview.data?.created ?? null,
    newCount: createPreview.data?.created ?? newCount,
  });

  const body = (
    <>
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
              regularHint={
                data.student ? tFields('teacherOfStudent', { name: studentName }) : undefined
              }
              hint={teacherHint}
              substitution={frequency === 'once' && Boolean(picked)}
              lessons={dayLessons}
              start={firstStart}
              durationMin={minutes}
              error={fieldState.error?.message}
            />
          )}
        />
      )}
      <CreateWhen lessons={dayLessons} scope={scope} now={now} addToExisting={Boolean(existing)} />
      <div className="grid grid-cols-2 items-start gap-3">
        <Controller
          control={form.control}
          name="durationMin"
          render={({ field, fieldState }) => (
            <FieldFrame
              label={tFields('duration')}
              hint={durationHint(
                Number(field.value),
                frequency === 'once' ? (firstRow?.time ?? null) : null,
              )}
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
                  usual={usual}
                />
              )}
            </FieldFrame>
          )}
        />
        <CreatePriceField
          data={data}
          mobile={mobile}
          rate={rate}
          currency={currency}
          coverage={coverage}
          charged={charged}
          updatedFrom={updatedFrom}
          onTyped={clearUpdated}
          studentName={studentName}
          teacherName={teacherName}
        />
      </div>
      <CreatePast now={now} group={who === 'group'} />
      {data.group && frequency === 'once' ? (
        <CreateParticipants total={data.group.members.length} paused={data.group.paused} />
      ) : null}
      {frequency === 'weekly' && picked ? (
        <CreateWeeklyImpact
          existing={existing?.slots ?? null}
          added={added}
          becomes={change?.slots ?? added}
          preview={preview.data}
          previewPending={Boolean(change) && preview.isPending}
          createPreview={createPreview.data}
          newCount={newCount}
          horizonWeeks={data.horizonWeeks}
          who={{
            name: data.student?.fullName ?? data.group?.group.name ?? '',
            group: who === 'group',
          }}
          teacher={teacherName}
          ownerName={studentName}
        />
      ) : null}
      {showTopic || values.topic ? (
        <Controller
          control={form.control}
          name="topic"
          render={({ field, fieldState }) => (
            <TextField
              label={tFields('topic')}
              error={fieldState.error?.message}
              autoFocus={showTopic && !values.topic}
              {...field}
            />
          )}
        />
      ) : null}
      {showNotes || values.notes ? (
        <Controller
          control={form.control}
          name="notes"
          render={({ field, fieldState }) => (
            <TextField
              type="textarea"
              rows={3}
              label={tFields('notes')}
              error={fieldState.error?.message}
              autoFocus={showNotes && !values.notes}
              {...field}
            />
          )}
        />
      ) : null}
      {(showTopic || values.topic) && (showNotes || values.notes) ? null : (
        <div className="-mt-1 flex flex-wrap gap-2">
          {showTopic || values.topic ? null : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowTopic(true)}>
              <PlusIcon data-icon="inline-start" />
              {tFields('addTopic')}
            </Button>
          )}
          {showNotes || values.notes ? null : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowNotes(true)}>
              <PlusIcon data-icon="inline-start" />
              {tFields('addNotes')}
            </Button>
          )}
        </div>
      )}
    </>
  );

  return (
    <FormProvider {...form}>
      <form
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
            <CreateBand data={data} mobile={mobile} onClose={onClose} searchOnOpen={searchOnOpen} />
          }
          footerNote={footer.note}
          footer={
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={save.busy}>
                {save.busy ? <Spinner data-icon="inline-start" /> : null}
                {footer.primary}
              </Button>
            </>
          }
        >
          {body}
        </LessonWindowLayout>
        {save.dialog}
      </form>
    </FormProvider>
  );
}
