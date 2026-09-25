'use client';

import { HistoryIcon, MinusIcon, PlusIcon, SlidersHorizontalIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { IconButton } from '@/components/shared/icon-button';
import { ImpactList } from '@/components/shared/impact-list';
import { TextField } from '@/components/shared/text-field';
import { cn } from '@/lib/utils';
import { useAdjustPackageMutation } from '../../api';
import {
  adjustBounds,
  adjustDots,
  adjustDto,
  adjustSchema,
  type AdjustValues,
} from '../../model/operations';
import { CreditDots } from '../credit-dots';
import { useErrorToast, usePackageForm } from '../form-parts';
import type { OperationProps } from './operation-props';

/**
 * «Коригування занять» (board 03, state 06): what the package will hold
 * («СТАНЕ 5 з 8 занять») with a stepper, the dots with the added credit in
 * green and a legend, why (required), and that history is not rewritten —
 * a «Коригування +1» entry is added. A minus draws no removed dot.
 */
export function AdjustDialog({ pkg, title, onClose, onDone }: OperationProps) {
  const t = useTranslations('packages.dialogs.adjust');
  const tDialogs = useTranslations('packages.dialogs');
  const left = Math.max(pkg.remainingCredits, 0);
  const bounds = adjustBounds(left);
  const form = usePackageForm<AdjustValues>(adjustSchema(left), { delta: 1, note: '' });
  const delta = useWatch({ control: form.control, name: 'delta' });
  const adjust = useAdjustPackageMutation();
  const showError = useErrorToast();
  const dots = adjustDots(pkg, delta);
  const signed = delta > 0 ? `+${delta}` : String(delta);

  const submit = form.handleSubmit((values) =>
    adjust.mutate(
      { packageId: pkg.id, dto: adjustDto(values) },
      {
        onSuccess: () => {
          toast.success(t('done', { delta: signed }));
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
      icon={<SlidersHorizontalIcon />}
      iconClassName="bg-tile-indigo text-tile-indigo-foreground"
      title={t('title')}
      description={t('subtitle', {
        name: title,
        student: pkg.student.fullName,
        left,
        total: pkg.lessonsTotal,
      })}
      secondary={
        <Button type="button" variant="outline" onClick={onClose}>
          {tDialogs('cancel')}
        </Button>
      }
      primary={
        <Button type="button" disabled={adjust.isPending} onClick={() => void submit()}>
          {adjust.isPending ? <Spinner data-icon="inline-start" /> : null}
          {t('confirm')}
        </Button>
      }
    >
      <section
        aria-label={t('becomes')}
        className="flex flex-col gap-4 rounded-block bg-background px-6 py-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
              {t('becomes')}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="text-4xl leading-none font-bold tabular-nums">{left + delta}</span>
              <span className="text-base font-semibold text-muted-foreground">
                {t('ofTotal', { count: pkg.lessonsTotal })}
              </span>
            </span>
          </div>
          <Controller
            control={form.control}
            name="delta"
            render={({ field }) => (
              <div
                role="group"
                aria-label={t('stepper')}
                className="flex items-center gap-1 rounded-pill bg-card p-1"
              >
                <IconButton
                  icon={<MinusIcon />}
                  label={t('minus')}
                  size={38}
                  tone="paper"
                  disabled={field.value <= bounds.min}
                  onClick={() => field.onChange(field.value - 1 === 0 ? -1 : field.value - 1)}
                />
                <output
                  aria-live="polite"
                  className={cn(
                    'min-w-12 text-center text-xl font-bold tabular-nums',
                    field.value > 0 ? 'text-tint-success-foreground' : 'text-destructive',
                  )}
                >
                  {field.value > 0 ? `+${field.value}` : field.value}
                </output>
                <IconButton
                  icon={<PlusIcon />}
                  label={t('plus')}
                  size={38}
                  tone="paper"
                  disabled={field.value >= bounds.max}
                  onClick={() => field.onChange(field.value + 1 === 0 ? 1 : field.value + 1)}
                />
              </div>
            )}
          />
        </div>
        <CreditDots
          left={dots.left}
          added={dots.added}
          total={dots.left + dots.added + dots.used}
          size="lg"
        />
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-pill bg-brand" />
            {t('legendLeft', { count: dots.left })}
          </li>
          {dots.added > 0 ? (
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-pill bg-success" />
              {t('legendAdded', { delta: signed })}
            </li>
          ) : null}
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-pill border border-dashed border-muted-foreground"
            />
            {t('legendUsed', { count: dots.used })}
          </li>
        </ul>
        {form.formState.errors.delta?.message ? (
          <p role="alert" className="text-[13px] font-medium text-destructive">
            {form.formState.errors.delta.message}
          </p>
        ) : null}
      </section>
      <TextField
        label={t('why')}
        placeholder={t('whyPlaceholder')}
        autoComplete="off"
        error={form.formState.errors.note?.message}
        {...form.register('note')}
      />
      <ImpactList
        items={[
          {
            id: 'history',
            icon: <HistoryIcon />,
            tone: 'neutral',
            title: t('impactTitle'),
            text: t('impactText', { delta: signed }),
          },
        ]}
      />
    </AdaptiveDialog>
  );
}
