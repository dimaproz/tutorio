'use client';

import { useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { BanknoteIcon, CalendarClockIcon, StickyNoteIcon, UserRoundIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { SUPPORTED_CURRENCIES } from '@tutorio/domain';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { CurrencyOption } from '@/components/app/currency-option';
import { DurationInput } from '@/components/app/duration-input';
import { FormSection } from '@/components/app/form-section';
import { MoneyInput } from '@/components/app/money-input';
import { useSession } from '@/components/app/session-provider';
import { detectTimezone, TimezoneCombobox } from '@/components/app/timezone-combobox';
import {
  DatePicker,
  DateRangePicker,
  EntityFormDialog,
  EntityPicker,
  FormActions,
  TimePicker,
  WeekdayPicker,
} from '@/components/shared';
import {
  buildCreatePackageDto,
  emptyPackageForm,
  packageFormSchema,
  previewTotalMinor,
  type PackageFormValues,
} from '@/features/packages/model/package-form';
import { errorMessageKey } from '@/lib/api/error-message';
import { useGroupsQuery } from '@/lib/api/groups';
import { useCreatePackageMutation } from '@/lib/api/packages';
import { useStudentsQuery } from '@/lib/api/students';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { scrollToFirstError } from '@/lib/forms/focus-error';
import { formatMoneyDisplay, formatPriceInput } from '@/lib/money';

export function PackageFormDialog({
  open,
  onOpenChange,
  lockedStudentId,
  lockedGroupId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set when opened from a student or group page — the target is fixed. */
  lockedStudentId?: string;
  lockedGroupId?: string;
}) {
  const t = useTranslations('packages.form');
  const tPackages = useTranslations('packages');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const locale = useLocale();
  const session = useSession();

  const students = useStudentsQuery({ page: 1, pageSize: 100 }, open);
  const groups = useGroupsQuery({ page: 1, pageSize: 100 }, open);
  const createPackage = useCreatePackageMutation();

  const defaults = useMemo(
    () =>
      emptyPackageForm({
        currency: session.workspace.defaultCurrency,
        timezone: detectTimezone(),
        targetKind: lockedGroupId ? 'group' : 'student',
        targetId: lockedGroupId ?? lockedStudentId,
      }),
    [session.workspace.defaultCurrency, lockedGroupId, lockedStudentId],
  );

  const form = useForm<PackageFormValues>({
    resolver: zodResolver(packageFormSchema, {
      errorMap: makeZodErrorMap(tValidation, {
        targetId: { invalid: 'studentRequired' },
        weekdays: { tooSmall: 'weekdaysRequired' },
      }),
      path: [],
      async: true,
    }),
    defaultValues: defaults,
  });
  const { errors } = form.formState;
  // Only the fields that drive layout or the live total — watching the whole
  // form would re-render every section on any keystroke.
  const [
    targetKind,
    sizingMode,
    scheduleEnabled,
    currency,
    price,
    lessonsTotal,
    endDate,
    scheduleStartDate,
  ] = useWatch({
    control: form.control,
    name: [
      'targetKind',
      'sizingMode',
      'scheduleEnabled',
      'currency',
      'price',
      'lessonsTotal',
      'endDate',
      'scheduleStartDate',
    ],
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    createPackage.reset();
    form.reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on open
  }, [open, defaults]);

  const studentOptions = useMemo(
    () =>
      (students.data?.items ?? []).map((student) => ({
        value: student.id,
        label: student.fullName,
        avatarKey: student.avatarKey,
      })),
    [students.data],
  );

  /** Picking a student prefills the price from their own hourly rate. */
  const onPickStudent = (value?: string) => {
    const next = value ?? '';
    form.setValue('targetId', next, { shouldValidate: true });
    const student = students.data?.items.find((item) => item.id === next);
    if (student?.hourlyRateMinor != null) {
      form.setValue('price', formatPriceInput(student.hourlyRateMinor));
      if (student.currency) {
        form.setValue('currency', student.currency as PackageFormValues['currency']);
      }
    }
  };

  const onSubmit = form.handleSubmit(async (formValues) => {
    try {
      await createPackage.mutateAsync(buildCreatePackageDto(formValues));
      toast.success(tPackages('toasts.created'));
      onOpenChange(false);
    } catch {
      // Surfaced by the alert below.
    }
  }, scrollToFirstError);

  const isGroup = targetKind === 'group';
  const targetLocked = Boolean(lockedStudentId || lockedGroupId);
  const totalPreview = previewTotalMinor({ sizingMode, price, lessonsTotal });

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('createTitle')}
      description={t('createSubtitle')}
      width="md"
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-7">
        {createPackage.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{tErrors(errorMessageKey(createPackage.error))}</AlertDescription>
          </Alert>
        ) : null}

        <FormSection
          icon={UserRoundIcon}
          title={t('targetKind')}
          description={t('createSubtitle')}
          tone="primary"
        >
          {!targetLocked ? (
            <>
              <Controller
                control={form.control}
                name="targetKind"
                render={({ field }) => (
                  <Field>
                    <FieldLabel>{t('targetKind')}</FieldLabel>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={field.value}
                      onValueChange={(value) => {
                        if (!value) {
                          return;
                        }
                        field.onChange(value);
                        // The two target kinds hold different ids.
                        form.setValue('targetId', '');
                      }}
                    >
                      <ToggleGroupItem value="student">{t('targetStudent')}</ToggleGroupItem>
                      <ToggleGroupItem value="group">{t('targetGroup')}</ToggleGroupItem>
                    </ToggleGroup>
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="targetId"
                render={({ field }) =>
                  isGroup ? (
                    <Field data-invalid={errors.targetId ? true : undefined}>
                      <FieldLabel htmlFor="package-group">{t('group')}</FieldLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          id="package-group"
                          className="w-full"
                          aria-invalid={errors.targetId ? true : undefined}
                        >
                          <SelectValue placeholder={t('groupPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {(groups.data?.items ?? []).map((group) => (
                              <SelectItem key={group.id} value={group.id}>
                                {group.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldError errors={[errors.targetId]} />
                    </Field>
                  ) : (
                    <Field data-invalid={errors.targetId ? true : undefined}>
                      <FieldLabel htmlFor="package-student">{t('student')}</FieldLabel>
                      <EntityPicker
                        id="package-student"
                        value={field.value}
                        options={studentOptions}
                        onChange={onPickStudent}
                        placeholder={t('studentPlaceholder')}
                        searchPlaceholder={t('studentSearch')}
                        emptyLabel={t('studentEmpty')}
                        invalid={Boolean(errors.targetId)}
                        isLoading={students.isPending}
                      />
                      <FieldError errors={[errors.targetId]} />
                    </Field>
                  )
                }
              />
            </>
          ) : null}

          <Field data-invalid={errors.name ? true : undefined}>
            <FieldLabel htmlFor="package-name">{t('name')}</FieldLabel>
            <Input
              id="package-name"
              placeholder={t('namePlaceholder')}
              aria-invalid={errors.name ? true : undefined}
              {...form.register('name')}
            />
            <FieldError errors={[errors.name]} />
          </Field>
        </FormSection>

        <FormSection
          icon={BanknoteIcon}
          title={t('sizingMode')}
          description={t('pricePerLesson')}
          tone="success"
        >
          <Controller
            control={form.control}
            name="sizingMode"
            render={({ field }) => (
              <Field>
                <FieldLabel>{t('sizingMode')}</FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={field.value}
                  onValueChange={(value) => value && field.onChange(value)}
                >
                  <ToggleGroupItem value="FIXED_COUNT">{t('fixedCount')}</ToggleGroupItem>
                  <ToggleGroupItem value="BY_PERIOD">{t('byPeriod')}</ToggleGroupItem>
                </ToggleGroup>
              </Field>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            {sizingMode === 'FIXED_COUNT' ? (
              <Field data-invalid={errors.lessonsTotal ? true : undefined}>
                <FieldLabel htmlFor="package-lessons">{t('lessonsTotal')}</FieldLabel>
                <Input
                  id="package-lessons"
                  type="number"
                  min={1}
                  max={500}
                  aria-invalid={errors.lessonsTotal ? true : undefined}
                  {...form.register('lessonsTotal')}
                />
                <FieldError errors={[errors.lessonsTotal]} />
              </Field>
            ) : (
              <Field data-invalid={errors.endDate ? true : undefined}>
                <FieldLabel htmlFor="package-period">{t('period')}</FieldLabel>
                {/* A by-period package *is* a range, so it is picked as one:
                    the two ends feed scheduleStartDate and endDate. */}
                <DateRangePicker
                  id="package-period"
                  value={{ from: scheduleStartDate, to: endDate }}
                  onChange={(range) => {
                    form.setValue('scheduleStartDate', range.from, {
                      shouldValidate: true,
                    });
                    form.setValue('endDate', range.to, { shouldValidate: true });
                  }}
                  invalid={Boolean(errors.endDate)}
                />
                <FieldDescription>{t('scheduleHint')}</FieldDescription>
                <FieldError errors={[errors.endDate]} />
              </Field>
            )}

            <Field data-invalid={errors.price ? true : undefined}>
              <FieldLabel htmlFor="package-price">{t('pricePerLesson')}</FieldLabel>
              <MoneyInput
                id="package-price"
                aria-invalid={errors.price ? true : undefined}
                {...form.register('price')}
              />
              <FieldError errors={[errors.price]} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Controller
              control={form.control}
              name="currency"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="package-currency">{t('currency')}</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="package-currency" className="w-full sm:w-48">
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
              )}
            />
            {/* Live total so the tutor sees what the package costs. */}
            {totalPreview != null ? (
              <p className="tabular text-sm font-semibold sm:pb-2.5" aria-live="polite">
                {formatMoneyDisplay(totalPreview, currency, locale)}
              </p>
            ) : null}
          </div>
        </FormSection>

        <FormSection
          icon={CalendarClockIcon}
          title={t('scheduleEnabled')}
          description={t('scheduleHint')}
          tone="warning"
        >
          <Controller
            control={form.control}
            name="scheduleEnabled"
            render={({ field }) => (
              <Field data-invalid={errors.scheduleEnabled ? true : undefined}>
                <FieldLabel
                  htmlFor="package-schedule-enabled"
                  className="flex items-center gap-2 font-normal"
                >
                  <Checkbox
                    id="package-schedule-enabled"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                  {t('scheduleEnabled')}
                </FieldLabel>
                <FieldError errors={[errors.scheduleEnabled]} />
              </Field>
            )}
          />

          {scheduleEnabled ? (
            <>
              <Controller
                control={form.control}
                name="weekdays"
                render={({ field }) => (
                  <Field data-invalid={errors.weekdays ? true : undefined}>
                    <FieldLabel htmlFor="package-weekdays">{t('weekdays')}</FieldLabel>
                    <WeekdayPicker
                      id="package-weekdays"
                      value={field.value}
                      onChange={field.onChange}
                      invalid={Boolean(errors.weekdays)}
                    />
                    <FieldError errors={[errors.weekdays as { message?: string } | undefined]} />
                  </Field>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  control={form.control}
                  name="localTime"
                  render={({ field }) => (
                    <Field data-invalid={errors.localTime ? true : undefined}>
                      <FieldLabel htmlFor="package-time">{t('time')}</FieldLabel>
                      <TimePicker
                        id="package-time"
                        value={field.value}
                        onChange={field.onChange}
                        invalid={Boolean(errors.localTime)}
                      />
                      <FieldError errors={[errors.localTime]} />
                    </Field>
                  )}
                />
                <Field data-invalid={errors.durationMin ? true : undefined}>
                  <FieldLabel htmlFor="package-duration">{t('duration')}</FieldLabel>
                  <Controller
                    control={form.control}
                    name="durationMin"
                    render={({ field }) => (
                      <DurationInput
                        id="package-duration"
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        invalid={Boolean(errors.durationMin)}
                      />
                    )}
                  />
                  <FieldError errors={[errors.durationMin]} />
                </Field>
              </div>

              {/* A by-period package already picked its start with the range. */}
              {sizingMode === 'FIXED_COUNT' ? (
                <Controller
                  control={form.control}
                  name="scheduleStartDate"
                  render={({ field }) => (
                    <Field data-invalid={errors.scheduleStartDate ? true : undefined}>
                      <FieldLabel htmlFor="package-schedule-start">{t('startDate')}</FieldLabel>
                      <DatePicker
                        id="package-schedule-start"
                        value={field.value}
                        onChange={field.onChange}
                        invalid={Boolean(errors.scheduleStartDate)}
                      />
                      <FieldError errors={[errors.scheduleStartDate]} />
                    </Field>
                  )}
                />
              ) : null}

              <Controller
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <Field data-invalid={errors.timezone ? true : undefined}>
                    <FieldLabel htmlFor="package-timezone">{t('timezone')}</FieldLabel>
                    <TimezoneCombobox
                      id="package-timezone"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t('timezone')}
                      searchPlaceholder={t('timezone')}
                      emptyLabel={t('timezone')}
                    />
                    <FieldError errors={[errors.timezone]} />
                  </Field>
                )}
              />
            </>
          ) : null}
        </FormSection>

        <FormSection icon={StickyNoteIcon} title={t('notes')} tone="neutral">
          <Field data-invalid={errors.notes ? true : undefined}>
            <FieldLabel htmlFor="package-notes">{t('notes')}</FieldLabel>
            <Textarea id="package-notes" {...form.register('notes')} />
            <FieldError errors={[errors.notes]} />
          </Field>
        </FormSection>

        <FormActions>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={createPackage.isPending}>
            {createPackage.isPending ? <Spinner data-icon="inline-start" /> : null}
            {t('submit')}
          </Button>
        </FormActions>
      </form>
    </EntityFormDialog>
  );
}
