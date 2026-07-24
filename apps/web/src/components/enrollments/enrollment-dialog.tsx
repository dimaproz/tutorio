'use client';

import { useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { EnrollmentResponse } from '@tutorio/validation';
import { EntityCombobox } from './entity-combobox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
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
import { errorMessageKey } from '@/lib/api/error-message';
import {
  useCreateEnrollmentMutation,
  useUpdateEnrollmentMutation,
} from '@/lib/api/enrollments';
import { useGroupsQuery } from '@/lib/api/groups';
import { useStudentsQuery } from '@/lib/api/students';
import { useTeachersQuery } from '@/lib/api/teachers';
import { useSession } from '@/components/app/session-provider';
import { CurrencyOption } from '@/components/app/currency-option';
import { MoneyInput } from '@/components/app/money-input';
import { PersonMiniCard } from '@/components/app/person-mini-card';
import { StatusSelect, useEnrollmentStatusOptions } from '@/components/app/status-select';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { enrollmentFormSchema, type EnrollmentFormValues } from '@/lib/forms/schemas';
import { formatPriceInput, parsePriceInput } from '@/lib/money';

const BILLING_TYPES = ['PACKAGE', 'MONTHLY', 'PER_LESSON'] as const;
const CURRENCIES = ['EUR', 'UAH', 'PLN', 'USD', 'GBP'] as const;

// Sentinel for "no group" — Radix Select cannot hold an empty string value.
const INDIVIDUAL = 'individual';

/** Minimal student identity shown as a read-only card when the student is fixed. */
export interface LockedStudent {
  id: string;
  fullName: string;
  avatarKey?: string | null;
  subject?: string | null;
}

export function EnrollmentDialog({
  open,
  onOpenChange,
  enrollment,
  lockedStudent,
  lockedGroupId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent when creating. */
  enrollment?: EnrollmentResponse;
  /** Set when opened from a student page — the student is fixed and shown as a card. */
  lockedStudent?: LockedStudent;
  /** Set when opened from a group page — the group cannot be changed. */
  lockedGroupId?: string;
}) {
  const t = useTranslations('enrollments');
  const tSubject = useTranslations('subject');
  const tBilling = useTranslations('billingType');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const tCommon = useTranslations('common');
  const statusOptions = useEnrollmentStatusOptions();

  const isEdit = Boolean(enrollment);
  const lockedStudentId = lockedStudent?.id;
  const createEnrollment = useCreateEnrollmentMutation();
  const updateEnrollment = useUpdateEnrollmentMutation();
  const mutation = isEdit ? updateEnrollment : createEnrollment;

  // Pickers only need live records; one long page covers MVP workspace size.
  const students = useStudentsQuery({ page: 1, pageSize: 100 }, open && !lockedStudentId);
  const groups = useGroupsQuery({ page: 1, pageSize: 100 }, open && !lockedGroupId);
  const teachers = useTeachersQuery({ page: 1, pageSize: 100 }, open);
  const session = useSession();

  const workspaceDefaultDeadline = session.workspace.cancellationDeadlineHours;

  const form = useForm<EnrollmentFormValues>({
    resolver: zodResolver(enrollmentFormSchema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    defaultValues: {
      studentId: lockedStudentId ?? '',
      groupId: lockedGroupId ?? INDIVIDUAL,
      teacherId: '',
      status: 'ACTIVE',
      billingType: 'PACKAGE',
      price: '',
      currency: 'EUR',
      useCustomDeadline: false,
      cancellationDeadlineHours: '',
    },
  });
  const { errors } = form.formState;
  const values = form.watch();

  // Refill whenever the dialog opens so a reopened editor never shows stale data.
  useEffect(() => {
    if (!open) {
      return;
    }
    mutation.reset();
    if (enrollment) {
      form.reset({
        studentId: enrollment.studentId,
        groupId: enrollment.groupId ?? INDIVIDUAL,
        teacherId: enrollment.teacherId,
        status: enrollment.status,
        billingType: enrollment.billingType,
        price: formatPriceInput(enrollment.priceMinor),
        currency: enrollment.currency,
        useCustomDeadline: enrollment.cancellationDeadlineHours !== null,
        cancellationDeadlineHours:
          enrollment.cancellationDeadlineHours?.toString() ?? '',
      });
      return;
    }
    form.reset({
      studentId: lockedStudentId ?? '',
      groupId: lockedGroupId ?? INDIVIDUAL,
      teacherId: '',
      status: 'ACTIVE',
      billingType: 'PACKAGE',
      price: '',
      currency: session.workspace
        .defaultCurrency as EnrollmentFormValues['currency'],
      useCustomDeadline: false,
      cancellationDeadlineHours: '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on open
  }, [open, enrollment?.id]);

  const studentOptions = useMemo(
    () =>
      (students.data?.items ?? []).map((student) => ({
        value: student.id,
        label: student.fullName,
      })),
    [students.data],
  );
  const teacherOptions = useMemo(
    () =>
      (teachers.data?.items ?? []).map((teacher) => ({
        value: teacher.id,
        label: teacher.fullName,
      })),
    [teachers.data],
  );

  // Student / teacher become read-only cards once fixed: a locked or existing
  // student, and — since it is immutable after creation — the teacher on edit.
  const studentCard: LockedStudent | null = lockedStudent
    ? lockedStudent
    : enrollment
      ? { id: enrollment.student.id, fullName: enrollment.student.fullName }
      : null;
  const teacherCard = enrollment ? enrollment.teacher : null;

  const effectiveDeadline = values.useCustomDeadline
    ? Number(values.cancellationDeadlineHours || 0)
    : workspaceDefaultDeadline;

  const onSubmit = form.handleSubmit(async (formValues) => {
    const priceMinor = parsePriceInput(formValues.price);
    if (priceMinor === null) {
      return;
    }
    const deadline = formValues.useCustomDeadline
      ? Number(formValues.cancellationDeadlineHours)
      : null;

    try {
      if (enrollment) {
        // Student, group and teacher are immutable after creation.
        await updateEnrollment.mutateAsync({
          enrollmentId: enrollment.id,
          dto: {
            status: formValues.status,
            billingType: formValues.billingType,
            priceMinor,
            currency: formValues.currency,
            cancellationDeadlineHours: deadline,
          },
        });
        toast.success(t('toasts.updated'));
      } else {
        await createEnrollment.mutateAsync({
          studentId: formValues.studentId,
          groupId: formValues.groupId === INDIVIDUAL ? null : formValues.groupId,
          teacherId: formValues.teacherId,
          billingType: formValues.billingType,
          priceMinor,
          currency: formValues.currency,
          cancellationDeadlineHours: deadline,
        });
        toast.success(t('toasts.created'));
      }
      onOpenChange(false);
    } catch {
      // Surfaced by the alert below.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b bg-popover px-6 py-4 pr-12">
          <DialogTitle>{isEdit ? t('editor.editTitle') : t('editor.createTitle')}</DialogTitle>
          <DialogDescription>
            {isEdit ? t('editor.editDescription') : t('editor.createDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <FieldGroup>
              {mutation.error ? (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>
                    {tErrors(errorMessageKey(mutation.error))}
                  </AlertDescription>
                </Alert>
              ) : null}

              <Field data-invalid={errors.studentId ? true : undefined}>
                <FieldLabel htmlFor="enrollment-student">{t('editor.student')}</FieldLabel>
                {studentCard ? (
                  <PersonMiniCard
                    avatarKey={studentCard.avatarKey}
                    fullName={studentCard.fullName}
                    subtitle={
                      lockedStudent?.subject ? tSubject(lockedStudent.subject) : undefined
                    }
                  />
                ) : (
                  <EntityCombobox
                    id="enrollment-student"
                    value={values.studentId}
                    options={studentOptions}
                    onChange={(value) =>
                      form.setValue('studentId', value, { shouldValidate: true })
                    }
                    placeholder={t('editor.studentPlaceholder')}
                    searchPlaceholder={t('editor.studentSearch')}
                    emptyLabel={t('editor.studentEmpty')}
                    invalid={Boolean(errors.studentId)}
                  />
                )}
                <FieldError errors={[errors.studentId]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="enrollment-group">{t('editor.group')}</FieldLabel>
                <Select
                  value={values.groupId}
                  onValueChange={(value) => form.setValue('groupId', value)}
                  disabled={isEdit || Boolean(lockedGroupId)}
                >
                  <SelectTrigger id="enrollment-group" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={INDIVIDUAL}>{t('editor.groupNone')}</SelectItem>
                      {(groups.data?.items ?? []).map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>{t('editor.groupHint')}</FieldDescription>
              </Field>

              <Field data-invalid={errors.teacherId ? true : undefined}>
                <FieldLabel htmlFor="enrollment-teacher">{t('editor.teacher')}</FieldLabel>
                {teacherCard ? (
                  <PersonMiniCard fullName={teacherCard.name} />
                ) : (
                  <EntityCombobox
                    id="enrollment-teacher"
                    value={values.teacherId}
                    options={teacherOptions}
                    onChange={(value) =>
                      form.setValue('teacherId', value, { shouldValidate: true })
                    }
                    placeholder={t('editor.teacherPlaceholder')}
                    searchPlaceholder={t('editor.teacherSearch')}
                    emptyLabel={t('editor.teacherEmpty')}
                    invalid={Boolean(errors.teacherId)}
                  />
                )}
                <FieldError errors={[errors.teacherId]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="enrollment-status">{t('editor.status')}</FieldLabel>
                <StatusSelect
                  id="enrollment-status"
                  value={values.status}
                  onValueChange={(value) =>
                    form.setValue('status', value as EnrollmentFormValues['status'])
                  }
                  options={statusOptions}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="enrollment-billing">{t('editor.billingType')}</FieldLabel>
                <Select
                  value={values.billingType}
                  onValueChange={(value) =>
                    form.setValue('billingType', value as EnrollmentFormValues['billingType'])
                  }
                >
                  <SelectTrigger id="enrollment-billing" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {BILLING_TYPES.map((billingType) => (
                        <SelectItem key={billingType} value={billingType}>
                          {tBilling(billingType)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <Field data-invalid={errors.price ? true : undefined}>
                  <FieldLabel htmlFor="enrollment-price">{t('editor.price')}</FieldLabel>
                  <MoneyInput
                    id="enrollment-price"
                    placeholder={t('editor.priceHint')}
                    aria-invalid={errors.price ? true : undefined}
                    {...form.register('price')}
                  />
                  <FieldError errors={[errors.price]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="enrollment-currency">
                    {t('editor.currency')}
                  </FieldLabel>
                  <Select
                    value={values.currency}
                    onValueChange={(value) =>
                      form.setValue('currency', value as EnrollmentFormValues['currency'])
                    }
                  >
                    <SelectTrigger id="enrollment-currency" className="w-full sm:w-32">
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

              {/* Cancellation deadline: how late a student may cancel a lesson
                  without being charged. */}
              <Field>
                <FieldLabel htmlFor="enrollment-custom-deadline">
                  {t('editor.deadlineTitle')}
                </FieldLabel>
                <FieldDescription>{t('editor.deadlineExplain')}</FieldDescription>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id="enrollment-custom-deadline"
                    checked={values.useCustomDeadline}
                    onCheckedChange={(checked) =>
                      form.setValue('useCustomDeadline', checked === true)
                    }
                  />
                  {t('editor.policyCustom')}
                </label>

                {values.useCustomDeadline ? (
                  <div data-invalid={errors.cancellationDeadlineHours ? true : undefined}>
                    <Input
                      id="enrollment-deadline"
                      inputMode="numeric"
                      placeholder={t('editor.customHoursHint')}
                      aria-invalid={errors.cancellationDeadlineHours ? true : undefined}
                      onInput={(event) => {
                        event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '');
                      }}
                      {...form.register('cancellationDeadlineHours')}
                    />
                    <FieldError errors={[errors.cancellationDeadlineHours]} />
                  </div>
                ) : null}

                <FieldDescription aria-live="polite">
                  {t('editor.effective', { hours: effectiveDeadline })}
                  {values.useCustomDeadline ? '' : ` ${t('editor.policyDefault')}`}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              {isEdit ? tCommon('save') : t('editor.submitCreate')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
