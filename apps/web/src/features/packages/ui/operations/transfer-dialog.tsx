'use client';

import { useEffect } from 'react';
import { ArrowRightIcon, BanknoteIcon, LayersIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { EntityPicker } from '@/components/shared/entity-picker';
import { FieldFrame, TextField } from '@/components/shared/text-field';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useStudentDirectionsQuery, useTransferPackageMutation } from '../../api';
import { directionName, transferTargets } from '../../model/names';
import {
  transferDto,
  transferPreview,
  transferSchema,
  type TransferValues,
} from '../../model/operations';
import { CreditDots } from '../credit-dots';
import { FooterNote, useErrorToast, usePackageForm } from '../form-parts';
import { notchMask } from '../notch';
import { usePackageFormat } from '../use-package-format';
import type { OperationProps } from './operation-props';

/**
 * «Перенести заняття» (board 03, state 04): how many of the credits left,
 * where to — another direction of the student in the same currency (the
 * others listed but disabled) — and «Перерахунок за ціною»: the credits'
 * value here, the lessons it buys there rounded down, and the remainder
 * (L-85, decision 8). The package closes; the target gets a new one.
 */
export function TransferDialog({ pkg, title, onClose, onDone }: OperationProps) {
  const t = useTranslations('packages.dialogs.transfer');
  const tDialogs = useTranslations('packages.dialogs');
  const format = usePackageFormat();
  const mobile = useIsMobile();
  const left = Math.max(pkg.remainingCredits, 0);
  const directions = useStudentDirectionsQuery(pkg.studentId);
  const targets = transferTargets(directions.data?.directions ?? [], pkg);
  const firstSame = targets.find((target) => target.sameCurrency)?.direction.enrollmentId ?? '';
  const form = usePackageForm<TransferValues>(transferSchema(left), {
    credits: String(left),
    toEnrollmentId: firstSame,
  });
  const [creditsText, toId] = useWatch({
    control: form.control,
    name: ['credits', 'toEnrollmentId'],
  });
  // The directions arrive after the form: pick the first same-currency one then.
  useEffect(() => {
    if (firstSame && !form.getValues('toEnrollmentId')) form.setValue('toEnrollmentId', firstSame);
  }, [firstSame, form]);
  const target = targets.find((row) => row.direction.enrollmentId === toId)?.direction ?? null;
  const credits = Number(creditsText);
  const preview =
    target && Number.isInteger(credits) && credits >= 1 && credits <= left
      ? transferPreview(credits, pkg.pricePerLessonMinorSnapshot, target.rateMinor)
      : null;
  const transfer = useTransferPackageMutation();
  const showError = useErrorToast();
  const currency = pkg.currency;
  const firstName = pkg.student.fullName.split(/\s+/)[0] ?? pkg.student.fullName;

  const submit = form.handleSubmit((values) =>
    transfer.mutate(
      { packageId: pkg.id, dto: transferDto(values) },
      {
        onSuccess: (result) => {
          toast.success(
            t('done', {
              count: result.target.lessonsTotal,
              name: target ? directionName(target) : '',
            }),
          );
          onDone();
        },
        onError: showError,
      },
    ),
  );

  return (
    <AdaptiveDialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      closeLabel={tDialogs('close')}
      sheetLayout="compact"
      size="lg"
      icon={<ArrowRightIcon />}
      iconClassName="bg-tile-indigo text-tile-indigo-foreground"
      title={t('title')}
      description={
        mobile ? title : tDialogs('subtitle', { name: title, student: pkg.student.fullName })
      }
      tertiary={
        target && !mobile ? (
          <FooterNote>{t('footer', { name: directionName(target) })}</FooterNote>
        ) : undefined
      }
      secondary={
        <Button type="button" variant="outline" onClick={onClose}>
          {tDialogs('cancel')}
        </Button>
      }
      primary={
        <Button
          type="button"
          disabled={transfer.isPending || (preview !== null && preview.lessons < 1)}
          onClick={() => void submit()}
        >
          {transfer.isPending ? <Spinner data-icon="inline-start" /> : null}
          {mobile
            ? t('confirmShort', { count: credits || 0 })
            : t('confirm', { count: credits || 0 })}
        </Button>
      }
    >
      <TextField
        label={t('credits')}
        inputMode="numeric"
        autoComplete="off"
        suffix={t('creditsOf', { count: left })}
        error={form.formState.errors.credits?.message}
        {...form.register('credits')}
      />
      <Controller
        control={form.control}
        name="toEnrollmentId"
        render={({ field, fieldState }) => (
          <FieldFrame
            label={t('to')}
            hint={t('toHint', { name: firstName })}
            error={fieldState.error?.message}
          >
            {(a11y) => (
              <EntityPicker
                id={a11y.id}
                aria-describedby={a11y.describedBy}
                invalid={Boolean(a11y.invalid)}
                appearance="field"
                value={field.value || undefined}
                onChange={(value) => field.onChange(value ?? '')}
                isLoading={directions.isPending}
                placeholder={t('toPlaceholder')}
                searchPlaceholder={t('toSearch')}
                emptyLabel={t('toEmpty')}
                options={targets.map(({ direction, sameCurrency }) => ({
                  value: direction.enrollmentId,
                  label: directionName(direction),
                  avatarKey: direction.group ? undefined : direction.teacher.avatarKey,
                  media: direction.group ? (
                    <span className="flex size-6 items-center justify-center rounded-control bg-tile-indigo text-tile-indigo-foreground [&_svg]:size-3.5">
                      <LayersIcon />
                    </span>
                  ) : undefined,
                  description: t('toOption', {
                    teacher: direction.teacher.name,
                    price: format.money(direction.rateMinor, direction.currency),
                  }),
                  trail: sameCurrency ? undefined : (
                    <span className="text-xs text-muted-foreground">{t('otherCurrency')}</span>
                  ),
                  disabled: !sameCurrency,
                }))}
              />
            )}
          </FieldFrame>
        )}
      />
      {target && preview ? (
        <section
          aria-label={t('recalc')}
          className="flex flex-col gap-3 rounded-block bg-background p-4"
        >
          <div className="flex items-center justify-between gap-3 px-1">
            <span className="text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
              {t('recalc')}
            </span>
            <span className="text-[13px] text-muted-foreground tabular-nums">
              {`${format.money(preview.valueMinor, currency)} → ${format.money(preview.targetValueMinor, currency)}`}
            </span>
          </div>
          <div className="relative grid grid-cols-2 gap-3">
            <MiniTicket
              tone="source"
              name={directionName(pkg)}
              price={format.money(pkg.pricePerLessonMinorSnapshot, currency)}
              lessons={credits}
              value={format.money(preview.valueMinor, currency)}
            />
            <MiniTicket
              tone="target"
              name={directionName(target)}
              price={format.money(target.rateMinor, currency)}
              lessons={preview.lessons}
              value={format.money(preview.targetValueMinor, currency)}
            />
            <span
              aria-hidden="true"
              className="absolute top-[82px] left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-pill bg-ink text-ink-foreground ring-4 ring-background [&_svg]:size-4"
            >
              <ArrowRightIcon />
            </span>
          </div>
          {preview.remainderMinor > 0 ? (
            <div className="flex items-center gap-3.5 rounded-row bg-card px-4 py-3.5">
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-item bg-tint-warning text-tint-warning-foreground [&_svg]:size-5"
              >
                <BanknoteIcon />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold">
                  {t('remainder', { amount: format.money(preview.remainderMinor, currency) })}
                </span>
                <span className="text-[13px] leading-[18px] text-muted-foreground">
                  {t('remainderText')}
                </span>
              </span>
            </div>
          ) : null}
          {preview.lessons < 1 ? (
            <p className="px-1 text-[13px] text-destructive">{t('tooLittle')}</p>
          ) : null}
        </section>
      ) : null}
    </AdaptiveDialog>
  );
}

