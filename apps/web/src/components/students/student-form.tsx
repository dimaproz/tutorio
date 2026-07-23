'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import {
  BanknoteIcon,
  GlobeIcon,
  GraduationCapIcon,
  ImageIcon,
  PhoneIcon,
  PlusIcon,
  StickyNoteIcon,
  UserIcon,
  UsersRoundIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  isLanguageSubject,
  STUDENT_KNOWLEDGE_LEVELS,
  STUDENT_LANGUAGE_LEVELS,
  STUDENT_SUBJECTS,
  type StudentDetail,
  type StudentParentRef,
} from '@tutorio/validation';
import { EntityCombobox } from '@/components/enrollments/entity-combobox';
import { ParentFormDialog } from '@/components/parents/parent-form-dialog';
import { ParentMiniCard } from '@/components/parents/parent-mini-card';
import { AvatarPicker } from '@/components/app/avatar-picker';
import { CurrencyOption } from '@/components/app/currency-option';
import { FormSection } from '@/components/app/form-section';
import { MoneyInput } from '@/components/app/money-input';
import { StatusSelect, useStudentStatusOptions } from '@/components/app/status-select';
import { detectTimezone, TimezoneCombobox } from '@/components/app/timezone-combobox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { errorMessageKey } from '@/lib/api/error-message';
import { useParentsQuery } from '@/lib/api/parents';
import { useCreateStudentMutation, useUpdateStudentMutation } from '@/lib/api/students';
import { useSession } from '@/components/app/session-provider';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import {
  EMPTY_STUDENT_FORM,
  studentFormSchema,
  type StudentFormValues,
} from '@/lib/forms/schemas';
import { formatPriceInput, parsePriceInput } from '@/lib/money';

const CURRENCIES = ['EUR', 'UAH', 'PLN', 'USD', 'GBP'] as const;
// Ukrainian school system: grades 1–12, offered as a closed dropdown.
const GRADES = Array.from({ length: 12 }, (_, index) => String(index + 1));
// Sentinel for "unset" — Radix Select cannot hold an empty string value.
const NONE = '__none__';
// Characters allowed while typing a phone number: digits, spaces and + ( ) -.
const NON_PHONE = /[^\d\s()+-]/g;
const NON_DIGIT = /\D/g;

