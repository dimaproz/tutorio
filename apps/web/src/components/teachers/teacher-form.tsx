'use client';

import { type ChangeEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { STUDENT_SUBJECTS, type TeacherResponse } from '@tutorio/validation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
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
import { AvatarPicker } from '@/components/app/avatar-picker';
import { CurrencyOption } from '@/components/app/currency-option';
import { errorMessageKey } from '@/lib/api/error-message';
import {
  useCreateTeacherMutation,
  useUpdateTeacherMutation,
} from '@/lib/api/teachers';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import {
  EMPTY_TEACHER_FORM,
  teacherFormSchema,
  type TeacherFormValues,
} from '@/lib/forms/schemas';
import { formatPriceInput, parsePriceInput } from '@/lib/money';

const CURRENCIES = ['EUR', 'UAH', 'PLN', 'USD', 'GBP'] as const;

// One component for both create and edit, mirroring ParentForm/StudentForm.
export function TeacherForm({
  teacher,
  onSuccess,
  onCancel,
}: {
  teacher?: TeacherResponse;
  onSuccess?: (teacher: { id: string; fullName: string }) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations('teachers.form');
  const tTeachers = useTranslations('teachers');
  const tStatus = useTranslations('teachers.status');
  const tSubject = useTranslations('subject');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const tCommon = useTranslations('common');

  const isEdit = Boolean(teacher);
  const createTeacher = useCreateTeacherMutation();
  const updateTeacher = useUpdateTeacherMutation(teacher?.id ?? '');
  const mutation = isEdit ? updateTeacher : createTeacher;

  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherFormSchema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    defaultValues: teacher
      ? {
          fullName: teacher.fullName,
          email: teacher.email ?? '',
          phone: teacher.phone ?? '',
          telegramUsername: (teacher.telegramUsername ?? '').replace(/^@/, ''),
          subjects: teacher.subjects,
          defaultRate:
            teacher.defaultRateMinor != null ? formatPriceInput(teacher.defaultRateMinor) : '',
          currency: (teacher.currency as TeacherFormValues['currency']) ?? 'EUR',
          color: teacher.color ?? '#465FFF',
          status: teacher.status,
          bio: teacher.bio ?? '',
          avatarKey: teacher.avatarKey,
          notes: teacher.notes ?? '',
        }
      : EMPTY_TEACHER_FORM,
  });
  const { errors, isSubmitting } = form.formState;
  const values = form.watch();

  const phoneRegistration = form.register('phone');
  const phoneField = {
    ...phoneRegistration,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      event.target.value = event.target.value.replace(/[^\d\s()+-]/g, '');
      return phoneRegistration.onChange(event);
    },
  };
  const telegramRegistration = form.register('telegramUsername');
  const telegramField = {
    ...telegramRegistration,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      event.target.value = event.target.value.replace(/[^\w]/g, '');
      return telegramRegistration.onChange(event);
    },
  };

  const availableSubjects = STUDENT_SUBJECTS.filter(
    (subject) => !values.subjects.includes(subject),
  );

  const onSubmit = form.handleSubmit(async (formValues) => {
    const optional = (value: string) => (value.trim() === '' ? undefined : value);
    const rateMinor = formValues.defaultRate.trim() === ''
      ? null
      : parsePriceInput(formValues.defaultRate);
    try {
      if (teacher) {
        const cleared = (value: string) => (value.trim() === '' ? null : value);
        const updated = await updateTeacher.mutateAsync({
          fullName: formValues.fullName,
          email: cleared(formValues.email),
          phone: cleared(formValues.phone),
          telegramUsername: cleared(formValues.telegramUsername),
          subjects: formValues.subjects,
          bio: cleared(formValues.bio),
          defaultRateMinor: rateMinor,
          currency: rateMinor != null ? formValues.currency : null,
          color: formValues.color,
          status: formValues.status,
          avatarKey: formValues.avatarKey,
          notes: cleared(formValues.notes),
        });
        toast.success(tTeachers('toasts.updated'));
        onSuccess?.(updated);
        return;
      }
      const created = await createTeacher.mutateAsync({
        fullName: formValues.fullName,
        email: optional(formValues.email),
        phone: optional(formValues.phone),
        telegramUsername: optional(formValues.telegramUsername),
        subjects: formValues.subjects,
        bio: optional(formValues.bio),
        defaultRateMinor: rateMinor ?? undefined,
        currency: rateMinor != null ? formValues.currency : undefined,
        color: formValues.color,
        status: formValues.status,
        avatarKey: formValues.avatarKey ?? undefined,
        notes: optional(formValues.notes),
      });
      toast.success(tTeachers('toasts.created'));
      onSuccess?.(created);
    } catch {
      // Surfaced by the alert below.
    }
  });

  const pending = isSubmitting || mutation.isPending;

  return (
    <form
      onSubmit={(event) => {
        event.stopPropagation();
        void onSubmit(event);
      }}
      noValidate
    >
      <FieldGroup>
        {mutation.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{tErrors(errorMessageKey(mutation.error))}</AlertDescription>
          </Alert>
        ) : null}

        <Field>
          <FieldLabel htmlFor="teacher-avatar">{t('avatarSection')}</FieldLabel>
          <AvatarPicker
            value={values.avatarKey ?? null}
            onChange={(next) => form.setValue('avatarKey', next)}
            fullName={values.fullName}
            initialsLabel={t('avatarInitials')}
          />
        </Field>

        <Field data-invalid={errors.fullName ? true : undefined}>
          <FieldLabel htmlFor="teacher-full-name">{t('fullName')}</FieldLabel>
          <Input
            id="teacher-full-name"
            autoComplete="name"
            aria-invalid={errors.fullName ? true : undefined}
            {...form.register('fullName')}
          />
          <FieldError errors={[errors.fullName]} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={errors.email ? true : undefined}>
            <FieldLabel htmlFor="teacher-email">{t('email')}</FieldLabel>
            <Input
              id="teacher-email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? true : undefined}
              {...form.register('email')}
            />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={errors.phone ? true : undefined}>
            <FieldLabel htmlFor="teacher-phone">{t('phone')}</FieldLabel>
            <Input
              id="teacher-phone"
              type="tel"
              inputMode="tel"
              placeholder={t('phonePlaceholder')}
              aria-invalid={errors.phone ? true : undefined}
              {...phoneField}
            />
            <FieldError errors={[errors.phone]} />
          </Field>
        </div>

        <Field data-invalid={errors.telegramUsername ? true : undefined}>
          <FieldLabel htmlFor="teacher-telegram">{t('telegramUsername')}</FieldLabel>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground select-none">
              @
            </span>
            <Input
              id="teacher-telegram"
              autoComplete="off"
              spellCheck={false}
              className="pl-7"
              placeholder={t('telegramPlaceholder')}
              aria-invalid={errors.telegramUsername ? true : undefined}
              {...telegramField}
            />
          </div>
          <FieldError errors={[errors.telegramUsername]} />
        </Field>

        <Field>
          <FieldLabel>{t('subjects')}</FieldLabel>
          {values.subjects.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {values.subjects.map((subject) => (
                <Badge key={subject} variant="secondary" className="gap-1">
                  {tSubject(subject)}
                  <button
                    type="button"
                    className="-mr-1 rounded-sm hover:text-foreground"
                    onClick={() =>
                      form.setValue(
                        'subjects',
                        values.subjects.filter((item) => item !== subject),
                      )
                    }
                    aria-label={tCommon('remove')}
                  >
                    <XIcon className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}
          {availableSubjects.length > 0 ? (
            <Select
              value=""
              onValueChange={(subject) =>
                form.setValue('subjects', [
                  ...values.subjects,
                  subject as TeacherFormValues['subjects'][number],
                ])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t('subjectsPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {availableSubjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {tSubject(subject)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : null}
        </Field>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
          <Field data-invalid={errors.defaultRate ? true : undefined}>
            <FieldLabel htmlFor="teacher-rate">{t('defaultRate')}</FieldLabel>
            <Input
              id="teacher-rate"
              inputMode="decimal"
              placeholder={t('ratePlaceholder')}
              aria-invalid={errors.defaultRate ? true : undefined}
              {...form.register('defaultRate')}
            />
            <FieldError errors={[errors.defaultRate]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="teacher-currency">{t('currency')}</FieldLabel>
            <Select
              value={values.currency}
              onValueChange={(value) =>
                form.setValue('currency', value as TeacherFormValues['currency'])
              }
            >
              <SelectTrigger id="teacher-currency" className="w-full sm:w-28">
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
          <Field>
            <FieldLabel htmlFor="teacher-color">{t('color')}</FieldLabel>
            <Input
              id="teacher-color"
              type="color"
              className="h-9 w-16 p-1"
              {...form.register('color')}
            />
          </Field>
        </div>

        {isEdit ? (
          <Field>
            <FieldLabel htmlFor="teacher-status">{t('status')}</FieldLabel>
            <Select
              value={values.status}
              onValueChange={(value) =>
                form.setValue('status', value as TeacherFormValues['status'])
              }
            >
              <SelectTrigger id="teacher-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">{tStatus('ACTIVE')}</SelectItem>
                <SelectItem value="ARCHIVED">{tStatus('ARCHIVED')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        ) : null}

        <Field data-invalid={errors.bio ? true : undefined}>
          <FieldLabel htmlFor="teacher-bio">{t('bio')}</FieldLabel>
          <Textarea
            id="teacher-bio"
            rows={2}
            placeholder={t('bioPlaceholder')}
            aria-invalid={errors.bio ? true : undefined}
            {...form.register('bio')}
          />
          <FieldError errors={[errors.bio]} />
        </Field>

        <Field data-invalid={errors.notes ? true : undefined}>
          <FieldLabel htmlFor="teacher-notes">{t('notes')}</FieldLabel>
          <Textarea
            id="teacher-notes"
            rows={3}
            placeholder={t('notesPlaceholder')}
            aria-invalid={errors.notes ? true : undefined}
            {...form.register('notes')}
          />
          <FieldError errors={[errors.notes]} />
        </Field>

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
    </form>
  );
}
