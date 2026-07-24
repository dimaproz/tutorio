'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type {
  CreateLessonSeriesDto,
  LessonSeriesResponse,
  UpdateLessonSeriesDto,
} from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  detectTimezone,
  TimezoneCombobox,
} from '@/components/app/timezone-combobox';
import { cn } from '@/lib/utils';
import { useEnrollmentsQuery } from '@/lib/api/enrollments';
import {
  useCreateSeriesMutation,
  useUpdateSeriesMutation,
} from '@/lib/api/scheduling';
import { formatPriceInput, parsePriceInput } from '@/lib/money';

// Short localized weekday labels indexed 0=Sun … 6=Sat.
function useWeekdayLabels(locale: string): string[] {
  return useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    // 2024-01-07 is a Sunday.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 7 + i))));
  }, [locale]);
}

export function SeriesFormDialog({
  open,
  onOpenChange,
  series,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  series?: LessonSeriesResponse;
}) {
  const t = useTranslations('scheduling.seriesForm');
  const locale = useLocale();
  const isEdit = Boolean(series);
  const enrollments = useEnrollmentsQuery({ page: 1 }, open && !isEdit);
  const createSeries = useCreateSeriesMutation();
  const updateSeries = useUpdateSeriesMutation(series?.id ?? '');
  const labels = useWeekdayLabels(locale);

  const [enrollmentId, setEnrollmentId] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>(series?.weekdays ?? [1]);
  const [localTime, setLocalTime] = useState(series?.localTime ?? '10:00');
  const [timezone, setTimezone] = useState(series?.timezone ?? detectTimezone());
  const [duration, setDuration] = useState(String(series?.durationMin ?? 60));
  const [price, setPrice] = useState(
    series ? formatPriceInput(series.priceMinor) : '',
  );
  const [startDate, setStartDate] = useState(
    (series?.startDate ?? new Date().toISOString()).slice(0, 10),
  );

  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
  }
  if (!open && wasOpen) {
    setWasOpen(false);
  }

  const toggleDay = (day: number) =>
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );

  const selected = enrollments.data?.items.find((item) => item.id === enrollmentId);

  const submit = async () => {
    const priceMinor = parsePriceInput(price);
    if (priceMinor === null || weekdays.length === 0) {
      return;
    }
    if (isEdit && series) {
      const dto: UpdateLessonSeriesDto = {
        weekdays,
        localTime,
        timezone,
        durationMin: Number(duration),
        priceMinor,
        startDate: new Date(startDate).toISOString(),
      };
      await updateSeries.mutateAsync(dto);
    } else {
      if (!selected) {
        return;
      }
      const dto: CreateLessonSeriesDto = {
        enrollmentId: selected.id,
        teacherId: selected.teacher.id,
        weekdays,
        localTime,
        timezone,
        durationMin: Number(duration),
        priceMinor,
        currency: selected.currency,
        startDate: new Date(startDate).toISOString(),
      };
      await createSeries.mutateAsync(dto);
    }
    onOpenChange(false);
  };

  const pending = createSeries.isPending || updateSeries.isPending;
  const canSubmit = weekdays.length > 0 && (isEdit || Boolean(selected));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('editTitle') : t('createTitle')}</DialogTitle>
          <DialogDescription>
            {isEdit ? t('editSubtitle') : t('createSubtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!isEdit ? (
            <Field>
              <FieldLabel>{t('enrollment')}</FieldLabel>
              <Select value={enrollmentId} onValueChange={setEnrollmentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enrollments.data?.items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.student.fullName}
                      {item.group ? ` · ${item.group.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <Field>
            <FieldLabel>{t('weekdays')}</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {labels.map((label, day) => (
                <Button
                  key={day}
                  type="button"
                  size="sm"
                  variant={weekdays.includes(day) ? 'default' : 'outline'}
                  className={cn('w-12', weekdays.includes(day) && 'font-semibold')}
                  onClick={() => toggleDay(day)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>{t('time')}</FieldLabel>
              <Input
                type="time"
                value={localTime}
                onChange={(event) => setLocalTime(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t('duration')}</FieldLabel>
              <Input
                type="number"
                min={5}
                max={720}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>{t('timezone')}</FieldLabel>
            <TimezoneCombobox
              id="series-timezone"
              value={timezone}
              onChange={setTimezone}
              placeholder={t('timezone')}
              searchPlaceholder={t('timezone')}
              emptyLabel={t('timezone')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>{t('price')}</FieldLabel>
              <Input value={price} onChange={(event) => setPrice(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel>{t('startDate')}</FieldLabel>
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button disabled={!canSubmit || pending} onClick={() => void submit()}>
            {t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