// One component for both modes: creating sends only filled fields, editing
// sends null for cleared ones so the API knows to erase them. Rendered inside
// a Dialog (see StudentFormDialog) — the caller owns the open state and is
// told when to close it via onSuccess/onCancel rather than the form
// navigating itself.
export function StudentForm({
  student,
  onSuccess,
  onCancel,
}: {
  student?: StudentDetail;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations('students.form');
  const tStudents = useTranslations('students');
  const tSubject = useTranslations('subject');
  const tLanguageLevel = useTranslations('languageLevel');
  const tKnowledgeLevel = useTranslations('knowledgeLevel');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const tCommon = useTranslations('common');
  const statusOptions = useStudentStatusOptions();
  const session = useSession();

  const isEdit = Boolean(student);
  const createStudent = useCreateStudentMutation();
  const updateStudent = useUpdateStudentMutation(student?.id ?? '');
  const mutation = isEdit ? updateStudent : createStudent;

  const [assignedParents, setAssignedParents] = useState<StudentParentRef[]>(
    student?.parents ?? [],
  );
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const parentsQuery = useParentsQuery({ page: 1, pageSize: 100 });

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    defaultValues: student
      ? {
          fullName: student.fullName,
          email: student.email ?? '',
          phone: student.phone ?? '',
          timezone: student.timezone,
          telegramUsername: (student.telegramUsername ?? '').replace(/^@/, ''),
          subject: student.subject ?? '',
          hourlyRate:
            student.hourlyRateMinor != null ? formatPriceInput(student.hourlyRateMinor) : '',
          currency:
            (student.currency as StudentFormValues['currency'] | null) ??
            (session.workspace.defaultCurrency as StudentFormValues['currency']),
          status: student.status,
          languageLevel: student.languageLevel ?? '',
          knowledgeLevel: student.knowledgeLevel ?? '',
          age: student.age != null ? String(student.age) : '',
          grade: student.grade != null ? String(student.grade) : '',
          avatarKey: student.avatarKey,
          parentIds: student.parents.map((parent) => parent.id),
          notes: student.notes ?? '',
        }
      : { ...EMPTY_STUDENT_FORM, currency: session.workspace.defaultCurrency as StudentFormValues['currency'] },
  });
  const { errors, isSubmitting } = form.formState;
  const values = form.watch();
  const showLanguageLevel = isLanguageSubject(values.subject === '' ? null : values.subject);

  // New students default to the browser timezone (Europe/Kyiv as fallback).
  useEffect(() => {
    if (!isEdit && !form.getValues('timezone')) {
      form.setValue('timezone', detectTimezone());
    }
  }, [isEdit, form]);

  useEffect(() => {
    form.setValue(
      'parentIds',
      assignedParents.map((parent) => parent.id),
      { shouldValidate: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only on list change
  }, [assignedParents]);

  // A CEFR level is meaningless for a non-language subject — drop any leftover
  // value when the subject moves away from a language so we never submit one.
  useEffect(() => {
    if (!showLanguageLevel && form.getValues('languageLevel') !== '') {
      form.setValue('languageLevel', '');
    }
  }, [showLanguageLevel, form]);

  const parentsById = useMemo(
    () => new Map((parentsQuery.data?.items ?? []).map((parent) => [parent.id, parent])),
    [parentsQuery.data],
  );

  const parentOptions = useMemo(() => {
    const assignedIds = new Set(assignedParents.map((parent) => parent.id));
    return (parentsQuery.data?.items ?? [])
      .filter((parent) => !assignedIds.has(parent.id))
      .map((parent) => ({ value: parent.id, label: parent.fullName }));
  }, [parentsQuery.data, assignedParents]);

  function addParent(parent: StudentParentRef) {
    setAssignedParents((current) =>
      current.some((existing) => existing.id === parent.id) ? current : [...current, parent],
    );
  }

  function removeParent(parentId: string) {
    setAssignedParents((current) => current.filter((parent) => parent.id !== parentId));
  }

  // Register a text field but strip disallowed characters on every keystroke,
  // so a phone/age field simply refuses letters rather than failing validation.
  function sanitizedRegister(name: 'phone' | 'age' | 'telegramUsername', strip: RegExp) {
    const registration = form.register(name);
    return {
      ...registration,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        event.target.value = event.target.value.replace(strip, '');
        return registration.onChange(event);
      },
    };
  }

  const onSubmit = form.handleSubmit(async (formValues) => {
    const optional = (value: string) => (value.trim() === '' ? undefined : value);
    const hourlyRateMinor =
      formValues.hourlyRate.trim() === '' ? null : parsePriceInput(formValues.hourlyRate);

    try {
      if (student) {
        // PATCH: an emptied field becomes null so the API clears it.
        const cleared = (value: string) => (value.trim() === '' ? null : value);
        await updateStudent.mutateAsync({
          fullName: formValues.fullName,
          email: cleared(formValues.email),
          phone: cleared(formValues.phone),
          timezone: formValues.timezone,
          telegramUsername: cleared(formValues.telegramUsername),
          subject: formValues.subject === '' ? null : formValues.subject,
          hourlyRateMinor,
          currency: hourlyRateMinor === null ? null : formValues.currency,
          status: formValues.status,
          languageLevel: formValues.languageLevel === '' ? null : formValues.languageLevel,
          knowledgeLevel: formValues.knowledgeLevel === '' ? null : formValues.knowledgeLevel,
          age: formValues.age.trim() === '' ? null : Number(formValues.age),
          grade: formValues.grade.trim() === '' ? null : Number(formValues.grade),
          avatarKey: formValues.avatarKey,
          parentIds: formValues.parentIds,
          notes: cleared(formValues.notes),
        });
        toast.success(tStudents('toasts.updated'));
        onSuccess?.();
        return;
      }

      await createStudent.mutateAsync({
        fullName: formValues.fullName,
        email: optional(formValues.email),
        phone: optional(formValues.phone),
        timezone: formValues.timezone,
        telegramUsername: optional(formValues.telegramUsername),
        subject: formValues.subject === '' ? undefined : formValues.subject,
        hourlyRateMinor: hourlyRateMinor ?? undefined,
        currency: hourlyRateMinor === null ? undefined : formValues.currency,
        status: formValues.status,
        languageLevel: formValues.languageLevel === '' ? undefined : formValues.languageLevel,
        knowledgeLevel:
          formValues.knowledgeLevel === '' ? undefined : formValues.knowledgeLevel,
        age: formValues.age.trim() === '' ? undefined : Number(formValues.age),
        grade: formValues.grade.trim() === '' ? undefined : Number(formValues.grade),
        avatarKey: formValues.avatarKey ?? undefined,
        parentIds: formValues.parentIds,
        notes: optional(formValues.notes),
      });
      toast.success(tStudents('toasts.created'));
      onSuccess?.();
    } catch {
      // Surfaced by the alert below.
    }
  });

  const pending = isSubmitting || mutation.isPending;

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {mutation.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{tErrors(errorMessageKey(mutation.error))}</AlertDescription>
          </Alert>
        ) : null}

        <FormSection icon={ImageIcon} tone="fuchsia" title={t('avatarSection')}>
          <AvatarPicker
            value={values.avatarKey ?? null}
            onChange={(next) => form.setValue('avatarKey', next)}
            fullName={values.fullName}
            initialsLabel={t('avatarInitials')}
          />
        </FormSection>

        <FieldSeparator />

        <FormSection icon={UserIcon} tone="indigo" title={t('basicSection')}>
          <Field data-invalid={errors.fullName ? true : undefined}>
            <FieldLabel htmlFor="student-full-name">{t('fullName')}</FieldLabel>
            <Input
              id="student-full-name"
              autoComplete="name"
              placeholder={t('fullNamePlaceholder')}
              aria-invalid={errors.fullName ? true : undefined}
              {...form.register('fullName')}
            />
            <FieldError errors={[errors.fullName]} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="student-subject">{t('subject')}</FieldLabel>
              <Select
                value={values.subject === '' ? NONE : values.subject}
                onValueChange={(value) =>
                  form.setValue(
                    'subject',
                    value === NONE ? '' : (value as StudentFormValues['subject']),
                  )
                }
              >
                <SelectTrigger id="student-subject" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={NONE}>{tCommon('notProvided')}</SelectItem>
                    {STUDENT_SUBJECTS.map((subject) => (
                      <SelectItem key={subject} value={subject}>
                        {tSubject(subject)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="student-status">{t('status')}</FieldLabel>
              <StatusSelect
                id="student-status"
                value={values.status}
                onValueChange={(value) =>
                  form.setValue('status', value as StudentFormValues['status'])
                }
                options={statusOptions}
              />
            </Field>
          </div>
        </FormSection>

        <FieldSeparator />

        <FormSection
          icon={PhoneIcon}
          tone="sky"
          title={t('contactsSection')}
          description={t('contactsHint')}
        >
          <Field data-invalid={errors.email ? true : undefined}>
            <FieldLabel htmlFor="student-email">{t('email')}</FieldLabel>
            <Input
              id="student-email"
              type="email"
              inputMode="email"
              spellCheck={false}
              placeholder={t('emailPlaceholder')}
              aria-invalid={errors.email ? true : undefined}
              {...form.register('email')}
            />
            <FieldError errors={[errors.email]} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={errors.phone ? true : undefined}>
              <FieldLabel htmlFor="student-phone">{t('phone')}</FieldLabel>
              <Input
                id="student-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={t('phonePlaceholder')}
                aria-invalid={errors.phone ? true : undefined}
                {...sanitizedRegister('phone', NON_PHONE)}
              />
              <FieldError errors={[errors.phone]} />
            </Field>
            <Field data-invalid={errors.telegramUsername ? true : undefined}>
              <FieldLabel htmlFor="student-telegram">{t('telegramUsername')}</FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground select-none">
                  @
                </span>
                <Input
                  id="student-telegram"
                  autoComplete="off"
                  spellCheck={false}
                  className="pl-7"
                  placeholder={t('telegramPlaceholder')}
                  aria-invalid={errors.telegramUsername ? true : undefined}
                  {...sanitizedRegister('telegramUsername', /[^\w]/g)}
                />
              </div>
              <FieldError errors={[errors.telegramUsername]} />
            </Field>
          </div>
        </FormSection>

        <FieldSeparator />

        <FormSection
          icon={GlobeIcon}
          tone="cyan"
          title={t('timezoneSection')}
          description={t('timezoneHint')}
        >
          <Field data-invalid={errors.timezone ? true : undefined}>
            <FieldLabel htmlFor="student-timezone" className="sr-only">{t('timezone')}</FieldLabel>
            <TimezoneCombobox
              id="student-timezone"
              value={values.timezone}
              onChange={(value) => form.setValue('timezone', value, { shouldValidate: true })}
              placeholder={t('timezonePlaceholder')}
              searchPlaceholder={t('timezoneSearch')}
              emptyLabel={t('timezoneEmpty')}
              invalid={Boolean(errors.timezone)}
            />
            <FieldError errors={[errors.timezone]} />
          </Field>
        </FormSection>

        <FieldSeparator />

        <FormSection icon={GraduationCapIcon} tone="violet" title={t('academicSection')}>
          {/* Levels row: language level appears only for language subjects; when
              hidden, the knowledge level sits alone on its row. */}
          <div className="grid gap-4 sm:grid-cols-2">
            {showLanguageLevel ? (
              <Field>
                <FieldLabel htmlFor="student-language-level">{t('languageLevel')}</FieldLabel>
                <Select
                  value={values.languageLevel === '' ? NONE : values.languageLevel}
                  onValueChange={(value) =>
                    form.setValue(
                      'languageLevel',
                      value === NONE ? '' : (value as StudentFormValues['languageLevel']),
                    )
                  }
                >
                  <SelectTrigger id="student-language-level" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={NONE}>{tCommon('notProvided')}</SelectItem>
                      {STUDENT_LANGUAGE_LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {tLanguageLevel(level)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>{t('languageLevelHint')}</FieldDescription>
              </Field>
            ) : null}
            <Field>
              <FieldLabel htmlFor="student-knowledge-level">{t('knowledgeLevel')}</FieldLabel>
              <Select
                value={values.knowledgeLevel === '' ? NONE : values.knowledgeLevel}
                onValueChange={(value) =>
                  form.setValue(
                    'knowledgeLevel',
                    value === NONE ? '' : (value as StudentFormValues['knowledgeLevel']),
                  )
                }
              >
                <SelectTrigger id="student-knowledge-level" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={NONE}>{tCommon('notProvided')}</SelectItem>
                    {STUDENT_KNOWLEDGE_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {tKnowledgeLevel(level)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          {/* Age and grade always share a row. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={errors.age ? true : undefined}>
              <FieldLabel htmlFor="student-age">{t('age')}</FieldLabel>
              <Input
                id="student-age"
                inputMode="numeric"
                maxLength={3}
                placeholder={t('agePlaceholder')}
                aria-invalid={errors.age ? true : undefined}
                {...sanitizedRegister('age', NON_DIGIT)}
              />
              <FieldError errors={[errors.age]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="student-grade">{t('grade')}</FieldLabel>
              <Select
                value={values.grade === '' ? NONE : values.grade}
                onValueChange={(value) =>
                  form.setValue('grade', value === NONE ? '' : value, { shouldValidate: true })
                }
              >
                <SelectTrigger id="student-grade" className="w-full">
                  <SelectValue placeholder={t('gradePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={NONE}>{tCommon('notProvided')}</SelectItem>
                    {GRADES.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {t('gradeOption', { grade })}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FormSection>

        <FieldSeparator />

        <FormSection
          icon={BanknoteIcon}
          tone="emerald"
          title={t('pricingSection')}
          description={t('pricingHint')}
        >
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field data-invalid={errors.hourlyRate ? true : undefined}>
              <FieldLabel htmlFor="student-hourly-rate">{t('hourlyRate')}</FieldLabel>
              <MoneyInput
                id="student-hourly-rate"
                placeholder={t('hourlyRateHint')}
                aria-invalid={errors.hourlyRate ? true : undefined}
                {...form.register('hourlyRate')}
              />
              <FieldError errors={[errors.hourlyRate]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="student-currency">{t('currency')}</FieldLabel>
              <Select
                value={values.currency}
                onValueChange={(value) =>
                  form.setValue('currency', value as StudentFormValues['currency'])
                }
              >
                <SelectTrigger id="student-currency" className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        <CurrencyOption code={currency} />
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FormSection>

        <FieldSeparator />

        <FormSection
          icon={UsersRoundIcon}
          tone="amber"
          title={t('parentSection')}
          description={t('parentHint')}
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => setQuickCreateOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              {t('newParent')}
            </Button>
          }
        >
          {assignedParents.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {assignedParents.map((parent) => (
                <ParentMiniCard
                  key={parent.id}
                  parent={parentsById.get(parent.id) ?? parent}
                  onRemove={() => removeParent(parent.id)}
                  removeLabel={t('removeParent', { name: parent.fullName })}
                />
              ))}
            </div>
          ) : null}
          <EntityCombobox
            id="student-add-parent"
            value=""
            options={parentOptions}
            onChange={(parentId) => {
              const item = parentsQuery.data?.items.find((parent) => parent.id === parentId);
              if (item) {
                addParent({
                  id: item.id,
                  fullName: item.fullName,
                  avatarKey: item.avatarKey,
                  phone: item.phone,
                  telegramUsername: item.telegramUsername,
                });
              }
            }}
            placeholder={t('addParentPlaceholder')}
            searchPlaceholder={t('addParentSearch')}
            emptyLabel={t('addParentEmpty')}
          />
        </FormSection>

        <FieldSeparator />

        <FormSection icon={StickyNoteIcon} tone="rose" title={t('notesSection')}>
          <Field data-invalid={errors.notes ? true : undefined}>
            <FieldLabel htmlFor="student-notes" className="sr-only">{t('notes')}</FieldLabel>
            <Textarea
              id="student-notes"
              rows={4}
              placeholder={t('notesPlaceholder')}
              aria-invalid={errors.notes ? true : undefined}
              {...form.register('notes')}
            />
            <FieldError errors={[errors.notes]} />
          </Field>
        </FormSection>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {isEdit ? t('submitEdit') : t('submitCreate')}
          </Button>
        </div>
      </FieldGroup>

      <ParentFormDialog
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        onSuccess={(parent) =>
          addParent({ ...parent, avatarKey: null, phone: null, telegramUsername: null })
        }
      />
    </form>
  );
}
