'use client';

import { ArrowLeftRightIcon, CalendarDaysIcon, PackageIcon, RepeatIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import type { ScheduleResponse } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChoiceCardGroup } from '@/components/shared/choice-card';
import { Segmented } from '@/components/shared/segmented';
import { TextField } from '@/components/shared/text-field';
import {
  LESSONS_PER_WEEK,
  linkedPrice,
  moneyText,
  type SaleDirection,
  type SaleFormValues,
} from '../../model/sale';
import { DayField } from '../form-parts';
import type { PackageFormat } from '../use-package-format';

/** «Вид пакета»: three radio cards, a stacked list (board 01). */
export function SaleKindField() {
  const t = useTranslations('packages.sale.kind');
  const form = useFormContext<SaleFormValues>();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm leading-5 font-medium">{t('label')}</span>
      <Controller
        control={form.control}
        name="kind"
        render={({ field }) => (
          <ChoiceCardGroup
            label={t('label')}
            value={field.value}
            onValueChange={(kind) => {
              // A period from the schedule counts its own lessons; a count
              // package gets its 8 back.
              const lessons = form.getValues('lessons');
              if (kind === 'BY_PERIOD') form.setValue('lessons', '');
              else if (kind === 'FIXED_COUNT' && lessons.trim() === '')
                form.setValue('lessons', '8');
              field.onChange(kind);
            }}
            options={[
              {
                value: 'FIXED_COUNT',
                icon: <PackageIcon />,
                title: t('FIXED_COUNT'),
                hint: t('FIXED_COUNT_hint'),
              },
              {
                value: 'BY_PERIOD',
                icon: <CalendarDaysIcon />,
                title: t('BY_PERIOD'),
                hint: t('BY_PERIOD_hint'),
              },
              {
                value: 'BY_PERIOD_WEEKLY',
                icon: <RepeatIcon />,
                title: t('BY_PERIOD_WEEKLY'),
                hint: t('BY_PERIOD_WEEKLY_hint'),
              },
            ]}
          />
        )}
      />
    </div>
  );
}

/**
 * The size of the package by kind: the count and an optional «Діє до»; a
 * window with the credits from the schedule (editable); or a window with
 * lessons a week.
 */
