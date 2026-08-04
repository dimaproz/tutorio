'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  BanknoteIcon,
  CalendarClockIcon,
  CircleAlertIcon,
  Settings2Icon,
  UserRoundIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { SUPPORTED_CURRENCIES } from '@tutorio/domain';
import type { CreatePackageDto } from '@tutorio/validation';
import { CurrencyOption } from '@/components/app/currency-option';
import { DurationInput } from '@/components/app/duration-input';
import { FormSection } from '@/components/app/form-section';
import { MoneyInput } from '@/components/app/money-input';
import { PresetNumberInput } from '@/components/app/preset-number-input';
import { useSession } from '@/components/app/session-provider';
import { detectTimezone, TimezoneCombobox } from '@/components/app/timezone-combobox';
import {
  DatePicker,
  EntityFormDialog,
  EntityPicker,
  FormActions,
  TimePicker,
  WeekdayPicker,
} from '@/components/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  buildCreatePackageDto,
  emptyPackageForm,
  packageFormSchema,
  packageScheduleSummary,
  type PackageFormValues,
} from '@/features/packages/model/package-form';
import { errorMessageKey } from '@/lib/api/error-message';
import { useGroupsQuery } from '@/lib/api/groups';
import { useCreatePackageMutation } from '@/lib/api/packages';
import { useStudentsQuery } from '@/lib/api/students';
import type { GatewayError } from '@/lib/auth/client';
import { toLocalDateInput } from '@/lib/datetime';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { scrollToFirstError } from '@/lib/forms/focus-error';
import { formatMoneyDisplay, formatPriceInput } from '@/lib/money';

const LESSON_PRESETS = [4, 8, 16, 20] as const;
const VALIDITY_PRESETS = [30, 60, 90, 180] as const;

interface ScheduleConflictDetails {
  conflicts: Array<{
    candidate: { startsAtUtc: string; durationMin: number };
    existing: {
      id: string | null;
      startsAtUtc: string;
      durationMin: number;
      student: { id: string; fullName: string } | null;
      group: { id: string; name: string } | null;
    };
    teacher: { id: string; name: string };
    source: 'EXISTING_LESSON' | 'NEW_SLOT';
  }>;
}

function conflictDetails(error: GatewayError): ScheduleConflictDetails | null {
  if (error.status !== 409 || error.code !== 'SCHEDULE_CONFLICT') return null;
  const details = error.details as Partial<ScheduleConflictDetails> | undefined;
  return Array.isArray(details?.conflicts) ? { conflicts: details.conflicts } : { conflicts: [] };
}

