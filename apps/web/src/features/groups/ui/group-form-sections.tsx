'use client';

import type { ReactNode } from 'react';
import {
  CalendarIcon,
  ClockIcon,
  FileTextIcon,
  GraduationCapIcon,
  LayersIcon,
  UsersIcon,
  WalletIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { SUPPORTED_CURRENCIES } from '@tutorio/domain';
import type { GroupSchedule } from '@tutorio/validation';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { EntityPicker, type EntityPickerOption } from '@/components/shared/entity-picker';
import { FormSectionCard, type FormSectionTag } from '@/components/shared/form-section';
import { LinkPicker } from '@/components/shared/link-picker';
import { Notice } from '@/components/shared/notice';
import { TextField } from '@/components/shared/text-field';
import { WeekdayPicker } from '@/components/shared/weekday-picker';
import {
  GROUP_NOTES_MAX,
  type GroupFormSectionId,
  type GroupFormSectionStatus,
  type GroupFormValues,
} from '@/features/groups/model/form';
import type { StudentFormPicker } from '@/features/students';
import { cn } from '@/lib/utils';
import { GroupSchedulePills } from './group-parts';

export const GROUP_FORM_SECTION_ICON: Record<GroupFormSectionId, ReactNode> = {
  basics: <LayersIcon />,
  schedule: <CalendarIcon />,
  price: <WalletIcon />,
  students: <UsersIcon />,
  notes: <FileTextIcon />,
};

export function groupFormSectionId(id: GroupFormSectionId) {
  return `group-form-${id}`;
}

/**
 * The five sections of the group form. Each is a card with its heading; the
 * fields read and write the surrounding `FormProvider`. Only the name is
 * required. The schedule is created here only for a group that has none; an
 * existing one shows as pills with the way to the recurring-lessons screen.
 */
export function GroupFormSections({
  status,
  picker,
  teachers,
  teachersLoading = false,
  showTeacher,
  teacherHint,
  lockedSchedules,
  timezone,
}: {
  status: Record<GroupFormSectionId, GroupFormSectionStatus>;
  picker: StudentFormPicker;
  teachers: EntityPickerOption[];
  teachersLoading?: boolean;
  /** A solo tutor never picks a teacher. */
  showTeacher: boolean;
  /** Under the teacher on edit: a new teacher takes the upcoming lessons. */
  teacherHint?: string;
  /** The group's live schedule, when it already has one. */
  lockedSchedules?: readonly GroupSchedule[];
  timezone: string;
}) {
  const t = useTranslations('groups.form');
  const tLinks = useTranslations('links');
  const tCurrencies = useTranslations('currencies');
  const { control, register, formState, setValue, getValues } = useFormContext<GroupFormValues>();
  const { errors, isSubmitting } = formState;
  const disabled = isSubmitting;
  const notes = useWatch({ control, name: 'notes' });
  const weekdays = useWatch({ control, name: 'weekdays' });
  const studentIds = useWatch({ control, name: 'studentIds' });

  const required: FormSectionTag = { label: t('tagRequired'), tone: 'required' };
  const optional: FormSectionTag = { label: t('tagOptional'), tone: 'optional' };
  const section = (id: GroupFormSectionId, tag: FormSectionTag, children: ReactNode) => (
    <FormSectionCard
      id={groupFormSectionId(id)}
      icon={GROUP_FORM_SECTION_ICON[id]}
      title={t(`sections.${id}.title`)}
      description={t(`sections.${id}.description`)}
      tag={tag}
      invalid={status[id] === 'error'}
    >
      {children}
    </FormSectionCard>
  );

  const setStudents = (next: string[]) =>
    setValue('studentIds', next, { shouldDirty: true, shouldValidate: formState.isSubmitted });
  const linked = (studentIds ?? []).map((id) => picker.known[id] ?? { id, name: '…' });

  return (
    <div className="flex flex-col gap-4">
      {section(
        'basics',
        required,
        <>
          <TextField
            label={t('name')}
            required
            placeholder={t('namePlaceholder')}
            autoComplete="off"
            disabled={disabled}
            error={errors.name?.message}
            {...register('name')}
          />
          <div
            className={cn(
              'grid gap-4 sm:items-start',
              showTeacher && 'sm:grid-cols-[minmax(0,1fr)_200px]',
            )}
          >
            {showTeacher ? (
              <Controller
                control={control}
                name="teacherId"
                render={({ field }) => {
                  return (
                    <Field className="gap-2">
                      <FieldLabel htmlFor="group-teacher" className="text-sm leading-5 font-medium">
                        {t('teacher')}
                      </FieldLabel>
                      <EntityPicker
                        id="group-teacher"
                        appearance="field"
                        icon={<GraduationCapIcon />}
                        value={field.value ?? undefined}
                        onChange={(next) => field.onChange(next ?? null)}
                        options={teachers}
                        placeholder={t('teacherPlaceholder')}
                        searchPlaceholder={t('teacherSearch')}
                        emptyLabel={t('teacherEmpty')}
                        isLoading={teachersLoading}
                        disabled={disabled}
                        invalid={Boolean(errors.teacherId)}
                        aria-describedby={
                          errors.teacherId || teacherHint ? 'group-teacher-message' : undefined
                        }
                      />
                      {errors.teacherId ? (
                        <FieldError id="group-teacher-message" className="text-[13px]">
                          {errors.teacherId.message}
                        </FieldError>
                      ) : teacherHint ? (
                        <p id="group-teacher-message" className="text-[13px] text-muted-foreground">
                          {teacherHint}
                        </p>
                      ) : null}
                    </Field>
                  );
                }}
              />
            ) : null}
            <TextField
              label={t('capacity')}
              inputMode="numeric"
              placeholder={t('capacityPlaceholder')}
              hint={t('capacityHint')}
              disabled={disabled}
              error={errors.capacity?.message}
              {...register('capacity')}
            />
          </div>
        </>,
      )}

      {section(
        'schedule',
        optional,
        lockedSchedules && lockedSchedules.length > 0 ? (
          <div className="flex flex-col gap-3">
            <GroupSchedulePills schedules={lockedSchedules} />
            <Notice tone="info" title={t('scheduleLocked')} text={t('scheduleLockedHint')} />
          </div>
        ) : (
          <>
            <Controller
              control={control}
              name="weekdays"
              render={({ field }) => (
                <Field className="gap-2">
                  <FieldLabel id="group-weekdays-label" className="text-sm leading-5 font-medium">
                    {t('weekdays')}
                  </FieldLabel>
                  <WeekdayPicker
                    id="group-weekdays"
                    aria-labelledby="group-weekdays-label"
                    appearance="pills"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={disabled}
                  />
                </Field>
              )}
            />
            {weekdays.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-4 sm:items-start">
                  <TextField
                    type="time"
                    label={t('start')}
                    icon={<ClockIcon />}
                    disabled={disabled}
                    error={errors.localTime?.message}
                    {...register('localTime')}
                  />
                  <TextField
                    label={t('duration')}
                    inputMode="numeric"
                    suffix={t('minutes')}
                    disabled={disabled}
                    error={errors.durationMin?.message}
                    {...register('durationMin')}
                  />
                </div>
                <Notice tone="info" icon={<ClockIcon />} text={t('timezoneNote', { timezone })} />
              </>
            ) : null}
          </>
        ),
      )}

      {section(
        'price',
        optional,
        <div className="grid grid-cols-2 gap-4 sm:items-start">
          <TextField
            label={t('price')}
            icon={<WalletIcon />}
            inputMode="decimal"
            placeholder={t('pricePlaceholder')}
            disabled={disabled}
            error={errors.pricePerLesson?.message}
            {...register('pricePerLesson')}
          />
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <TextField
                type="select"
                label={t('currency')}
                disabled={disabled}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                options={SUPPORTED_CURRENCIES.map((code) => ({
                  value: code,
                  label: tCurrencies(code).replace(' — ', ' · '),
                }))}
              />
            )}
          />
        </div>,
      )}

      {section(
        'students',
        optional,
        <>
          <LinkPicker
            framed={false}
            linked={linked}
            linkedLabel={tLinks('linkedCount', { count: linked.length })}
            emptyText={tLinks('nothingLinked')}
            unlinkLabel={(name) => tLinks('remove', { name })}
            onUnlink={(id) => setStudents(getValues('studentIds').filter((item) => item !== id))}
            fieldLabel={t('addStudent')}
            searchLabel={t('addStudent')}
            placeholder={tLinks('searchPlaceholder')}
            search={picker.search}
            onSearchChange={picker.onSearchChange}
            open={picker.open}
            onOpenChange={picker.onOpenChange}
            results={picker.results}
            loading={picker.loading}
            selected={[]}
            onToggle={(id) => {
              const item = picker.results.find((result) => result.id === id);
              if (item) picker.remember(item);
              setStudents([...getValues('studentIds'), id]);
            }}
            listLabel={tLinks('listLabel')}
            emptyTitle={tLinks('noResultsTitle')}
            emptyHint={tLinks('noResultsHint')}
            chooseText={tLinks('choose')}
            keyboardHint={tLinks('keyboardHint')}
            linkedAnnouncement={(name) => tLinks('linkedAnnouncement', { name })}
            unlinkedAnnouncement={(name) => tLinks('unlinkedAnnouncement', { name })}
            createLabel={picker.onCreate ? t('createStudent') : undefined}
            onCreate={picker.onCreate}
            disabled={disabled}
          />
          {errors.studentIds ? (
            <FieldError className="text-[13px]">{errors.studentIds.message}</FieldError>
          ) : null}
        </>,
      )}

      {section(
        'notes',
        optional,
        <TextField
          type="textarea"
          label={t('notes')}
          aside={`${(notes ?? '').length} / ${GROUP_NOTES_MAX}`}
          rows={4}
          maxLength={GROUP_NOTES_MAX}
          placeholder={t('notesPlaceholder')}
          disabled={disabled}
          error={errors.notes?.message}
          {...register('notes')}
        />,
      )}
    </div>
  );
}
