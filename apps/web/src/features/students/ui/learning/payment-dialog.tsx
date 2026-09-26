'use client';

import { useState } from 'react';
import {
  BanknoteIcon,
  CalendarCheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  PackageIcon,
  PiggyBankIcon,
  WalletIcon,
} from 'lucide-react';
import { useNow, useTranslations } from 'next-intl';
import { zonedWeekday } from '@/lib/datetime';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { Controller, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { ChoiceCardGroup } from '@/components/shared/choice-card';
import { DateField } from '@/components/shared/date-field';
import { ImpactList, type ImpactItem } from '@/components/shared/impact-list';
import { Segmented } from '@/components/shared/segmented';
import { FieldFrame, TextField } from '@/components/shared/text-field';
import { SlotChip } from '@/features/lessons';
import { useRecordStudentPaymentMutation } from '@/features/students/api';
import {
  currentPackage,
  directionName,
  type BillingDirection,
} from '@/features/students/model/learning';
import {
  PAYMENT_METHODS,
  paymentDto,
  paymentFormDefaults,
  paymentFormSchema,
  previewBalancePayment,
  previewPackagePayment,
  type PaymentFormValues,
} from '@/features/students/model/payment';
import { dateKey } from '@/features/students/model/pause';
import { useDateFnsLocale } from '@/lib/i18n/format';
import { parsePriceInput } from '@/lib/money';
import { FooterNote, useBillingErrorToast, useBillingForm } from './dialog-parts';
import { useLearningFormat } from './use-learning-format';

const MAX_CHIPS = 4;

/**
 * «Записати оплату» (board 02, states 01–04): what it pays for — the
 * package, which can be paid in part, or the lessons outside it —, the
 * amount in the direction's currency, the method (transfer first), the date
 * and a note, with what it does: the lessons it closes oldest first and the
 * advance (L-90), or what the package still needs (decision 5).
 */
export function PaymentDialog({
  open,
  onOpenChange,
  studentName,
  direction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  direction: BillingDirection;
}) {
  return open ? (
    <PaymentForm studentName={studentName} direction={direction} onOpenChange={onOpenChange} />
  ) : null;
}

function PaymentForm({
  studentName,
  direction,
  onOpenChange,
}: {
  studentName: string;
  direction: BillingDirection;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('students.payment');
  const tCurrencies = useTranslations('currencies');
  const format = useLearningFormat();
  const dateLocale = useDateFnsLocale();
  const clock = useNow();
  const [now] = useState(() => clock);
  const timeZone = useStudioTimeZone();
  const today = dateKey(now, timeZone);
  // One key per opening: a repeated click records the money once.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const record = useRecordStudentPaymentMutation();
  const showError = useBillingErrorToast();
  const pkg = currentPackage(direction);
  const packageOwed = pkg ? Math.max(pkg.totalPriceMinor - pkg.paidMinor, 0) : 0;
  const offersPackage = pkg !== null && packageOwed > 0;
  const form = useBillingForm<PaymentFormValues>(
    paymentFormSchema(offersPackage ? packageOwed : null),
    paymentFormDefaults(direction, offersPackage ? pkg : null, today),
  );
  const [target, amountText] = useWatch({ control: form.control, name: ['target', 'amount'] });
  const amount = parsePriceInput(amountText) ?? 0;
  const currency = direction.currency;
  const symbol = format.moneyParts(0, currency).symbol;
  const { debtMinor, unpaid } = direction.balance;
  const forPackage = target === 'package' && offersPackage;

  const close = () => onOpenChange(false);
  const submit = form.handleSubmit((values) =>
    record.mutate(
      { ...paymentDto(values, direction, pkg, now, today, timeZone), idempotencyKey },
      {
        onSuccess: () => {
          toast.success(t('done', { amount: format.money(amount, currency) }));
          close();
        },
        onError: showError,
      },
    ),
  );

  const impact: ImpactItem[] = [];
  if (amount > 0 && forPackage && pkg) {
    const after = previewPackagePayment(pkg, amount);
    impact.push(
      {
        id: 'package',
        icon: <PackageIcon />,
        tone: 'indigo',
        title: t('impact.packagePaid', {
          paid: format.money(after.paidAfterMinor, currency),
          total: format.money(pkg.totalPriceMinor, currency),
        }),
        text:
          after.status === 'PAID'
            ? t('impact.packageFull')
            : t('impact.packageLeft', { left: format.money(after.leftMinor, currency) }),
      },
      {
        id: 'credits',
        icon: <CircleCheckIcon />,
        tone: 'neutral',
        title: t('impact.creditsAsBefore'),
        text: t('impact.creditsAsBeforeText'),
      },
    );
  } else if (amount > 0) {
    const preview = previewBalancePayment(direction, amount);
    if (preview.closes.length > 0) {
      impact.push({
        id: 'closes',
        icon: <CircleCheckIcon />,
        tone: 'success',
        title: t('impact.closes', { count: preview.closes.length }),
        text: t('impact.closesText', {
          dates: format.dateList(preview.closes.map((lesson) => lesson.startsAt)),
        }),
      });
    }
    if (preview.partial) {
      impact.push({
        id: 'partial',
        icon: <CalendarCheckIcon />,
        tone: 'warning',
        title: t('impact.partial', { date: format.weekdayDay(preview.partial.startsAt) }),
        text: t('impact.partialText', {
          left: format.money(preview.partial.leftMinor, currency),
        }),
      });
    }
    if (debtMinor > 0) {
      impact.push({
        id: 'debt',
        icon: <WalletIcon />,
        tone: 'neutral',
        title: t('impact.debtAfter', { amount: format.money(preview.debtAfterMinor, currency) }),
      });
    }
    if (preview.toAdvanceMinor > 0) {
      const lessons =
        direction.rateMinor > 0
          ? Math.floor(
              (preview.toAdvanceMinor + direction.balance.advanceMinor) / direction.rateMinor,
            )
          : 0;
      impact.push({
        id: 'advance',
        icon: <PiggyBankIcon />,
        tone: 'success',
        title: t('impact.toAdvance', { amount: format.money(preview.toAdvanceMinor, currency) }),
        text: lessons > 0 ? t('impact.advanceLessons', { count: lessons }) : undefined,
      });
    }
  }

  const shownDates = unpaid.slice(0, MAX_CHIPS);
  return (
    <AdaptiveDialog
      open
      onOpenChange={(next) => (next ? undefined : close())}
      closeLabel={t('close')}
      size="lg"
      sheetLayout="compact"
      icon={<BanknoteIcon />}
      iconClassName="bg-tint-success text-tint-success-foreground"
      title={t('title')}
      description={t('subtitle', { student: studentName, direction: directionName(direction) })}
      tertiary={<FooterNote>{forPackage ? t('notePackage') : t('noteOldestFirst')}</FooterNote>}
      secondary={
        <Button type="button" variant="outline" onClick={close}>
          {t('cancel')}
        </Button>
      }
      primary={
        <Button type="button" disabled={record.isPending} onClick={() => void submit()}>
          {record.isPending ? <Spinner data-icon="inline-start" /> : null}
          {amount > 0
            ? t('confirmAmount', { amount: format.money(amount, currency) })
            : t('confirm')}
        </Button>
      }
    >
      {debtMinor > 0 && !forPackage ? (
        <section
          aria-label={t('debtLabel')}
          className="flex flex-wrap items-center justify-between gap-3 rounded-tile bg-tint-danger px-5 py-4"
        >
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-xs font-bold tracking-[0.06em] text-tint-danger-foreground uppercase [&_svg]:size-3.5">
              <CircleAlertIcon aria-hidden="true" />
              {t('debtLabel')}
            </span>
            <span className="tabular-nums text-[26px] leading-8 font-bold text-tint-danger-foreground">
              {format.money(debtMinor, currency)}
            </span>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className="text-[13px] text-tint-foreground">
              {t('unpaidLessons', { count: direction.balance.unpaidLessons })}
            </span>
            <span className="flex flex-wrap gap-1.5 sm:justify-end">
              {shownDates.map((lesson) => (
                <SlotChip
                  key={lesson.lessonId}
                  tone="paper"
                  weekday={zonedWeekday(lesson.startsAt, timeZone)}
                  time={format.shortDay(lesson.startsAt)}
                />
              ))}
              {unpaid.length > MAX_CHIPS ? (
                <span className="inline-flex h-8 items-center px-1 text-sm text-tint-foreground">
                  {t('moreLessons', { count: unpaid.length - MAX_CHIPS })}
                </span>
              ) : null}
            </span>
          </div>
        </section>
      ) : null}

      {offersPackage && pkg ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm leading-5 font-medium">{t('forWhat')}</span>
          <Controller
            control={form.control}
            name="target"
            render={({ field }) => (
              <ChoiceCardGroup
                label={t('forWhat')}
                value={field.value}
                onValueChange={field.onChange}
                options={[
                  {
                    value: 'package',
                    icon: <PackageIcon />,
                    title: t('forPackage', { name: pkg.name ?? t('packageUnnamed') }),
                    hint: t('forPackageHint', {
                      paid: format.money(pkg.paidMinor, currency),
                      total: format.money(pkg.totalPriceMinor, currency),
                      left: format.money(packageOwed, currency),
                    }),
                  },
                  {
                    value: 'lessons',
                    icon: <BanknoteIcon />,
                    title: t('forLessons'),
                    hint:
                      debtMinor > 0
                        ? t('forLessonsDebt', { amount: format.money(debtMinor, currency) })
                        : t('forLessonsNoDebt'),
                  },
                ]}
              />
            )}
          />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <TextField
          label={t('amount')}
          inputMode="decimal"
          autoComplete="off"
          suffix={symbol}
          hint={forPackage ? t('amountHintPackage') : undefined}
          error={form.formState.errors.amount?.message}
          {...form.register('amount')}
        />
        <TextField
          label={t('currency')}
          locked
          readOnly
          value={tCurrencies(currency)}
          hint={t('currencyHint')}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm leading-5 font-medium">{t('method')}</span>
        <Controller
          control={form.control}
          name="method"
          render={({ field }) => (
            <Segmented
              label={t('method')}
              variant="paper"
              className="w-fit"
              value={field.value}
              onValueChange={field.onChange}
              items={PAYMENT_METHODS.map((method) => ({
                value: method,
                label: t(`methods.${method}`),
              }))}
            />
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={form.control}
          name="paidAt"
          render={({ field, fieldState }) => (
            <FieldFrame label={t('paidAt')} error={fieldState.error?.message}>
              {(a11y) => (
                <DateField
                  id={a11y.id}
                  aria-describedby={a11y.describedBy}
                  invalid={Boolean(a11y.invalid)}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  formatValue={format.field}
                  placeholder={t('paidAt')}
                  locale={dateLocale}
                />
              )}
            </FieldFrame>
          )}
        />
        <TextField
          label={t('note')}
          placeholder={t('notePlaceholder')}
          autoComplete="off"
          {...form.register('note')}
        />
      </div>

      {impact.length > 0 ? <ImpactList items={impact} label={t('impactLabel')} /> : null}
    </AdaptiveDialog>
  );
}
