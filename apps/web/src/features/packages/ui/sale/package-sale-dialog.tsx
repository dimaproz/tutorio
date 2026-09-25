'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CreatePackageDto, PackageResponse } from '@tutorio/validation';
import { useNow, useTranslations } from 'next-intl';
import { FormProvider, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { BandWindow, BandWindowLayout } from '@/components/shared/band-window';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useIsMobile } from '@/hooks/use-mobile';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { useSalePreviewQuery, useSellPackageMutation } from '../../api';
import { dayKey, isDayKey, startOfDay } from '../../model/dates';
import {
  linkedPrice,
  moneyText,
  parseCount,
  saleDto,
  saleFormDefaults,
  saleFormSchema,
  saleLessons,
  saleName,
  salePreviewDto,
  type SaleFormValues,
} from '../../model/sale';
import { FooterNote, useErrorToast, usePackageForm } from '../form-parts';
import { usePackageFormat } from '../use-package-format';
import { SaleBand } from './sale-band';
import { SaleKindField, SaleNameField, SalePriceFields, SaleSizeFields } from './sale-fields';
import { SalePreview } from './sale-ticket';
import { SoldDialog } from './sold-dialog';
import { useSaleData } from './use-sale-data';
import { directionName } from '../../model/names';

/**
 * «Новий пакет» (S07 board 01, decision 1): a dialog over the profile or
 * the «Пакети» page — the direction preselected, or picked in the band —
 * with the kind, the size, the linked price pair and the live ticket
 * preview (`POST /packages/preview`). Selling creates no schedule and no
 * payment (L-87); «Пакет продано» follows with the next actions.
 */
export function PackageSaleDialog({
  open,
  onOpenChange,
  studentId,
  enrollmentId,
  nowMs,
  onSold,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The student; omitted on the «Пакети» page, where it is picked. */
  studentId?: string;
  enrollmentId?: string;
  nowMs?: number;
  onSold?: (pkg: PackageResponse) => void;
}) {
  return open ? (
    <SaleFlow
      studentId={studentId ?? null}
      enrollmentId={enrollmentId ?? null}
      canChangeStudent={!studentId}
      nowMs={nowMs}
      onSold={onSold}
      onClose={() => onOpenChange(false)}
    />
  ) : null;
}

