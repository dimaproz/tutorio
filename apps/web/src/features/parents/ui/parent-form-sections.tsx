'use client';

import type { ReactNode } from 'react';
import { FileTextIcon, MailIcon, PhoneIcon, UserIcon, UsersIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { AvatarPicker } from '@/components/shared/avatar-picker';
import { FormSectionCard, type FormSectionTag } from '@/components/shared/form-section';
import { LinkPicker, type LinkPickerItem } from '@/components/shared/link-picker';
import { TextField } from '@/components/shared/text-field';
import { FieldError } from '@/components/ui/field';
import {
  PARENT_NOTES_MAX,
  type ParentFormSectionId,
  type ParentFormSectionStatus,
  type ParentFormValues,
} from '@/features/parents/model/form';
import {
  filteredRegistration,
  keepPhoneCharacters,
  keepTelegramCharacters,
} from '@/lib/forms/input-filters';

export const PARENT_FORM_SECTION_ICON: Record<ParentFormSectionId, ReactNode> = {
  identity: <UserIcon />,
  contacts: <PhoneIcon />,
  students: <UsersIcon />,
  notes: <FileTextIcon />,
};

export function parentFormSectionId(id: ParentFormSectionId) {
  return `parent-form-${id}`;
}

/**
 * The student search behind the linked-students section. The orchestrator
 * owns the query; the section only renders what it is handed.
 */
export type ParentStudentPicker = {
  search: string;
  onSearchChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Search results, already without the linked students. */
  results: LinkPickerItem[];
  loading: boolean;
  /** Every student the form knows by id, so linked rows show a name. */
  known: Record<string, LinkPickerItem>;
  /** Keeps a picked result known after it leaves the results. */
  remember: (item: LinkPickerItem) => void;
  onCreate?: () => void;
};

/**
 * The four sections of the parent form. Each is a card with its heading; the
 * fields read and write the surrounding `FormProvider`. Only the name is
 * required. Removing a linked student is a plain ✕: the change applies on save.
 */
export function ParentFormSections({
  status,
  picker,
}: {
  status: Record<ParentFormSectionId, ParentFormSectionStatus>;
  picker: ParentStudentPicker;
}) {
  const t = useTranslations('parents.form');
  const tLinks = useTranslations('links');
  const tParentLinks = useTranslations('parents.links');
  const { control, register, formState, setValue, getValues } = useFormContext<ParentFormValues>();
  const { errors, isSubmitting } = formState;
  const disabled = isSubmitting;
  const fullName = useWatch({ control, name: 'fullName' });
  const notes = useWatch({ control, name: 'notes' });
  const studentIds = useWatch({ control, name: 'studentIds' });

  const required: FormSectionTag = { label: t('tagRequired'), tone: 'required' };
  const optional: FormSectionTag = { label: t('tagOptional'), tone: 'optional' };
  const section = (id: ParentFormSectionId, tag: FormSectionTag, children: ReactNode) => (
    <FormSectionCard
      id={parentFormSectionId(id)}
      icon={PARENT_FORM_SECTION_ICON[id]}
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
  const setStudents = (next: string[]) =>
    setValue('studentIds', next, { shouldDirty: true, shouldValidate: formState.isSubmitted });
  const linked = (studentIds ?? []).map((id) => picker.known[id] ?? { id, name: '…' });

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
            createLabel={picker.onCreate ? tParentLinks('createStudent') : undefined}
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
          aside={`${(notes ?? '').length} / ${PARENT_NOTES_MAX}`}
          rows={4}
          maxLength={PARENT_NOTES_MAX}
          placeholder={t('notesPlaceholder')}
          disabled={disabled}
          error={errors.notes?.message}
          {...register('notes')}
        />,
      )}
    </div>
  );
}
