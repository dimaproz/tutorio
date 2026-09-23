'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDownIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { SUPPORTED_CURRENCIES } from '@tutorio/domain';
import type { StudentResponse } from '@tutorio/validation';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CurrencyOption } from '@/components/shared/currency-option';
import { EntityFormDialog } from '@/components/shared/entity-form-dialog';
import { FormActions } from '@/components/shared/form-actions';
import { MoneyInput } from '@/components/shared/money-input';
import { detectTimezone, TimezoneCombobox } from '@/components/shared/timezone-combobox';
import { useSession } from '@/components/app/session-provider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
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
import {
  buildStudentQuickCreateDto,
  emptyStudentQuickCreate,
  studentQuickCreateSchema,
  type StudentQuickCreateValues,
} from '@/features/students/model/form';
import { errorMessageKey } from '@/lib/api/error-message';
import { useCreateStudentMutation } from '@/lib/api/students';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { scrollToFirstError } from '@/lib/forms/focus-error';
import { keepPhoneCharacters, keepTelegramCharacters } from '@/lib/forms/input-filters';

/** Fields rendered inside the collapsible "More details" section. */
const MORE_DETAIL_FIELDS = new Set(['email', 'age', 'grade', 'notes', 'timezone']);

export function StudentQuickCreateDialog({
  open,
  onOpenChange,
  onSuccess,
  navigateOnSuccess = true,
  initialTimezone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (student: StudentResponse) => void;
  navigateOnSuccess?: boolean;
  initialTimezone?: string;
}) {
  const t = useTranslations('students.form');
  const tStudents = useTranslations('students');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const session = useSession();
  const router = useRouter();
  const createStudent = useCreateStudentMutation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const form = useForm<StudentQuickCreateValues>({
    resolver: zodResolver(studentQuickCreateSchema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    defaultValues: emptyStudentQuickCreate({
      currency: session.workspace.defaultCurrency,
      timezone: initialTimezone ?? detectTimezone(),
    }),
  });
  // Only the fields the dialog shows elsewhere: typing a name or a contact
  // does not re-render the whole dialog, and the price only when it empties
  // or fills.
  const hasPrice = useWatch({
    control: form.control,
    name: 'pricePerLesson',
    compute: (price: string) => price.trim() !== '',
  });
  const currency = useWatch({ control: form.control, name: 'currency' });
  const timezone = useWatch({ control: form.control, name: 'timezone' });
  const { errors, isDirty, isSubmitting } = form.formState;
  const pending = isSubmitting || createStudent.isPending;

  useEffect(() => {
    if (!open) return;
    createStudent.reset();
    form.reset(
      emptyStudentQuickCreate({
        currency: session.workspace.defaultCurrency,
        timezone: initialTimezone ?? detectTimezone(),
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialize once per opening
  }, [open]);

  const requestClose = () => {
    if (pending) return;
    if (isDirty) {
      setDiscardOpen(true);
      return;
    }
    setMoreOpen(false);
    onOpenChange(false);
  };

  const phoneRegistration = form.register('phone');
  const phoneField = {
    ...phoneRegistration,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      event.target.value = keepPhoneCharacters(event.target.value);
      return phoneRegistration.onChange(event);
    },
  };
  const telegramRegistration = form.register('telegramUsername');
  const telegramField = {
    ...telegramRegistration,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      event.target.value = keepTelegramCharacters(event.target.value);
      return telegramRegistration.onChange(event);
    },
  };

  // A field inside the collapsed "More details" section is unmounted, so its
  // error would be invisible and focus would go nowhere: open it first, then
  // scroll to the first error once the section has rendered.
  const revealFirstError: Parameters<typeof form.handleSubmit>[1] = (fieldErrors) => {
    if (Object.keys(fieldErrors).some((name) => MORE_DETAIL_FIELDS.has(name))) {
      setMoreOpen(true);
      requestAnimationFrame(() => scrollToFirstError(fieldErrors));
      return;
    }
    scrollToFirstError(fieldErrors);
  };

  const submit = form.handleSubmit(async (formValues) => {
    try {
      const student = await createStudent.mutateAsync(buildStudentQuickCreateDto(formValues));
      toast.success(tStudents('toasts.created'));
      form.reset(formValues);
      setMoreOpen(false);
      onOpenChange(false);
      onSuccess?.(student);
      if (navigateOnSuccess) router.push(`/app/students/${student.id}?setup=1`);
    } catch {
      // The localized request error remains visible with all entered values.
    }
  }, revealFirstError);

  return (
    <>
      <EntityFormDialog
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}
        title={t('createTitle')}
        description={t('createSubtitle')}
        width="md"
        footer={
          <FormActions>
            <Button type="button" variant="outline" onClick={requestClose} disabled={pending}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" form="student-quick-create-form" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {t('submitCreate')}
            </Button>
          </FormActions>
        }
      >
        <form
          id="student-quick-create-form"
          onSubmit={(event) => {
            event.stopPropagation();
            void submit(event);
          }}
          noValidate
        >
          <FieldGroup>
            {createStudent.error ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{tErrors(errorMessageKey(createStudent.error))}</AlertDescription>
              </Alert>
            ) : null}
            <Field data-invalid={errors.fullName ? true : undefined}>
              <FieldLabel htmlFor="student-quick-full-name">{t('fullName')}</FieldLabel>
              <Input
                id="student-quick-full-name"
                autoFocus
                autoComplete="name"
                aria-invalid={errors.fullName ? true : undefined}
                aria-describedby={errors.fullName ? 'student-quick-full-name-error' : undefined}
                placeholder={t('fullNamePlaceholder')}
                {...form.register('fullName')}
              />
              <FieldError id="student-quick-full-name-error" errors={[errors.fullName]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={errors.phone ? true : undefined}>
                <FieldLabel htmlFor="student-quick-phone">{t('phone')}</FieldLabel>
                <Input
                  id="student-quick-phone"
                  type="tel"
                  autoComplete="tel"
                  aria-invalid={errors.phone ? true : undefined}
                  aria-describedby={errors.phone ? 'student-quick-phone-error' : undefined}
                  {...phoneField}
                />
                <FieldError id="student-quick-phone-error" errors={[errors.phone]} />
              </Field>
              <Field data-invalid={errors.telegramUsername ? true : undefined}>
                <FieldLabel htmlFor="student-quick-telegram">{t('telegramUsername')}</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>@</InputGroupAddon>
                  <InputGroupInput
                    id="student-quick-telegram"
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={errors.telegramUsername ? true : undefined}
                    aria-describedby={
                      errors.telegramUsername ? 'student-quick-telegram-error' : undefined
                    }
                    {...telegramField}
                  />
                </InputGroup>
                <FieldError id="student-quick-telegram-error" errors={[errors.telegramUsername]} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field data-invalid={errors.pricePerLesson ? true : undefined}>
                <FieldLabel htmlFor="student-quick-price">{t('pricePerLesson')}</FieldLabel>
                <MoneyInput
                  id="student-quick-price"
                  aria-invalid={errors.pricePerLesson ? true : undefined}
                  aria-describedby={errors.pricePerLesson ? 'student-quick-price-error' : undefined}
                  placeholder={t('pricePerLessonHint')}
                  {...form.register('pricePerLesson')}
                />
                <FieldError id="student-quick-price-error" errors={[errors.pricePerLesson]} />
              </Field>
              {hasPrice ? (
                <Field>
                  <FieldLabel htmlFor="student-quick-currency">{t('currency')}</FieldLabel>
                  <Select
                    value={currency}
                    onValueChange={(currency) =>
                      form.setValue('currency', currency as StudentQuickCreateValues['currency'], {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger id="student-quick-currency" className="w-full sm:w-32">
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
              ) : null}
            </div>
            <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" className="w-full justify-between">
                  {t('addMoreDetails')}
                  <ChevronDownIcon
                    data-icon="inline-end"
                    className={moreOpen ? 'rotate-180' : undefined}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <FieldGroup>
                  <Field data-invalid={errors.email ? true : undefined}>
                    <FieldLabel htmlFor="student-quick-email">{t('email')}</FieldLabel>
                    <Input
                      id="student-quick-email"
                      type="email"
                      autoComplete="email"
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby={errors.email ? 'student-quick-email-error' : undefined}
                      {...form.register('email')}
                    />
                    <FieldError id="student-quick-email-error" errors={[errors.email]} />
                  </Field>
                  <Field data-invalid={errors.timezone ? true : undefined}>
                    <FieldLabel htmlFor="student-quick-timezone">{t('timezone')}</FieldLabel>
                    <TimezoneCombobox
                      id="student-quick-timezone"
                      value={timezone}
                      onChange={(timezone) =>
                        form.setValue('timezone', timezone, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                      placeholder={t('timezonePlaceholder')}
                      searchPlaceholder={t('timezoneSearch')}
                      emptyLabel={t('timezoneEmpty')}
                      invalid={Boolean(errors.timezone)}
                      describedBy={errors.timezone ? 'student-quick-timezone-error' : undefined}
                    />
                    <FieldError id="student-quick-timezone-error" errors={[errors.timezone]} />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field data-invalid={errors.age ? true : undefined}>
                      <FieldLabel htmlFor="student-quick-age">{t('age')}</FieldLabel>
                      <Input
                        id="student-quick-age"
                        inputMode="numeric"
                        aria-invalid={errors.age ? true : undefined}
                        aria-describedby={errors.age ? 'student-quick-age-error' : undefined}
                        {...form.register('age')}
                      />
                      <FieldError id="student-quick-age-error" errors={[errors.age]} />
                    </Field>
                    <Field data-invalid={errors.grade ? true : undefined}>
                      <FieldLabel htmlFor="student-quick-grade">{t('grade')}</FieldLabel>
                      <Input
                        id="student-quick-grade"
                        inputMode="numeric"
                        aria-invalid={errors.grade ? true : undefined}
                        aria-describedby={errors.grade ? 'student-quick-grade-error' : undefined}
                        {...form.register('grade')}
                      />
                      <FieldError id="student-quick-grade-error" errors={[errors.grade]} />
                    </Field>
                  </div>
                  <Field data-invalid={errors.notes ? true : undefined}>
                    <FieldLabel htmlFor="student-quick-notes">{t('notes')}</FieldLabel>
                    <Textarea
                      id="student-quick-notes"
                      rows={4}
                      aria-invalid={errors.notes ? true : undefined}
                      aria-describedby={errors.notes ? 'student-quick-notes-error' : undefined}
                      {...form.register('notes')}
                    />
                    <FieldError id="student-quick-notes-error" errors={[errors.notes]} />
                  </Field>
                </FieldGroup>
              </CollapsibleContent>
            </Collapsible>
          </FieldGroup>
        </form>
      </EntityFormDialog>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={t('discardTitle')}
        description={t('discardDescription')}
        confirmLabel={t('discardAction')}
        onConfirm={() => {
          setDiscardOpen(false);
          setMoreOpen(false);
          form.reset();
          onOpenChange(false);
        }}
      />
    </>
  );
}
