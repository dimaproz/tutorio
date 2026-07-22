'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { XIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  STUDENT_KNOWLEDGE_LEVELS,
  STUDENT_LANGUAGE_LEVELS,
  STUDENT_SUBJECTS,
  type StudentDetail,
} from '@tutorio/validation';
import { EntityCombobox } from '@/components/enrollments/entity-combobox';
import { ParentFormDialog } from '@/components/parents/parent-form-dialog';
import { detectTimezone, TimezoneCombobox } from '@/components/app/timezone-combobox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
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
const STUDENT_STATUSES = ['ACTIVE', 'ON_HOLD'] as const;
// Sentinel for "unset" — Radix Select cannot hold an empty string value.
const NONE = '__none__';

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
  const tStudentStatus = useTranslations('studentStatus');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const tCommon = useTranslations('common');
  const session = useSession();

  const isEdit = Boolean(student);
  const createStudent = useCreateStudentMutation();
  const updateStudent = useUpdateStudentMutation(student?.id ?? '');
  const mutation = isEdit ? updateStudent : createStudent;

  const [assignedParents, setAssignedParents] = useState<{ id: string; fullName: string }[]>(
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
          telegramUsername: student.telegramUsername ?? '',
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
          parentIds: student.parents.map((parent) => parent.id),
          notes: student.notes ?? '',
        }
      : { ...EMPTY_STUDENT_FORM, currency: session.workspace.defaultCurrency as StudentFormValues['currency'] },
  });
  const { errors, isSubmitting } = form.formState;
  const values = form.watch();

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

  const parentOptions = useMemo(() => {
    const assignedIds = new Set(assignedParents.map((parent) => parent.id));
    return (parentsQuery.data?.items ?? [])
      .filter((parent) => !assignedIds.has(parent.id))
      .map((parent) => ({ value: parent.id, label: parent.fullName }));
  }, [parentsQuery.data, assignedParents]);

  function addParent(parent: { id: string; fullName: string }) {
    setAssignedParents((current) =>
      current.some((existing) => existing.id === parent.id) ? current : [...current, parent],
    );
  }

  function removeParent(parentId: string) {
    setAssignedParents((current) => current.filter((parent) => parent.id !== parentId));
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

        <FieldSet>
          <FieldLegend>{t('basicSection')}</FieldLegend>
          <FieldGroup>
            <Field data-invalid={errors.fullName ? true : undefined}>
              <FieldLabel htmlFor="student-full-name">{t('fullName')}</FieldLabel>
              <Input
                id="student-full-name"
                autoComplete="name"
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
                <Select
                  value={values.status}
                  onValueChange={(value) =>
                    form.setValue('status', value as StudentFormValues['status'])
                  }
                >
                  <SelectTrigger id="student-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {STUDENT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {tStudentStatus(status)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>
        </FieldSet>

        <FieldSeparator />

        <FieldSet>
          <FieldLegend>{t('contactsSection')}</FieldLegend>
          <FieldDescription>{t('contactsHint')}</FieldDescription>
          <FieldGroup>
            <Field data-invalid={errors.email ? true : undefined}>
              <FieldLabel htmlFor="student-email">{t('email')}</FieldLabel>
              <Input
                id="student-email"
                type="email"
                inputMode="email"
                spellCheck={false}
                aria-invalid={errors.email ? true : undefined}
                {...form.register('email')}
              />
              <FieldError errors={[errors.email]} />
            </Field>
            <Field data-invalid={errors.phone ? true : undefined}>
              <FieldLabel htmlFor="student-phone">{t('phone')}</FieldLabel>
              <Input
                id="student-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                aria-invalid={errors.phone ? true : undefined}
                {...form.register('phone')}
              />
              <FieldError errors={[errors.phone]} />
            </Field>
            <Field data-invalid={errors.telegramUsername ? true : undefined}>
              <FieldLabel htmlFor="student-telegram">{t('telegramUsername')}</FieldLabel>
              <Input
                id="student-telegram"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={errors.telegramUsername ? true : undefined}
                {...form.register('telegramUsername')}
              />
              <FieldError errors={[errors.telegramUsername]} />
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSeparator />

        <FieldSet>
          <FieldLegend>{t('timezoneSection')}</FieldLegend>
          <FieldGroup>
            <Field data-invalid={errors.timezone ? true : undefined}>
              <FieldLabel htmlFor="student-timezone">{t('timezone')}</FieldLabel>
              <TimezoneCombobox
                id="student-timezone"
                value={values.timezone}
                onChange={(value) =>
                  form.setValue('timezone', value, { shouldValidate: true })
                }
                placeholder={t('timezonePlaceholder')}
                searchPlaceholder={t('timezoneSearch')}
                emptyLabel={t('timezoneEmpty')}
                invalid={Boolean(errors.timezone)}
              />
              <FieldDescription>{t('timezoneHint')}</FieldDescription>
              <FieldError errors={[errors.timezone]} />
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSeparator />

        <FieldSet>
          <FieldLegend>{t('academicSection')}</FieldLegend>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
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
              </Field>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={errors.age ? true : undefined}>
                <FieldLabel htmlFor="student-age">{t('age')}</FieldLabel>
                <Input
                  id="student-age"
                  inputMode="numeric"
                  aria-invalid={errors.age ? true : undefined}
                  {...form.register('age')}
                />
                <FieldError errors={[errors.age]} />
              </Field>
              <Field data-invalid={errors.grade ? true : undefined}>
                <FieldLabel htmlFor="student-grade">{t('grade')}</FieldLabel>
                <Input
                  id="student-grade"
                  inputMode="numeric"
                  aria-invalid={errors.grade ? true : undefined}
                  {...form.register('grade')}
                />
                <FieldError errors={[errors.grade]} />
              </Field>
            </div>
          </FieldGroup>
        </FieldSet>

        <FieldSeparator />

        <FieldSet>
          <FieldLegend>{t('pricingSection')}</FieldLegend>
          <FieldDescription>{t('pricingHint')}</FieldDescription>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field data-invalid={errors.hourlyRate ? true : undefined}>
                <FieldLabel htmlFor="student-hourly-rate">{t('hourlyRate')}</FieldLabel>
                <Input
                  id="student-hourly-rate"
                  inputMode="decimal"
                  autoComplete="off"
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
                  <SelectTrigger id="student-currency" className="w-full sm:w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>
        </FieldSet>

        <FieldSeparator />

        <FieldSet>
          <FieldLegend>{t('parentSection')}</FieldLegend>
          <FieldDescription>{t('parentHint')}</FieldDescription>
          <FieldGroup>
            {assignedParents.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {assignedParents.map((parent) => (
                  <Badge key={parent.id} variant="secondary">
                    {parent.fullName}
                    <button
                      type="button"
                      onClick={() => removeParent(parent.id)}
                      aria-label={t('removeParent', { name: parent.fullName })}
                      className="ml-0.5 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <XIcon data-icon />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <EntityCombobox
                id="student-add-parent"
                value=""
                options={parentOptions}
                onChange={(parentId) => {
                  const option = parentOptions.find((item) => item.value === parentId);
                  if (option) {
                    addParent({ id: option.value, fullName: option.label });
                  }
                }}
                placeholder={t('addParentPlaceholder')}
                searchPlaceholder={t('addParentSearch')}
                emptyLabel={t('addParentEmpty')}
              />
              <Button type="button" variant="outline" onClick={() => setQuickCreateOpen(true)}>
                {t('newParent')}
              </Button>
            </div>
          </FieldGroup>
        </FieldSet>

        <FieldSeparator />

        <FieldSet>
          <FieldLegend>{t('notesSection')}</FieldLegend>
          <FieldGroup>
            <Field data-invalid={errors.notes ? true : undefined}>
              <FieldLabel htmlFor="student-notes">{t('notes')}</FieldLabel>
              <Textarea
                id="student-notes"
                rows={4}
                placeholder={t('notesPlaceholder')}
                aria-invalid={errors.notes ? true : undefined}
                {...form.register('notes')}
              />
              <FieldError errors={[errors.notes]} />
            </Field>
          </FieldGroup>
        </FieldSet>

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
        onSuccess={(parent) => addParent(parent)}
      />
    </form>
  );
}