export function PackageFormDialog({
  open,
  onOpenChange,
  lockedStudentId,
  lockedGroupId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  const [conflicts, setConflicts] = useState<ScheduleConflictDetails | null>(null);
  const [pendingDto, setPendingDto] = useState<CreatePackageDto | null>(null);

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
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    defaultValues: defaults,
  });
  const { errors } = form.formState;
  const values = useWatch({ control: form.control }) as PackageFormValues;
  const summary = packageScheduleSummary(values);
  const isGroup = values.targetKind === 'group';
  const hasSchedule = values.sizingMode === 'BY_PERIOD' || values.scheduleEnabled;
  const targetLocked = Boolean(lockedStudentId || lockedGroupId);

  useEffect(() => {
    if (!open) return;
    createPackage.reset();
    form.reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialize per opening
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

  const pickStudent = (id?: string) => {
    const value = id ?? '';
    form.setValue('targetId', value, { shouldValidate: true });
    const student = students.data?.items.find((item) => item.id === value);
    form.setValue(
      'price',
      student?.hourlyRateMinor != null ? formatPriceInput(student.hourlyRateMinor) : '',
    );
    form.setValue(
      'currency',
      (student?.currency ?? session.workspace.defaultCurrency) as PackageFormValues['currency'],
    );
  };

  const pickGroup = (id: string) => {
    form.setValue('targetId', id, { shouldValidate: true });
    const group = groups.data?.items.find((item) => item.id === id);
    form.setValue(
      'price',
      group?.pricePerLesson != null ? formatPriceInput(group.pricePerLesson) : '',
    );
    form.setValue(
      'currency',
      (group?.currency ?? session.workspace.defaultCurrency) as PackageFormValues['currency'],
    );
  };

  useEffect(() => {
    if (!open || form.getValues('price')) return;
    if (lockedStudentId && students.data) pickStudent(lockedStudentId);
    if (lockedGroupId && groups.data) pickGroup(lockedGroupId);
    // Prefill a locked target once its list query arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lockedStudentId, lockedGroupId, students.data, groups.data]);

  const submitDto = async (dto: CreatePackageDto, force = false) => {
    try {
      await createPackage.mutateAsync({ dto, force });
      toast.success(tPackages('toasts.created'));
      setConflicts(null);
      setPendingDto(null);
      onOpenChange(false);
    } catch (error) {
      const details = conflictDetails(error as GatewayError);
      if (details) {
        setPendingDto(dto);
        setConflicts(details);
      } else {
        setPendingDto(null);
        setConflicts(null);
      }
    }
  };

  const onSubmit = form.handleSubmit(
    (formValues) => submitDto(buildCreatePackageDto(formValues)),
    scrollToFirstError,
  );

  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: values.timezone,
    }).format(new Date(iso));

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setConflicts(null);
      setPendingDto(null);
    }
    onOpenChange(next);
  };

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t('createTitle')}
      description={t('createSubtitle')}
      width="lg"
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
        {createPackage.error && !conflicts ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{tErrors(errorMessageKey(createPackage.error))}</AlertDescription>
          </Alert>
        ) : null}

        <FormSection
          icon={UserRoundIcon}
          title={t('targetKind')}
          description={t('targetDescription')}
        >
          {!targetLocked ? (
            <>
              <Controller
                control={form.control}
                name="targetKind"
                render={({ field }) => (
                  <Tabs
                    value={field.value}
                    onValueChange={(next) => {
                      field.onChange(next);
                      form.setValue('targetId', '');
                      form.setValue('price', '');
                      form.setValue(
                        'currency',
                        session.workspace.defaultCurrency as PackageFormValues['currency'],
                      );
                      if (next === 'group' && form.getValues('paymentStatus') === 'PARTIAL') {
                        form.setValue('paymentStatus', 'PENDING');
                        form.setValue('paidAmount', '');
                        form.setValue('paidAt', toLocalDateInput(new Date()));
                      }
                    }}
                  >
                    <TabsList variant="segmented" className="w-full">
                      <TabsTrigger value="student">{t('targetStudent')}</TabsTrigger>
                      <TabsTrigger value="group">{t('targetGroup')}</TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              />
              <Controller
                control={form.control}
                name="targetId"
                render={({ field }) =>
                  isGroup ? (
                    <Field data-invalid={Boolean(errors.targetId) || undefined}>
                      <FieldLabel htmlFor="package-group">{t('group')}</FieldLabel>
                      <Select value={field.value} onValueChange={pickGroup}>
                        <SelectTrigger id="package-group" className="w-full">
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
                    <Field data-invalid={Boolean(errors.targetId) || undefined}>
                      <FieldLabel htmlFor="package-student">{t('student')}</FieldLabel>
                      <EntityPicker
                        id="package-student"
                        value={field.value}
                        options={studentOptions}
                        onChange={pickStudent}
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
          <Field data-invalid={Boolean(errors.name) || undefined}>
            <FieldLabel htmlFor="package-name">{t('name')}</FieldLabel>
            <Input
              id="package-name"
              placeholder={t('namePlaceholder')}
              {...form.register('name')}
            />
            <FieldError errors={[errors.name]} />
          </Field>
        </FormSection>

        <FormSection
          icon={Settings2Icon}
          title={t('settingsTitle')}
          description={t('settingsDescription')}
          tone="success"
        >
          <Controller
            control={form.control}
            name="sizingMode"
            render={({ field }) => (
              <Tabs value={field.value} onValueChange={field.onChange}>
                <TabsList variant="segmented" className="w-full">
                  <TabsTrigger value="FIXED_COUNT">{t('fixedCount')}</TabsTrigger>
                  <TabsTrigger value="BY_PERIOD">{t('byPeriod')}</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          />

          {values.sizingMode === 'FIXED_COUNT' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.lessonsTotal) || undefined}>
                <FieldLabel htmlFor="package-lessons">{t('lessonsTotal')}</FieldLabel>
                <Controller
                  control={form.control}
                  name="lessonsTotal"
                  render={({ field }) => (
                    <PresetNumberInput
                      id="package-lessons"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      presets={LESSON_PRESETS}
                      formatPreset={(count) => t('lessonsPreset', { count })}
                      hint={t('lessonsHint')}
                      min={1}
                      max={500}
                      invalid={Boolean(errors.lessonsTotal)}
                    />
                  )}
                />
                <FieldError errors={[errors.lessonsTotal]} />
              </Field>
              <Field data-invalid={Boolean(errors.validityDays) || undefined}>
                <FieldLabel htmlFor="package-validity">{t('validityDays')}</FieldLabel>
                <Controller
                  control={form.control}
                  name="validityDays"
                  render={({ field }) => (
                    <PresetNumberInput
                      id="package-validity"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      presets={VALIDITY_PRESETS}
                      formatPreset={(days) => t('daysPreset', { days })}
                      hint={t('validityHint')}
                      min={1}
                      max={3650}
                      invalid={Boolean(errors.validityDays)}
                    />
                  )}
                />
                <FieldError errors={[errors.validityDays]} />
              </Field>
            </div>
          ) : (
            <ScheduleFields form={form} values={values} errors={errors} summary={summary} />
          )}

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <Field data-invalid={Boolean(errors.price) || undefined}>
              <FieldLabel htmlFor="package-price">{t('pricePerLesson')}</FieldLabel>
              <MoneyInput id="package-price" {...form.register('price')} />
              <FieldError errors={[errors.price]} />
            </Field>
            <Controller
              control={form.control}
              name="currency"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="package-currency">{t('currency')}</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="package-currency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {SUPPORTED_CURRENCIES.map((code) => (
                          <SelectItem key={code} value={code}>
                            <CurrencyOption code={code} />
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          </div>
          {summary.totalMinor != null ? (
            <Alert variant="secondary">
              <BanknoteIcon />
              <AlertTitle>{t('totalPrice')}</AlertTitle>
              <AlertDescription className="font-heading text-base font-semibold text-foreground">
                {formatMoneyDisplay(summary.totalMinor, values.currency, locale)}
              </AlertDescription>
            </Alert>
          ) : null}
          <Field data-invalid={Boolean(errors.notes) || undefined}>
            <FieldLabel htmlFor="package-notes">{t('notes')}</FieldLabel>
            <Textarea id="package-notes" {...form.register('notes')} />
            <FieldError errors={[errors.notes]} />
          </Field>
        </FormSection>

        {values.sizingMode === 'FIXED_COUNT' ? (
          <FormSection
            icon={CalendarClockIcon}
            title={t('scheduleEnabled')}
            description={t('scheduleHint')}
            tone="warning"
            action={
              <Controller
                control={form.control}
                name="scheduleEnabled"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            }
          >
            {hasSchedule ? (
              <ScheduleFields form={form} values={values} errors={errors} summary={summary} />
            ) : (
              <Alert variant="secondary">
                <AlertDescription>{t('scheduleDisabledHint')}</AlertDescription>
              </Alert>
            )}
          </FormSection>
        ) : null}

        <FormSection
          icon={BanknoteIcon}
          title={t('paymentTitle')}
          description={t('paymentDescription')}
          tone="primary"
        >
          <Controller
            control={form.control}
            name="paymentStatus"
            render={({ field }) => (
              <Tabs value={field.value} onValueChange={field.onChange}>
                <TabsList variant="segmented" className="w-full">
                  <TabsTrigger value="PENDING">{t('paymentPending')}</TabsTrigger>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex flex-1">
                        <TabsTrigger value="PARTIAL" disabled={isGroup} className="w-full">
                          {t('paymentPartial')}
                        </TabsTrigger>
                      </span>
                    </TooltipTrigger>
                    {isGroup ? <TooltipContent>{t('groupPartialHint')}</TooltipContent> : null}
                  </Tooltip>
                  <TabsTrigger value="PAID">{t('paymentPaid')}</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          />
          {values.paymentStatus !== 'PENDING' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {values.paymentStatus === 'PARTIAL' ? (
                <Field data-invalid={Boolean(errors.paidAmount) || undefined}>
                  <FieldLabel htmlFor="package-paid-amount">{t('paidAmount')}</FieldLabel>
                  <MoneyInput id="package-paid-amount" {...form.register('paidAmount')} />
                  <FieldError errors={[errors.paidAmount]} />
                </Field>
              ) : (
                <Alert variant="secondary" className="self-end">
                  <AlertDescription>{t('fullPaymentHint')}</AlertDescription>
                </Alert>
              )}
              <Controller
                control={form.control}
                name="paidAt"
                render={({ field }) => (
                  <Field data-invalid={Boolean(errors.paidAt) || undefined}>
                    <FieldLabel htmlFor="package-paid-at">{t('paidAt')}</FieldLabel>
                    <DatePicker
                      id="package-paid-at"
                      value={field.value}
                      onChange={field.onChange}
                      toDate={new Date()}
                      invalid={Boolean(errors.paidAt)}
                    />
                    <FieldError errors={[errors.paidAt]} />
                  </Field>
                )}
              />
            </div>
          ) : null}
        </FormSection>

        <FormActions>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={createPackage.isPending}>
            {createPackage.isPending ? <Spinner data-icon="inline-start" /> : null}
            {t('submit')}
          </Button>
        </FormActions>
      </form>

      <AlertDialog
        open={Boolean(conflicts)}
        onOpenChange={(next) => {
          if (!next) {
            setConflicts(null);
            setPendingDto(null);
          }
        }}
      >
        <AlertDialogContent className="max-h-[80vh] sm:max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('conflictTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('conflictDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {conflicts?.conflicts.map((conflict, index) => (
              <Alert
                key={`${conflict.candidate.startsAtUtc}-${index}`}
                className="border-warning/40 bg-warning/10"
              >
                <CircleAlertIcon />
                <AlertTitle>{formatDateTime(conflict.candidate.startsAtUtc)}</AlertTitle>
                <AlertDescription>
                  {conflict.source === 'NEW_SLOT'
                    ? t('newSlotConflict')
                    : t('existingConflict', {
                        target:
                          conflict.existing.student?.fullName ??
                          conflict.existing.group?.name ??
                          t('unknownTarget'),
                        time: formatDateTime(conflict.existing.startsAtUtc),
                      })}
                </AlertDescription>
              </Alert>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('backToSchedule')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (pendingDto) void submitDto(pendingDto, true);
              }}
            >
              {t('forceCreate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EntityFormDialog>
  );
}

function ScheduleFields({
  form,
  values,
  errors,
  summary,
}: {
  form: ReturnType<typeof useForm<PackageFormValues>>;
  values: PackageFormValues;
  errors: ReturnType<typeof useForm<PackageFormValues>>['formState']['errors'];
  summary: ReturnType<typeof packageScheduleSummary>;
}) {
  const t = useTranslations('packages.form');
  const locale = useLocale();
  const today = toLocalDateInput(new Date());
  const dayNames = useMemo(
    () =>
      Array.from({ length: 7 }, (_, day) =>
        new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(
          new Date(Date.UTC(2024, 0, 7 + day)),
        ),
      ),
    [locale],
  );
  const formatLesson = (date: Date | null) =>
    date
      ? new Intl.DateTimeFormat(locale, {
          dateStyle: 'full',
          timeStyle: 'short',
          timeZone: values.timezone,
        }).format(date)
      : t('noLessonDate');

  return (
    <div className="flex flex-col gap-5">
      <Controller
        control={form.control}
        name="weekdays"
        render={({ field }) => (
          <Field data-invalid={Boolean(errors.weekdays) || undefined}>
            <FieldLabel>{t('weekdays')}</FieldLabel>
            <WeekdayPicker
              appearance="cards"
              value={field.value}
              onChange={(days) => {
                field.onChange(days);
                const times = { ...form.getValues('slotTimes') };
                days.forEach((day) => {
                  times[String(day)] ??= '10:00';
                });
                form.setValue('slotTimes', times);
              }}
              invalid={Boolean(errors.weekdays)}
            />
            <FieldError errors={[errors.weekdays as { message?: string } | undefined]} />
          </Field>
        )}
      />

      {values.weekdays.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[...values.weekdays]
            .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
            .map((day) => {
              const error = errors.slotTimes?.[day];
              return (
                <Controller
                  key={day}
                  control={form.control}
                  name={`slotTimes.${day}`}
                  render={({ field }) => (
                    <Field data-invalid={Boolean(error) || undefined}>
                      <FieldLabel>{dayNames[day]}</FieldLabel>
                      <TimePicker
                        value={field.value ?? '10:00'}
                        onChange={field.onChange}
                        invalid={Boolean(error)}
                      />
                      <FieldError errors={[error]} />
                    </Field>
                  )}
                />
              );
            })}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={form.control}
          name="durationMin"
          render={({ field }) => (
            <Field data-invalid={Boolean(errors.durationMin) || undefined}>
              <FieldLabel>{t('duration')}</FieldLabel>
              <DurationInput
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                invalid={Boolean(errors.durationMin)}
              />
              <FieldError errors={[errors.durationMin]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <Field data-invalid={Boolean(errors.timezone) || undefined}>
              <FieldLabel>{t('timezone')}</FieldLabel>
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
      </div>

      <Alert className="border-warning/40 bg-warning/10">
        <CalendarClockIcon />
        <AlertTitle>{t('startTitle')}</AlertTitle>
        <AlertDescription className="space-y-3">
          <Controller
            control={form.control}
            name="startMode"
            render={({ field }) => (
              <Tabs value={field.value} onValueChange={field.onChange}>
                <TabsList variant="segmented" className="w-full bg-background/70">
                  <TabsTrigger value="TODAY">{t('startToday')}</TabsTrigger>
                  <TabsTrigger value="MANUAL">{t('startManual')}</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          />
          {values.startMode === 'MANUAL' ? (
            <Controller
              control={form.control}
              name="manualStartDate"
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} fromDate={new Date()} />
              )}
            />
          ) : null}
          <p className="font-medium text-foreground">
            {t('firstLesson', { date: formatLesson(summary.firstLesson) })}
          </p>
        </AlertDescription>
      </Alert>

      {values.sizingMode === 'BY_PERIOD' ? (
        <>
          <Controller
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <Field data-invalid={Boolean(errors.endDate) || undefined}>
                <FieldLabel>{t('endDateInclusive')}</FieldLabel>
                <DatePicker
                  value={field.value}
                  onChange={field.onChange}
                  fromDate={new Date(`${today}T00:00:00`)}
                  invalid={Boolean(errors.endDate)}
                />
                <FieldError errors={[errors.endDate]} />
              </Field>
            )}
          />
          <Alert variant="secondary">
            <AlertDescription>
              {t('periodSummary', {
                count: summary.lessonsCount ?? 0,
                date: formatLesson(summary.lastLesson),
              })}
            </AlertDescription>
          </Alert>
        </>
      ) : null}
    </div>
  );
}
