'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import {
  BanknoteIcon,
  GraduationCapIcon,
  PlusIcon,
  StickyNoteIcon,
  UsersRoundIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { SUPPORTED_CURRENCIES } from '@tutorio/domain';
import type { GroupDetail, StudentResponse } from '@tutorio/validation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from '@/components/ui/field';
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
import { StudentFormDialog } from '@/components/students/student-form-dialog';
import { errorMessageKey } from '@/lib/api/error-message';
import { useCreateGroupMutation, useUpdateGroupMutation } from '@/lib/api/groups';
import { GroupStudentsField } from './group-students-field';
import { FormActions } from '@/components/shared';
import { FormSection } from '@/components/app/form-section';
import { useSession } from '@/components/app/session-provider';
import { CurrencyOption } from '@/components/app/currency-option';
import { MoneyInput } from '@/components/app/money-input';
import { useTeachersQuery } from '@/lib/api/teachers';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { groupFormSchema, type GroupFormValues } from '@/features/groups/model/form';
import { formatPriceInput, parsePriceInput } from '@/lib/money';

// One component for both create and edit, mirroring StudentForm. Rendered
// inside a Dialog (see GroupFormDialog) — the caller owns the open state and
// is told when to close it via onSuccess/onCancel rather than the form
// navigating itself.
export function GroupForm({
  group,
  onSuccess,
  onCancel,
}: {
  group?: GroupDetail;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations('groups.form');
  const tGroups = useTranslations('groups');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const tCommon = useTranslations('common');

  const isEdit = Boolean(group);
  const createGroup = useCreateGroupMutation();
  const updateGroup = useUpdateGroupMutation(group?.id ?? '');
  const mutation = isEdit ? updateGroup : createGroup;
  const session = useSession();
  const teachers = useTeachersQuery({ page: 1, pageSize: 100 });

  const [studentIds, setStudentIds] = useState<string[]>(() =>
    (group?.enrollments ?? []).map((enrollment) => enrollment.student.id),
  );
  const [createdStudents, setCreatedStudents] = useState<StudentResponse[]>([]);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const teacherId =
    (group?.enrollments ?? [])[0]?.teacher.id ?? (teachers.data?.items ?? [])[0]?.id ?? '';

  // The roster is sent as a whole and reconciled server-side, so the form only
  // has to know whether the selection moved at all.
  const rosterChanged = useMemo(() => {
    const original = new Set((group?.enrollments ?? []).map((enrollment) => enrollment.student.id));
    const selected = new Set(studentIds);
    return original.size !== selected.size || [...selected].some((id) => !original.has(id));
  }, [group?.enrollments, studentIds]);

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    defaultValues: {
      name: group?.name ?? '',
      pricePerLesson: group?.pricePerLesson != null ? formatPriceInput(group.pricePerLesson) : '',
      currency:
        (group?.currency as GroupFormValues['currency'] | undefined) ??
        (session.workspace.defaultCurrency as GroupFormValues['currency']),
      notes: group?.notes ?? '',
    },
  });
  const { errors, isSubmitting } = form.formState;
  const values = useWatch({
    control: form.control,
    defaultValue: form.getValues(),
  }) as GroupFormValues;
  const submissionError = mutation.error;
  const pending = isSubmitting || mutation.isPending;

  const onSubmit = form.handleSubmit(async (formValues) => {
    const pricePerLesson =
      formValues.pricePerLesson.trim() === '' ? null : parsePriceInput(formValues.pricePerLesson);
    // The roster rides along with the group fields: the server reconciles it
    // into enrollments in one transaction, so saving is always one request.
    const students = teacherId ? { studentIds, teacherId } : undefined;
    try {
      if (group) {
        await updateGroup.mutateAsync({
          name: formValues.name,
          pricePerLesson,
          currency: pricePerLesson === null ? null : formValues.currency,
          // An emptied field becomes null so the API clears it.
          notes: formValues.notes.trim() === '' ? null : formValues.notes,
          // Omitted when unchanged so an untouched roster is not re-sent.
          ...(rosterChanged ? { students } : {}),
        });
        toast.success(tGroups('toasts.updated'));
        onSuccess?.();
        return;
      }
      await createGroup.mutateAsync({
        name: formValues.name,
        pricePerLesson: pricePerLesson ?? undefined,
        currency: pricePerLesson === null ? undefined : formValues.currency,
        notes: formValues.notes.trim() === '' ? undefined : formValues.notes,
        students: studentIds.length > 0 ? students : undefined,
      });
      toast.success(tGroups('toasts.created'));
      onSuccess?.();
    } catch {
      // Surfaced by the alert below.
    }
  });

  return (
    <form
      onSubmit={(event) => {
        event.stopPropagation();
        void onSubmit(event);
      }}
      noValidate
    >
      <FieldGroup>
        {submissionError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{tErrors(errorMessageKey(submissionError))}</AlertDescription>
          </Alert>
        ) : null}

        <FormSection icon={GraduationCapIcon} tone="primary" title={t('detailsSection')}>
          <Field data-invalid={errors.name ? true : undefined}>
            <FieldLabel htmlFor="group-name">{t('name')}</FieldLabel>
            <Input
              id="group-name"
              placeholder={t('namePlaceholder')}
              aria-invalid={errors.name ? true : undefined}
              {...form.register('name')}
            />
            <FieldError errors={[errors.name]} />
          </Field>
        </FormSection>

        <FieldSeparator />

        <FormSection
          icon={BanknoteIcon}
          tone="success"
          title={t('pricingSection')}
          description={t('pricingHint')}
        >
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field data-invalid={errors.pricePerLesson ? true : undefined}>
              <FieldLabel htmlFor="group-price">{t('pricePerLesson')}</FieldLabel>
              <MoneyInput
                id="group-price"
                placeholder={t('pricePerLessonHint')}
                aria-invalid={errors.pricePerLesson ? true : undefined}
                {...form.register('pricePerLesson')}
              />
              <FieldError errors={[errors.pricePerLesson]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="group-currency">{t('currency')}</FieldLabel>
              <Select
                value={values.currency}
                onValueChange={(value) =>
                  form.setValue('currency', value as GroupFormValues['currency'])
                }
              >
                <SelectTrigger id="group-currency" className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {SUPPORTED_CURRENCIES.map((currency) => (
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
          tone="warning"
          title={t('students.section')}
          description={t('students.hint')}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuickCreateOpen(true)}
            >
              <PlusIcon data-icon="inline-start" />
              {t('students.newStudent')}
            </Button>
          }
        >
          <GroupStudentsField
            selectedIds={studentIds}
            onChange={setStudentIds}
            enabled
            extraStudents={createdStudents}
          />
        </FormSection>

        <FieldSeparator />

        <FormSection icon={StickyNoteIcon} tone="destructive" title={t('descriptionSection')}>
          <Field data-invalid={errors.notes ? true : undefined}>
            <FieldLabel htmlFor="group-notes" className="sr-only">
              {t('description')}
            </FieldLabel>
            <Textarea
              id="group-notes"
              rows={4}
              placeholder={t('descriptionPlaceholder')}
              aria-invalid={errors.notes ? true : undefined}
              {...form.register('notes')}
            />
            <FieldError errors={[errors.notes]} />
          </Field>
        </FormSection>

        <FormActions>
          <Button type="button" variant="outline" onClick={onCancel}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {isEdit ? t('submitEdit') : t('submitCreate')}
          </Button>
        </FormActions>
      </FieldGroup>

      <StudentFormDialog
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        onSuccess={(student) => {
          if (student) {
            setCreatedStudents((current) =>
              current.some((item) => item.id === student.id) ? current : [...current, student],
            );
            setStudentIds((current) =>
              current.includes(student.id) ? current : [...current, student.id],
            );
          }
        }}
      />
    </form>
  );
}