/** One side of the recalculation: the direction and its price on a tinted top, the lessons and their value. */
function MiniTicket({
  tone,
  name,
  price,
  lessons,
  value,
}: {
  tone: 'source' | 'target';
  name: string;
  price: string;
  lessons: number;
  value: string;
}) {
  const t = useTranslations('packages.dialogs.transfer');
  const source = tone === 'source';
  return (
    <div
      style={notchMask({ y: 64 }, 9)}
      className="flex min-w-0 flex-col overflow-hidden rounded-row bg-card"
    >
      <div
        className={cn(
          'flex h-16 flex-col justify-center gap-0.5 px-4',
          source ? 'bg-tint-indigo text-brand' : 'bg-tint-success text-tint-success-foreground',
        )}
      >
        <span className="truncate text-xs font-bold tracking-[0.06em] uppercase">{name}</span>
        <span className="truncate text-[13px]">{t('perLesson', { price })}</span>
      </div>
      <div aria-hidden="true" className="mx-3 border-t-2 border-dashed border-border" />
      <div className="flex flex-col gap-2 px-4 pt-3 pb-4">
        <span className="flex items-baseline gap-2">
          <span className="text-[26px] leading-none font-bold tabular-nums">{lessons}</span>
          <span className="text-sm font-semibold text-muted-foreground">
            {t('lessonsWord', { count: lessons })}
          </span>
        </span>
        <CreditDots left={lessons} total={lessons} tone={source ? 'brand' : 'success'} size="sm" />
        <span className="text-[13px] text-muted-foreground tabular-nums">{`= ${value}`}</span>
      </div>
    </div>
  );
}
