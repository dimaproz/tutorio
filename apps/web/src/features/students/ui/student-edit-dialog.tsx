'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { SUPPORTED_CURRENCIES } from '@tutorio/domain';
import { STUDENT_KNOWLEDGE_LEVELS, STUDENT_LANGUAGE_LEVELS, type StudentDetail } from '@tutorio/validation';
import { AvatarPicker } from '@/components/shared/avatar-picker';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CurrencyOption } from '@/components/shared/currency-option';
import { EntityFormDialog } from '@/components/shared/entity-form-dialog';
import { FormActions } from '@/components/shared/form-actions';
import { MoneyInput } from '@/components/shared/money-input';
import { QueryErrorAlert } from '@/components/shared/page-shell';
import { TimezoneCombobox } from '@/components/shared/timezone-combobox';
import { useSession } from '@/components/app/session-provider';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import {
  buildStudentEditDto,
  studentEditDefaults,
  studentEditSchema,
  type StudentEditValues,
} from '@/features/students/model/form';
import { errorMessageKey } from '@/lib/api/error-message';
import { useStudentQuery, useUpdateStudentMutation } from '@/lib/api/students';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { scrollToFirstError } from '@/lib/forms/focus-error';

const NONE = 'none';

export function StudentEditDialog({
  open,
  onOpenChange,
  studentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
}) {
  const t = useTranslations('students.form');
  const tStudents = useTranslations('students');
  const tCommon = useTranslations('common');
  const student = useStudentQuery(studentId, open);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);

  const requestClose = () => {
    if (pending) return;
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(false);
  };

  const ready = student.data && student.data.status !== 'ARCHIVED';

  return (
    <>
      <EntityFormDialog
        open={open}
        onOpenChange={(next) => next ? onOpenChange(true) : requestClose()}
        title={t('editTitle')}
        description={t('editSubtitle')}
        width="lg"
        isLoading={student.isPending}
        footer={ready ? (
          <FormActions>
            <Button type="button" variant="outline" onClick={requestClose} disabled={pending}>{tCommon('cancel')}</Button>
            <Button type="submit" form="student-edit-form" disabled={pending}>{pending ? <Spinner data-icon="inline-start" /> : null}{t('submitEdit')}</Button>
          </FormActions>
        ) : undefined}
      >
        {student.isError ? (
          <QueryErrorAlert error={student.error} title={t('loadErrorTitle')} message={t('loadErrorDescription')} onRetry={() => void student.refetch()} />
        ) : student.data?.status === 'ARCHIVED' ? (
          <Alert><AlertTitle>{tStudents('detail.archivedTitle')}</AlertTitle><AlertDescription>{tStudents('detail.archivedDescription')}</AlertDescription></Alert>
        ) : student.data ? (
          <StudentEditForm
            key={`${student.data.id}-${student.data.updatedAt}`}
            student={student.data}
            onDirtyChange={setDirty}
            onPendingChange={setPending}
            onSaved={() => { setDirty(false); onOpenChange(false); }}
          />
        ) : null}
      </EntityFormDialog>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={t('discardTitle')}
        description={t('discardDescription')}
        confirmLabel={t('discardAction')}
        onConfirm={() => { setDirty(false); setDiscardOpen(false); onOpenChange(false); }}
      />
    </>
  );
}

