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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { errorMessageKey } from '@/lib/api/error-message';
import {
  useCreateEnrollmentMutation,
  useUpdateEnrollmentMutation,
} from '@/lib/api/enrollments';
import { useGroupsQuery } from '@/lib/api/groups';
import { useStudentsQuery } from '@/lib/api/students';
import { useWorkspaceMembersQuery } from '@/lib/api/workspace';
import { useSession } from '@/components/app/session-provider';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { enrollmentFormSchema, type EnrollmentFormValues } from '@/lib/forms/schemas';
import { formatPriceInput, parsePriceInput } from '@/lib/money';

const ENROLLMENT_STATUSES = ['ACTIVE', 'PAUSED', 'ARCHIVED'] as const;
const BILLING_TYPES = ['PACKAGE', 'MONTHLY', 'PER_LESSON'] as const;
const CURRENCIES = ['EUR', 'UAH', 'PLN', 'USD', 'GBP'] as const;

// Sentinel for "no group" — Radix Select cannot hold an empty string value.
const INDIVIDUAL = 'individual';

export function EnrollmentSheet({
  open,
  onOpenChange,
  enrollment,
  lockedStudentId,
  lockedGroupId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent when creating. */
  enrollment?: EnrollmentResponse;
  /** Set when opened from a student page — the student cannot be changed. */
  lockedStudentId?: string;
  /** Set when opened from a group page — the group cannot be changed. */
  lockedGroupId?: string;
}) {
  const t = useTranslations('enrollments');
  const tStatus = useTranslations('enrollmentStatus');
  const tBilling = useTranslations('billingType');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const tCommon = useTranslations('common');

  const isEdit = Boolean(enrollment);
  const createEnrollment = useCreateEnrollmentMutation();
  const updateEnrollment = useUpdateEnrollmentMutation();
  const mutation = isEdit ? updateEnrollment : createEnrollment;

  // Pickers only need live records; one long page covers MVP workspace size.
  const students = useStudentsQuery({ page: 1, pageSize: 100 }, open && !lockedStudentId);
  const groups = useGroupsQuery({ page: 1, pageSize: 100 }, open && !lockedGroupId);
  const members = useWorkspaceMembersQuery(open);
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

  // Refill whenever the sheet opens so a reopened editor never shows stale data.
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
      (members.data?.items ?? []).map((member) => ({
        value: member.id,
        label: member.name,
      })),
    [members.data],
  );

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? t('editor.editTitle') : t('editor.createTitle')}</SheetTitle>
          <SheetDescription>
            {isEdit ? t('editor.editDescription') : t('editor.createDescription')}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4">
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
                  disabled={isEdit || Boolean(lockedStudentId)}
                  invalid={Boolean(errors.studentId)}
                />
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
                <FieldDescription>{t('editor.groupPlaceholder')}</FieldDescription>
              </Field>

              <Field data-invalid={errors.teacherId ? true : undefined}>
                <FieldLabel htmlFor="enrollment-teacher">{t('editor.teacher')}</FieldLabel>
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
                  disabled={isEdit}
                  invalid={Boolean(errors.teacherId)}
                />
                <FieldError errors={[errors.teacherId]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="enrollment-status">{t('editor.status')}</FieldLabel>
                <Select
                  value={values.status}
                  onValueChange={(value) =>
                    form.setValue('status', value as EnrollmentFormValues['status'])
                  }
                >
                  <SelectTrigger id="enrollment-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {ENROLLMENT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {tStatus(status)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
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
                  <Input
                    id="enrollment-price"
                    inputMode="decimal"
                    autoComplete="off"
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
                    <SelectTrigger id="enrollment-currency" className="w-full sm:w-28">
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

              <Field orientation="horizontal">
                <Checkbox
                  id="enrollment-custom-deadline"
                  checked={values.useCustomDeadline}
                  onCheckedChange={(checked) =>
                    form.setValue('useCustomDeadline', checked === true)
                  }
                />
                <FieldLabel htmlFor="enrollment-custom-deadline" className="font-normal">
                  {t('editor.policyCustom')}
                </FieldLabel>
              </Field>

              {values.useCustomDeadline ? (
                <Field data-invalid={errors.cancellationDeadlineHours ? true : undefined}>
                  <FieldLabel htmlFor="enrollment-deadline">
                    {t('editor.customHours')}
                  </FieldLabel>
                  <Input
                    id="enrollment-deadline"
                    inputMode="numeric"
                    aria-invalid={errors.cancellationDeadlineHours ? true : undefined}
                    {...form.register('cancellationDeadlineHours')}
                  />
                  <FieldError errors={[errors.cancellationDeadlineHours]} />
                </Field>
              ) : null}

              <p className="text-muted-foreground text-sm" aria-live="polite">
                {t('editor.effective', { hours: effectiveDeadline })}
                {values.useCustomDeadline ? '' : ` ${t('editor.policyDefault')}`}
              </p>
            </FieldGroup>
          </div>

          <SheetFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              {isEdit ? tCommon('save') : t('editor.submitCreate')}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