function SaleFlow({
  studentId: givenStudent,
  enrollmentId: givenEnrollment,
  canChangeStudent,
  nowMs,
  onSold,
  onClose,
}: {
  studentId: string | null;
  enrollmentId: string | null;
  canChangeStudent: boolean;
  nowMs?: number;
  onSold?: (pkg: PackageResponse) => void;
  onClose: () => void;
}) {
  const t = useTranslations('packages.sale');
  const mobile = useIsMobile();
  const format = usePackageFormat();
  const clock = useNow();
  const [now] = useState(() => (nowMs ? new Date(nowMs) : clock));
  const timeZone = useStudioTimeZone();
  const today = dayKey(now, timeZone);
  const [studentId, setStudentId] = useState(givenStudent);
  const [enrollmentId, setEnrollmentId] = useState(givenEnrollment);
  const [sold, setSold] = useState<PackageResponse | null>(null);
  const data = useSaleData(studentId, enrollmentId);
  const direction = data.direction;
  const form = usePackageForm<SaleFormValues>(
    saleFormSchema(today),
    saleFormDefaults(null, now, timeZone),
  );
  const values = useWatch({ control: form.control }) as SaleFormValues;

  // A direction's rate is the price until the tutor types one (decision 2).
  const rate = direction?.rateMinor ?? null;
  const directionKey = direction?.enrollmentId ?? null;
  useEffect(() => {
    if (rate === null || form.getFieldState('perLesson').isDirty) return;
    if (form.getValues('priceSource') !== 'perLesson') return;
    form.setValue('perLesson', rate > 0 ? moneyText(rate) : '');
  }, [directionKey, rate, form]);

  const previewDto = salePreviewDto(values, direction, studentId, today, timeZone);
  const previewKey = useDebouncedValue(previewDto ? JSON.stringify(previewDto) : null);
  const preview = useSalePreviewQuery(
    useMemo(() => (previewKey ? (JSON.parse(previewKey) as CreatePackageDto) : null), [previewKey]),
  );
  const shownPreview = previewDto ? preview.data : undefined;

  const lessons = saleLessons(
    values,
    {
      scheduleLessons: shownPreview?.scheduleLessons ?? null,
      previewLessons: shownPreview?.lessonsTotal ?? null,
    },
    timeZone,
  );
  const price = linkedPrice(values, lessons);
  // The name the package gets unless the tutor types one: what it is for and its size.
  const suggestedName = direction
    ? values.kind === 'FIXED_COUNT'
      ? t('name.count', { name: directionName(direction), count: lessons ?? 0 })
      : isDayKey(values.from) && isDayKey(values.to)
        ? t('name.period', {
            name: directionName(direction),
            range: format.shortRange(
              startOfDay(values.from, timeZone),
              startOfDay(values.to, timeZone),
            ),
          })
        : directionName(direction)
    : '';
  const sell = useSellPackageMutation();
  const showError = useErrorToast();

  const submit = form.handleSubmit((submitted) => {
    if (!direction || !studentId) return;
    sell.mutate(
      saleDto(submitted, direction, studentId, timeZone, saleName(submitted, suggestedName)),
      {
        onSuccess: (pkg) => {
          onSold?.(pkg);
          setSold(pkg);
        },
        onError: showError,
      },
    );
  });

  if (sold) {
    return (
      <SoldDialog
        pkg={sold}
        schedule={data.schedule}
        mobile={mobile}
        nowMs={now.getTime()}
        onClose={onClose}
      />
    );
  }

  const currency = direction?.currency ?? 'UAH';
  const count = shownPreview?.lessonsTotal ?? lessons ?? 0;
  const windowText =
    values.kind === 'FIXED_COUNT'
      ? values.until
        ? t('preview.until', { date: format.dayMonth(startOfDay(values.until, timeZone)) })
        : t('preview.noEnd')
      : isDayKey(values.from) && isDayKey(values.to)
        ? format.dayRange(startOfDay(values.from, timeZone), startOfDay(values.to, timeZone))
        : '';
  const notes: { icon: 'debt' | 'queue'; text: string }[] = [];
  if (shownPreview && shownPreview.debtLessons > 0) {
    notes.push({ icon: 'debt', text: t('preview.debt', { count: shownPreview.debtLessons }) });
  }
  if (shownPreview?.ahead) {
    notes.push({
      icon: 'queue',
      text: shownPreview.ahead.name
        ? t('preview.after', { name: shownPreview.ahead.name })
        : t('preview.afterUnnamed'),
    });
  }
  const perLessonMinor = shownPreview?.pricePerLessonMinor ?? price.perLessonMinor ?? 0;
  const totalMinor = shownPreview?.totalPriceMinor ?? price.totalMinor ?? 0;
  const summary =
    previewDto && count > 0
      ? [
          format.money(totalMinor, currency),
          t('lessons', { count }),
          values.kind === 'FIXED_COUNT'
            ? values.until
              ? t('preview.untilShort', {
                  date: format.shortDay(startOfDay(values.until, timeZone)),
                })
              : t('preview.noEnd')
            : windowText,
        ].join(' · ')
      : null;

  return (
    <FormProvider {...form}>
      <BandWindow
        open
        onOpenChange={(next) => (next ? undefined : onClose())}
        description={t('description')}
        mobile={mobile}
        size="lg"
      >
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <BandWindowLayout
            mobile={mobile}
            band={
              <SaleBand
                data={data}
                mobile={mobile}
                canChangeStudent={canChangeStudent}
                onPickStudent={(id) => {
                  setStudentId(id);
                  setEnrollmentId(null);
                }}
                onPickDirection={setEnrollmentId}
                onClose={onClose}
              />
            }
            footerNote={
              mobile ? (
                summary ? (
                  <span className="text-foreground">{summary}</span>
                ) : null
              ) : (
                <FooterNote>{t('footer')}</FooterNote>
              )
            }
            footer={
              <>
                <Button type="button" variant="outline" onClick={onClose}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={!direction || sell.isPending}>
                  {sell.isPending ? <Spinner data-icon="inline-start" /> : null}
                  {t('submit')}
                </Button>
              </>
            }
          >
            <div className="grid gap-7 md:grid-cols-[minmax(0,1fr)_300px]">
              <div className="flex min-w-0 flex-col gap-5.5">
                <SaleKindField />
                <SaleSizeFields
                  schedule={data.schedule}
                  scheduleLessons={shownPreview?.scheduleLessons ?? null}
                  format={format}
                />
                <SalePriceFields rate={direction} lessons={lessons} format={format} />
                <SaleNameField suggested={suggestedName} />
              </div>
              {mobile ? null : (
                <SalePreview
                  heading={t('preview.heading')}
                  ready={previewDto !== null && parseCount(String(count)) !== null && count > 0}
                  emptyText={t('preview.empty')}
                  label={t('preview.label')}
                  name={saleName(values, suggestedName)}
                  lessons={count}
                  lessonsWord={t('lessonsWord', { count })}
                  window={windowText}
                  rows={[
                    {
                      label: t('preview.perLesson'),
                      value: format.money(perLessonMinor, currency),
                    },
                    { label: t('preview.total'), value: format.money(totalMinor, currency) },
                  ]}
                  notes={notes}
                />
              )}
            </div>
          </BandWindowLayout>
        </form>
      </BandWindow>
    </FormProvider>
  );
}