function StudentEditForm({
  student,
  onDirtyChange,
  onPendingChange,
  onSaved,
}: {
  student: StudentDetail;
  onDirtyChange: (dirty: boolean) => void;
  onPendingChange: (pending: boolean) => void;
  onSaved: () => void;
}) {
  const session = useSession();
  const t = useTranslations('students.form');
  const tStudents = useTranslations('students');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const tLanguage = useTranslations('languageLevel');
  const tKnowledge = useTranslations('knowledgeLevel');
  const updateStudent = useUpdateStudentMutation(student.id);
  const form = useForm<StudentEditValues>({
    resolver: zodResolver(studentEditSchema, { errorMap: makeZodErrorMap(tValidation), path: [], async: true }),
    defaultValues: studentEditDefaults(student, session.workspace.defaultCurrency),
  });
  const values = useWatch({ control: form.control }) as StudentEditValues;
  const { errors, isDirty, isSubmitting } = form.formState;
  const pending = isSubmitting || updateStudent.isPending;

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);
  useEffect(() => onPendingChange(pending), [pending, onPendingChange]);

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
      event.target.value = event.target.value.replace(/^@+/, '').replace(/[^\w]/g, '');
      return telegramRegistration.onChange(event);
    },
  };

  const submit = form.handleSubmit(async (formValues) => {
    try {
      await updateStudent.mutateAsync(buildStudentEditDto(formValues));
      toast.success(tStudents('toasts.updated'));
      form.reset(formValues);
      onSaved();
    } catch {
      // The localized mutation error stays inside the editor.
    }
  }, scrollToFirstError);

  return (
    <form id="student-edit-form" onSubmit={(event) => { event.stopPropagation(); void submit(event); }} noValidate>
      <FieldGroup>
        {updateStudent.error ? <Alert variant="destructive" role="alert"><AlertDescription>{tErrors(errorMessageKey(updateStudent.error))}</AlertDescription></Alert> : null}
        <Accordion type="multiple" defaultValue={['identity', 'contacts']}>
          <AccordionItem value="identity">
            <AccordionTrigger>{t('identitySection')}</AccordionTrigger>
            <AccordionContent><FieldGroup>
              <AvatarPicker value={values.avatarKey} onChange={(avatarKey) => form.setValue('avatarKey', avatarKey, { shouldDirty: true })} fullName={values.fullName} initialsLabel={t('avatarInitials')} />
              <Field data-invalid={errors.fullName ? true : undefined}><FieldLabel htmlFor="student-edit-full-name">{t('fullName')}</FieldLabel><Input id="student-edit-full-name" autoComplete="name" aria-invalid={errors.fullName ? true : undefined} {...form.register('fullName')} /><FieldError errors={[errors.fullName]} /></Field>
            </FieldGroup></AccordionContent>
          </AccordionItem>
          <AccordionItem value="contacts">
            <AccordionTrigger>{t('contactsSection')}</AccordionTrigger>
            <AccordionContent><FieldGroup>
              <Field data-invalid={errors.email ? true : undefined}><FieldLabel htmlFor="student-edit-email">{t('email')}</FieldLabel><Input id="student-edit-email" type="email" autoComplete="email" aria-invalid={errors.email ? true : undefined} {...form.register('email')} /><FieldError errors={[errors.email]} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={errors.phone ? true : undefined}><FieldLabel htmlFor="student-edit-phone">{t('phone')}</FieldLabel><Input id="student-edit-phone" type="tel" autoComplete="tel" aria-invalid={errors.phone ? true : undefined} {...phoneField} /><FieldError errors={[errors.phone]} /></Field>
                <Field data-invalid={errors.telegramUsername ? true : undefined}><FieldLabel htmlFor="student-edit-telegram">{t('telegramUsername')}</FieldLabel><InputGroup><InputGroupAddon>@</InputGroupAddon><InputGroupInput id="student-edit-telegram" aria-invalid={errors.telegramUsername ? true : undefined} {...telegramField} /></InputGroup><FieldError errors={[errors.telegramUsername]} /></Field>
              </div>
            </FieldGroup></AccordionContent>
          </AccordionItem>
          <AccordionItem value="learning">
            <AccordionTrigger>{t('learningProfileSection')}</AccordionTrigger>
            <AccordionContent><FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={errors.age ? true : undefined}><FieldLabel htmlFor="student-edit-age">{t('age')}</FieldLabel><Input id="student-edit-age" inputMode="numeric" aria-invalid={errors.age ? true : undefined} {...form.register('age')} /><FieldError errors={[errors.age]} /></Field>
                <Field data-invalid={errors.grade ? true : undefined}><FieldLabel htmlFor="student-edit-grade">{t('grade')}</FieldLabel><Input id="student-edit-grade" inputMode="numeric" aria-invalid={errors.grade ? true : undefined} {...form.register('grade')} /><FieldError errors={[errors.grade]} /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel htmlFor="student-edit-knowledge">{t('generalLevel')}</FieldLabel><Select value={values.knowledgeLevel || NONE} onValueChange={(value) => form.setValue('knowledgeLevel', value === NONE ? '' : value as StudentEditValues['knowledgeLevel'], { shouldDirty: true })}><SelectTrigger id="student-edit-knowledge" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value={NONE}>{tCommon('notProvided')}</SelectItem>{STUDENT_KNOWLEDGE_LEVELS.map((level) => <SelectItem key={level} value={level}>{tKnowledge(level)}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
                <Field><FieldLabel htmlFor="student-edit-language">{t('languageLevelCefr')}</FieldLabel><Select value={values.languageLevel || NONE} onValueChange={(value) => form.setValue('languageLevel', value === NONE ? '' : value as StudentEditValues['languageLevel'], { shouldDirty: true })}><SelectTrigger id="student-edit-language" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value={NONE}>{tCommon('notProvided')}</SelectItem>{STUDENT_LANGUAGE_LEVELS.map((level) => <SelectItem key={level} value={level}>{tLanguage(level)}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
              </div>
            </FieldGroup></AccordionContent>
          </AccordionItem>
          <AccordionItem value="preferences">
            <AccordionTrigger>{t('preferencesSection')}</AccordionTrigger>
            <AccordionContent><Field data-invalid={errors.timezone ? true : undefined}><FieldLabel htmlFor="student-edit-timezone">{t('timezone')}</FieldLabel><TimezoneCombobox id="student-edit-timezone" value={values.timezone} onChange={(timezone) => form.setValue('timezone', timezone, { shouldDirty: true, shouldValidate: true })} placeholder={t('timezonePlaceholder')} searchPlaceholder={t('timezoneSearch')} emptyLabel={t('timezoneEmpty')} invalid={Boolean(errors.timezone)} /><FieldError errors={[errors.timezone]} /></Field></AccordionContent>
          </AccordionItem>
          <AccordionItem value="pricing">
            <AccordionTrigger>{t('pricingSection')}</AccordionTrigger>
            <AccordionContent><div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field data-invalid={errors.pricePerLesson ? true : undefined}><FieldLabel htmlFor="student-edit-price">{t('pricePerLesson')}</FieldLabel><MoneyInput id="student-edit-price" aria-invalid={errors.pricePerLesson ? true : undefined} {...form.register('pricePerLesson')} /><FieldError errors={[errors.pricePerLesson]} /></Field>
              {values.pricePerLesson.trim() ? <Field><FieldLabel htmlFor="student-edit-currency">{t('currency')}</FieldLabel><Select value={values.currency} onValueChange={(currency) => form.setValue('currency', currency as StudentEditValues['currency'], { shouldDirty: true })}><SelectTrigger id="student-edit-currency" className="w-full sm:w-32"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{SUPPORTED_CURRENCIES.map((currency) => <SelectItem key={currency} value={currency}><CurrencyOption code={currency} /></SelectItem>)}</SelectGroup></SelectContent></Select></Field> : null}
            </div></AccordionContent>
          </AccordionItem>
          <AccordionItem value="notes">
            <AccordionTrigger>{t('notesSection')}</AccordionTrigger>
            <AccordionContent><Field data-invalid={errors.notes ? true : undefined}><FieldLabel htmlFor="student-edit-notes">{t('notes')}</FieldLabel><Textarea id="student-edit-notes" rows={5} aria-invalid={errors.notes ? true : undefined} {...form.register('notes')} /><FieldError errors={[errors.notes]} /></Field></AccordionContent>
          </AccordionItem>
        </Accordion>
      </FieldGroup>
    </form>
  );
}
