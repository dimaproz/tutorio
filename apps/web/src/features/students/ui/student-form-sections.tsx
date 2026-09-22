'use client';

import type { ChangeEvent, ReactNode } from 'react';
import {
  ClockIcon,
  FileTextIcon,
  GraduationCapIcon,
  MailIcon,
  PhoneIcon,
  UserIcon,
  WalletCardsIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { SUPPORTED_CURRENCIES } from '@tutorio/domain';
import { STUDENT_KNOWLEDGE_LEVELS, STUDENT_LANGUAGE_LEVELS } from '@tutorio/validation';
import { AvatarPicker } from '@/components/shared/avatar-picker';
import { FormSectionCard, type FormSectionTag } from '@/components/shared/form-section';
import { TextField } from '@/components/shared/text-field';
import { TimezoneCombobox } from '@/components/shared/timezone-combobox';
import { FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import type {
  StudentFormSectionId,
  StudentFormSectionStatus,
  StudentFormValues,
} from '@/features/students/model/form';

const NOTES_MAX = 4000;
/** Radix Select cannot hold an empty value, so "not set" has its own token. */
const UNSET = '__unset';

export const STUDENT_FORM_SECTION_ICON: Record<StudentFormSectionId, ReactNode> = {
  identity: <UserIcon />,
  contacts: <PhoneIcon />,
  learning: <GraduationCapIcon />,
  preferences: <ClockIcon />,
  pricing: <WalletCardsIcon />,
  notes: <FileTextIcon />,
};

export function studentFormSectionId(id: StudentFormSectionId) {
  return `student-form-${id}`;
}

function onlyPhoneCharacters(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = event.target.value.replace(/[^\d\s()+-]/g, '');
}

function onlyTelegramCharacters(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = event.target.value.replace(/^@+/, '').replace(/[^\w]/g, '');
}

/**
 * The six sections of the student form. Each is a card with its heading; the
 * fields read and write the surrounding `FormProvider`. `readOnly` renders the
 * archived view: every control disabled and every card dimmed.
 */
export function StudentFormSections({
  status,
  readOnly = false,
  timezoneFromBrowser = false,
}: {
  status: Record<StudentFormSectionId, StudentFormSectionStatus>;
  readOnly?: boolean;
  /** Shows that the timezone was prefilled from the browser. */
  timezoneFromBrowser?: boolean;
}) {
  const t = useTranslations('students.form');
  const tLanguage = useTranslations('languageLevel');
  const tKnowledge = useTranslations('knowledgeLevel');
  const tCurrencies = useTranslations('currencies');
  const tCommon = useTranslations('common');
  const { control, register, formState, setValue } = useFormContext<StudentFormValues>();
  const { errors, isSubmitting } = formState;
  const disabled = readOnly || isSubmitting;
  const fullName = useWatch({ control, name: 'fullName' });
  const notes = useWatch({ control, name: 'notes' });

  const required: FormSectionTag = { label: t('tagRequired'), tone: 'required' };
  const optional: FormSectionTag = { label: t('tagOptional'), tone: 'optional' };
  const section = (id: StudentFormSectionId, tag: FormSectionTag, children: ReactNode) => (
    <FormSectionCard
      id={studentFormSectionId(id)}
      icon={STUDENT_FORM_SECTION_ICON[id]}
      title={t(`sections.${id}.title`)}
      description={t(`sections.${id}.description`)}
      tag={tag}
      invalid={status[id] === 'error'}
      dimmed={readOnly}
    >
      {children}
    </FormSectionCard>
  );

  const phone = register('phone', { onChange: onlyPhoneCharacters });
  const telegram = register('telegramUsername', { onChange: onlyTelegramCharacters });

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
              disabled={disabled}
              error={errors.phone?.message}
              {...phone}
            />
            <TextField
              label={t('telegramUsername')}
              prefix="@"
              autoComplete="off"
              disabled={disabled}
              error={errors.telegramUsername?.message}
              {...telegram}
            />
          </div>
        </>,
      )}

      {section(
        'learning',
        optional,
        <>
          <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
            <TextField
              label={t('age')}
              inputMode="numeric"
              placeholder="0–120"
              disabled={disabled}
              error={errors.age?.message}
              {...register('age')}
            />
            <TextField
              label={t('grade')}
              inputMode="numeric"
              placeholder="1–12"
              disabled={disabled}
              error={errors.grade?.message}
              {...register('grade')}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
            <Controller
              control={control}
              name="knowledgeLevel"
              render={({ field }) => (
                <TextField
                  type="select"
                  label={t('generalLevel')}
                  placeholder={tCommon('notProvided')}
                  disabled={disabled}
                  value={field.value === '' ? UNSET : field.value}
                  onValueChange={(next) => field.onChange(next === UNSET ? '' : next)}
                  onBlur={field.onBlur}
                  options={[
                    { value: UNSET, label: tCommon('notProvided') },
                    ...STUDENT_KNOWLEDGE_LEVELS.map((level) => ({
                      value: level,
                      label: tKnowledge(level),
                    })),
                  ]}
                />
              )}
            />
            <Controller
              control={control}
              name="languageLevel"
              render={({ field }) => (
                <TextField
                  type="select"
                  label={t('languageLevelCefr')}
                  placeholder={tCommon('notProvided')}
                  disabled={disabled}
                  value={field.value === '' ? UNSET : field.value}
                  onValueChange={(next) => field.onChange(next === UNSET ? '' : next)}
                  onBlur={field.onBlur}
                  options={[
                    { value: UNSET, label: tCommon('notProvided') },
                    ...STUDENT_LANGUAGE_LEVELS.map((level) => ({
                      value: level,
                      label: tLanguage(level),
                    })),
                  ]}
                />
              )}
            />
          </div>
        </>,
      )}

      {section(
        'preferences',
        optional,
        <Controller
          control={control}
          name="timezone"
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="student-form-timezone-input" className="text-sm leading-5">
                {t('timezone')}
              </FieldLabel>
              <TimezoneCombobox
                id="student-form-timezone-input"
                value={field.value}
                onChange={(next) =>
                  setValue('timezone', next, { shouldDirty: true, shouldValidate: true })
                }
                placeholder={t('timezonePlaceholder')}
                searchPlaceholder={t('timezoneSearch')}
                emptyLabel={t('timezoneEmpty')}
                invalid={Boolean(errors.timezone)}
                describedBy="student-form-timezone-message"
                disabled={disabled}
              />
              {errors.timezone ? (
                <FieldError id="student-form-timezone-message" className="text-[13px]">
                  {errors.timezone.message}
                </FieldError>
              ) : timezoneFromBrowser ? (
                <FieldDescription id="student-form-timezone-message" className="text-[13px]">
                  {t('timezoneFromBrowser')}
                </FieldDescription>
              ) : null}
            </div>
          )}
        />,
      )}

      {section(
        'pricing',
        optional,
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-start">
          <TextField
            label={t('pricePerLesson')}
            inputMode="decimal"
            hint={t('pricePerLessonHint')}
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
        'notes',
        optional,
        <TextField
          type="textarea"
          label={t('notes')}
          aside={`${(notes ?? '').length} / ${NOTES_MAX}`}
          rows={4}
          maxLength={NOTES_MAX}
          placeholder={t('notesPlaceholder')}
          disabled={disabled}
          error={errors.notes?.message}
          {...register('notes')}
        />,
      )}
    </div>
  );
}