export function SaleSizeFields({
  schedule,
  scheduleLessons,
  format,
}: {
  schedule: ScheduleResponse | null;
  /** What the schedule has in the window, from the preview. */
  scheduleLessons: number | null;
  format: PackageFormat;
}) {
  const t = useTranslations('packages.sale.size');
  const form = useFormContext<SaleFormValues>();
  const [kind, until, lessons] = useWatch({
    control: form.control,
    name: ['kind', 'until', 'lessons'],
  });
  const errors = form.formState.errors;

  if (kind === 'FIXED_COUNT') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('count')}
          inputMode="numeric"
          autoComplete="off"
          suffix={t('lessonsSuffix')}
          error={errors.lessons?.message}
          {...form.register('lessons')}
        />
        <DayField
          control={form.control}
          name="until"
          label={t('until')}
          hint={t('untilHint')}
          format={format}
          labelAction={
            until ? (
              <Button
                type="button"
                variant="link"
                size="xs"
                className="h-auto p-0"
                onClick={() =>
                  form.setValue('until', '', { shouldValidate: form.formState.isSubmitted })
                }
              >
                {t('noEnd')}
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  const window = (
    <div className="grid gap-4 sm:grid-cols-2">
      <DayField control={form.control} name="from" label={t('from')} format={format} />
      <DayField control={form.control} name="to" label={t('to')} format={format} />
    </div>
  );

  if (kind === 'BY_PERIOD') {
    const fromSchedule = lessons.trim() === '';
    return (
      <>
        {window}
        <Controller
          control={form.control}
          name="lessons"
          render={({ field, fieldState }) => (
            <TextField
              className="sm:max-w-[calc(50%-0.5rem)]"
              label={t('periodCount')}
              labelAction={
                fromSchedule && scheduleLessons !== null ? (
                  <Badge variant="indigo" size="sm">
                    {t('fromSchedule')}
                  </Badge>
                ) : undefined
              }
              inputMode="numeric"
              autoComplete="off"
              suffix={t('lessonsSuffix')}
              hint={
                schedule
                  ? t('periodCountHint', { days: format.scheduleWeekdays(schedule) })
                  : t('periodCountNoSchedule')
              }
              error={fieldState.error?.message}
              value={
                fromSchedule
                  ? scheduleLessons !== null
                    ? String(scheduleLessons)
                    : ''
                  : field.value
              }
              onChange={(event) => field.onChange(event.currentTarget.value)}
              onBlur={field.onBlur}
              name={field.name}
            />
          )}
        />
      </>
    );
  }

  return (
    <>
      {window}
      <div className="flex flex-col gap-2">
        <span className="text-sm leading-5 font-medium">{t('perWeek')}</span>
        <Controller
          control={form.control}
          name="perWeek"
          render={({ field }) => (
            <Segmented
              label={t('perWeek')}
              className="w-fit"
              value={field.value}
              onValueChange={field.onChange}
              items={LESSONS_PER_WEEK.map((count) => ({ value: count, label: count }))}
            />
          )}
        />
        <span className="text-[13px] leading-[18px] text-muted-foreground">{t('perWeekHint')}</span>
      </div>
    </>
  );
}

/**
 * «Ціна»: «За заняття» ⇄ «За пакет» (decision 2) — the one typed last wins
 * and the other follows from the package's lessons. The hints say the rate
 * is the direction's and how the total is made.
 */
export function SalePriceFields({
  direction,
  lessons,
  format,
}: {
  direction: SaleDirection | null;
  /** The package's lessons, for the derived field. */
  lessons: number | null;
  format: PackageFormat;
}) {
  const t = useTranslations('packages.sale.price');
  const form = useFormContext<SaleFormValues>();
  const [perLesson, total, priceSource] = useWatch({
    control: form.control,
    name: ['perLesson', 'total', 'priceSource'],
  });
  const derived = linkedPrice({ perLesson, total, priceSource }, lessons);
  const currency = direction?.currency ?? 'UAH';
  const symbol = format.symbol(currency);
  const errors = form.formState.errors;
  const shown = (field: 'perLesson' | 'total') => {
    if (priceSource === field) return field === 'perLesson' ? perLesson : total;
    const minor = field === 'perLesson' ? derived.perLessonMinor : derived.totalMinor;
    return minor === null ? '' : moneyText(minor);
  };
  const type = (field: 'perLesson' | 'total', text: string) => {
    form.setValue(field, text, { shouldDirty: true });
    form.setValue('priceSource', field);
    if (form.formState.isSubmitted) void form.trigger(field);
  };
  const rateHint =
    direction && derived.perLessonMinor === direction.rateMinor ? t('rateHint') : undefined;
  const totalHint =
    lessons && derived.perLessonMinor !== null
      ? t('totalHint', { count: lessons, price: format.money(derived.perLessonMinor, currency) })
      : undefined;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[15px] leading-5 font-semibold">{t('label')}</span>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 sm:gap-3">
        <TextField
          label={t('perLesson')}
          inputMode="decimal"
          autoComplete="off"
          suffix={symbol}
          hint={rateHint}
          error={priceSource === 'perLesson' ? errors.perLesson?.message : undefined}
          value={shown('perLesson')}
          onChange={(event) => type('perLesson', event.currentTarget.value)}
        />
        <span aria-hidden="true" className="mt-11 flex text-muted-foreground [&_svg]:size-4">
          <ArrowLeftRightIcon />
        </span>
        <TextField
          label={t('total')}
          inputMode="decimal"
          autoComplete="off"
          suffix={symbol}
          hint={totalHint}
          error={priceSource === 'total' ? errors.total?.message : undefined}
          value={shown('total')}
          onChange={(event) => type('total', event.currentTarget.value)}
        />
      </div>
    </div>
  );
}

/**
 * «Назва пакета»: filled with the suggestion («English · 8 занять») until the
 * tutor types their own; left empty, the suggestion shows as the placeholder
 * and the package is sold with it.
 */
export function SaleNameField({ suggested }: { suggested: string }) {
  const t = useTranslations('packages.sale.name');
  const form = useFormContext<SaleFormValues>();
  const [name, edited] = useWatch({ control: form.control, name: ['name', 'nameEdited'] });
  return (
    <TextField
      label={t('label')}
      autoComplete="off"
      hint={t('hint')}
      placeholder={suggested}
      error={form.formState.errors.name?.message}
      value={edited ? name : suggested}
      onChange={(event) => {
        form.setValue('name', event.currentTarget.value, { shouldDirty: true });
        form.setValue('nameEdited', true);
      }}
    />
  );
}
