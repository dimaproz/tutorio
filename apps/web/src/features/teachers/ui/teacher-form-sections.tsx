'use client';

import type { ReactNode } from 'react';
import { MailIcon, PhoneIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { SUPPORTED_CURRENCIES } from '@tutorio/domain';
import { TEACHER_SUBJECTS_MAX, type TeacherListItem } from '@tutorio/validation';
import { AvatarPicker } from '@/components/shared/avatar-picker';
import { FormSectionCard, type FormSectionTag } from '@/components/shared/form-section';
import { TextField } from '@/components/shared/text-field';
import { Switch } from '@/components/ui/switch';
import { formatMoneyCompact } from '@/lib/money';
import {
  filteredRegistration,
  keepPhoneCharacters,
  keepTelegramCharacters,
} from '@/lib/forms/input-filters';
import {
  TEACHER_BIO_MAX,
  TEACHER_NOTES_MAX,
  type TeacherFormSectionId,
  type TeacherFormSectionStatus,
  type TeacherFormValues,
} from '../model/form';
import {
  studioSubjects,
  teacherColor,
  usedTeacherColors,
  withSubject,
  withoutSubject,
} from '../model/presentation';
import { ColorField } from './color-field';
import { SubjectsField } from './subjects-field';
import { TEACHER_FORM_SECTION_ICON, teacherFormSectionId } from './teacher-form-state';

/** The owner's «Я викладаю» in the form: a live command, not a field. */
export type TeachingSwitch = {
  teaching: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
};

/**
 * The four sections of the teacher form (S09 board 03). Each is a card with
 * its heading; the fields read and write the surrounding `FormProvider`. Only
 * the name is required. The studio's teachers feed the subjects popover, the
 * used colours and the calendar preview.
 */
export function TeacherFormSections({
  status,
  teachers,
  selfId,
  teachingSwitch,
}: {
  status: Record<TeacherFormSectionId, TeacherFormSectionStatus>;
  /** Every teacher of the studio, this one included. */
  teachers: TeacherListItem[];
  /** The teacher being edited; omitted on create. */
  selfId?: string;
  /** The owner's own profile only. */
  teachingSwitch?: TeachingSwitch;
}) {
  const t = useTranslations('teachers.form');
  const tCurrencies = useTranslations('currencies');
  const locale = useLocale();
  const { control, register, formState, setValue } = useFormContext<TeacherFormValues>();
  const { errors, isSubmitting } = formState;
  const disabled = isSubmitting;
  const fullName = useWatch({ control, name: 'fullName' });
  const subjects = useWatch({ control, name: 'subjects' });
  const currency = useWatch({ control, name: 'currency' });
  const bio = useWatch({ control, name: 'bio' });
  const notes = useWatch({ control, name: 'notes' });

  const required: FormSectionTag = { label: t('tagRequired'), tone: 'required' };
  const optional: FormSectionTag = { label: t('tagOptional'), tone: 'optional' };
  const section = (id: TeacherFormSectionId, tag: FormSectionTag, children: ReactNode) => (
    <FormSectionCard
      id={teacherFormSectionId(id)}
      icon={TEACHER_FORM_SECTION_ICON[id]}
      title={t(`sections.${id}.title`)}
      description={t(`sections.${id}.description`)}
      tag={tag}
      invalid={status[id] === 'error'}
    >
      {children}
    </FormSectionCard>
  );

  const phone = filteredRegistration(register('phone'), keepPhoneCharacters);
  const telegram = filteredRegistration(register('telegramUsername'), keepTelegramCharacters);
  const setSubjects = (next: string[]) =>
    setValue('subjects', next, { shouldDirty: true, shouldValidate: formState.isSubmitted });
  const other = teachers.find(
    (teacher) => teacher.id !== selfId && teacher.status === 'ACTIVE' && !teacher.deletedAt,
  );
  const sign = formatMoneyCompact(100, currency, locale).symbol;

  return (
    <div className="flex flex-col gap-4">
      {section(
        'identity',
        required,
        <>
          <Controller
            control={control}
            name="avatarKey"
            render={({ field }) => (
              <AvatarPicker
                value={field.value}
                onChange={(next) => field.onChange(next)}
                fullName={fullName}
                initialsLabel={t('avatarInitials')}
                label={t('avatar')}
                disabled={disabled}
              />
            )}
          />
          <TextField
            label={t('fullName')}
            required
            placeholder={t('fullNamePlaceholder')}
            autoComplete="off"
            disabled={disabled}
            error={errors.fullName?.message}
            {...register('fullName')}
          />
        </>,
      )}

      {section(
        'contacts',
        optional,
        <>
          <TextField
            label={t('email')}
            type="email"
            icon={<MailIcon />}
            placeholder={t('emailPlaceholder')}
            autoComplete="off"
            disabled={disabled}
            error={errors.email?.message}
            {...register('email')}
          />
          <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
            <TextField
              label={t('phone')}
              type="tel"
              icon={<PhoneIcon />}
              inputMode="tel"
              placeholder={t('phonePlaceholder')}
              disabled={disabled}
              error={errors.phone?.message}
              {...phone}
            />
            <TextField
              label={t('telegramUsername')}
              prefix="@"
              autoComplete="off"
              placeholder={t('telegramPlaceholder')}
              disabled={disabled}
              error={errors.telegramUsername?.message}
              {...telegram}
            />
          </div>
        </>,
      )}

      {section(
        'teaching',
        optional,
        <>
          {teachingSwitch ? (
            <label className="flex items-center gap-3 rounded-tile bg-background px-4 py-3.5">
              <span className="flex min-w-0 grow flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{t('teaches')}</span>
                <span className="text-[13px] text-muted-foreground">
                  {teachingSwitch.teaching ? t('teachesOn') : t('teachesOff')}
                </span>
              </span>
              <Switch
                checked={teachingSwitch.teaching}
                disabled={teachingSwitch.busy || disabled}
                onCheckedChange={teachingSwitch.onChange}
              />
            </label>
          ) : null}
          <SubjectsField
            value={subjects}
            studio={studioSubjects(teachers, subjects, selfId)}
            onAdd={(subject) => setSubjects(withSubject(subjects, subject))}
            onRemove={(subject) => setSubjects(withoutSubject(subjects, subject))}
            max={TEACHER_SUBJECTS_MAX}
            error={errors.subjects?.message}
            disabled={disabled}
          />
          <div className="grid grid-cols-2 gap-4 sm:items-start">
            <TextField
              label={t('rate')}
              inputMode="decimal"
              suffix={sign}
              placeholder={t('ratePlaceholder')}
              hint={t('rateHint')}
              disabled={disabled}
              error={errors.rate?.message}
              {...register('rate')}
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
          </div>
          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <ColorField
                value={field.value}
                onChange={field.onChange}
                used={usedTeacherColors(teachers, selfId)}
                disabled={disabled}
                self={{
                  name: fullName.trim() || t('previewName'),
                  subject: subjects[0],
                  color: field.value,
                }}
                other={
                  other
                    ? {
                        name: other.fullName,
                        subject: other.subjects[0],
                        color: teacherColor(other),
                      }
                    : undefined
                }
              />
            )}
          />
        </>,
      )}

      {section(
        'about',
        optional,
        <>
          <TextField
            type="textarea"
            label={t('bio')}
            aside={`${(bio ?? '').length} / ${TEACHER_BIO_MAX}`}
            rows={3}
            maxLength={TEACHER_BIO_MAX}
            placeholder={t('bioPlaceholder')}
            disabled={disabled}
            error={errors.bio?.message}
            {...register('bio')}
          />
          <TextField
            type="textarea"
            label={t('notes')}
            aside={`${(notes ?? '').length} / ${TEACHER_NOTES_MAX}`}
            rows={3}
            maxLength={TEACHER_NOTES_MAX}
            placeholder={t('notesPlaceholder')}
            disabled={disabled}
            error={errors.notes?.message}
            {...register('notes')}
          />
        </>,
      )}
    </div>
  );
}
