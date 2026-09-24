'use client';

import { useMemo, type ReactNode } from 'react';
import { ArrowLeftRightIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogTitle } from '@/components/ui/dialog';
import { EntityPicker, type EntityPickerOption } from '@/components/shared/entity-picker';
import { FieldNote } from '@/components/shared/field-note';
import { IconButton } from '@/components/shared/icon-button';
import { FieldFrame } from '@/components/shared/text-field';
import { BandHeader, TintBand } from '@/components/shared/tint-band';
import { useLessonsQuery } from '../api';
import { daysWindow, teacherBusyAt, type BusyLesson } from '../model/busy';
import { useLessonDates } from './lesson-format';
import { useTeacherOptions } from './lesson-form-parts';

/**
 * A lesson form's band: the white icon tile (desktop), the title and its
 * subtitle, close on the right, and what the form is for under them (the
 * student or group picker, or the locked card of an edit).
 */
export function LessonFormBand({
  icon,
  title,
  subtitle,
  mobile,
  onClose,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  mobile: boolean;
  onClose: () => void;
  children?: ReactNode;
}) {
  const t = useTranslations('lessons.panel');
  return (
    <TintBand className={mobile ? 'gap-4 px-4 pt-4 pb-4.5' : undefined}>
      <BandHeader
        icon={icon}
        title={
          <DialogTitle className="text-xl leading-[26px] font-semibold tracking-[-0.01em]">
            {title}
          </DialogTitle>
        }
        subtitle={subtitle}
        actions={
          <IconButton
            icon={<XIcon />}
            label={t('close')}
            size={38}
            tone="surface"
            onClick={onClose}
          />
        }
      />
      {children}
    </TintBand>
  );
}

/** «Коли» as an overline, with an optional control on the right («Разово / Щотижня»). */
export function WhenHeading({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-2">
      <h3 className="text-xs leading-4 font-semibold tracking-[0.04em] text-muted-foreground uppercase">
        {title}
      </h3>
      {aside}
    </div>
  );
}

/**
 * Every lesson of the studio on the days the form's dates cover, for the
 * busy marks of the time lists, the teacher list and the overlap hints.
 * Returns nothing until there is a date.
 */
export function useDayLessons(dates: readonly string[]): BusyLesson[] {
  const key = dates.join('|');
  // The window only changes with the set of days, not on every keystroke.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const window = useMemo(() => daysWindow(dates), [key]);
  const lessons = useLessonsQuery(
    { from: window?.from ?? '', to: window?.to ?? '' },
    Boolean(window),
  );
  return window ? (lessons.data?.items ?? []) : [];
}

/**
 * The teacher field of the lesson forms (board FieldsTeacher): rich rows
 * with the regular teacher marked «основний» and a teacher busy at the first
 * start marked «Зайнятий о 17:00»; the hint the caller gives; the sky strip
 * of a substitute with «Повернути»; and the warning when the picked teacher
 * is busy (it does not block: the conflict dialog decides on save).
 */
export function TeacherField({
  value,
  onChange,
  onBlur,
  regularTeacherId,
  regularHint,
  hint,
  substitution = true,
  lessons,
  start,
  durationMin,
  excludeLessonId,
  locked = false,
  error,
}: {
  value: string;
  onChange: (teacherId: string) => void;
  onBlur?: () => void;
  /** The direction's or group's teacher; picking another is a substitution. */
  regularTeacherId: string | null;
  /** The regular teacher's subline, e.g. "викладач Anna". */
  regularHint?: string;
  hint?: ReactNode;
  /** Weekly: a schedule keeps its teacher, so no strip. */
  substitution?: boolean;
  lessons: readonly BusyLesson[];
  /** The first lesson's start, for the busy marks. */
  start: number | null;
  durationMin: number;
  excludeLessonId?: string;
  locked?: boolean;
  error?: string;
}) {
  const t = useTranslations('lessons.fields');
  const teachers = useTeacherOptions();
  const busyTime = (teacherId: string) => {
    if (start === null || !Number.isFinite(durationMin) || durationMin <= 0) return undefined;
    return teacherBusyAt(lessons, teacherId, start, durationMin, excludeLessonId);
  };
  const clock = useLessonDates().time;

  const options: EntityPickerOption[] = teachers.options.map((option) => {
    const busy = busyTime(option.value);
    return {
      ...option,
      description: option.value === regularTeacherId ? regularHint : undefined,
      badges:
        option.value === regularTeacherId
          ? [
              <Badge key="main" variant="indigo" size="sm">
                {t('teacherMain')}
              </Badge>,
            ]
          : undefined,
      trail: busy ? (
        <span className="flex items-center gap-1.5 text-xs font-medium text-tint-warning-foreground">
          <span aria-hidden="true" className="size-1.5 rounded-pill bg-warning" />
          {t('teacherBusy', { time: clock(busy.startsAtUtc) })}
        </span>
      ) : undefined,
    };
  });

  const picked = busyTime(value);
  const substitute =
    substitution && regularTeacherId !== null && value !== regularTeacherId && !locked;
  const regularName = regularTeacherId ? teachers.names.get(regularTeacherId) : undefined;

  return (
    <div className="flex flex-col gap-2">
      <FieldFrame label={t('teacher')} hint={substitute ? undefined : hint} error={error}>
        {(a11y) => (
          <EntityPicker
            id={a11y.id}
            aria-describedby={a11y.describedBy}
            invalid={Boolean(a11y.invalid)}
            appearance="field"
            value={value}
            options={options}
            isLoading={teachers.loading}
            onChange={(next) => {
              onChange(next ?? value);
              onBlur?.();
            }}
            placeholder={t('teacherPlaceholder')}
            searchPlaceholder={t('teacherSearch')}
            emptyLabel={t('teacherEmpty')}
            locked={locked}
          />
        )}
      </FieldFrame>
      {substitute && regularName ? (
        <FieldNote
          appearance="strip"
          icon={<ArrowLeftRightIcon />}
          action={
            <Button
              type="button"
              variant="link"
              size="xs"
              className="h-auto px-0 font-semibold"
              onClick={() => onChange(regularTeacherId!)}
            >
              {t('substitutionRestore')}
            </Button>
          }
        >
          {t.rich('substitution', {
            name: regularName,
            b: (chunks) => <strong className="font-semibold">{chunks}</strong>,
          })}
        </FieldNote>
      ) : null}
      {picked && !locked ? (
        <FieldNote tone="warning" icon={<TriangleAlertIcon />}>
          {t('teacherBusyNote', {
            time: clock(picked.startsAtUtc),
            name: picked.group?.name ?? picked.student?.fullName ?? '',
          })}
        </FieldNote>
      ) : null}
    </div>
  );
}
