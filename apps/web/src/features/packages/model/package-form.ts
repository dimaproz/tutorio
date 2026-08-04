import { expandPackageSchedule, localDateStartUtc } from '@tutorio/domain';
import {
  currencyCodeSchema,
  lessonsTotalSchema,
  notesSchema,
  timezoneSchema,
  uuidSchema,
  weekdaysSchema,
  type CreatePackageDto,
} from '@tutorio/validation';
import { z } from 'zod';
import { localInputToIso, toLocalDateInput } from '@/lib/datetime';
import {
  checkedString,
  durationMinString,
  localTimeString,
  optionalText,
  priceString,
} from '@/lib/forms/helpers';
import { parsePriceInput } from '@/lib/money';

export type PackageTargetKind = 'student' | 'group';

const lessonsTotalString = checkedString(
  (value) => lessonsTotalSchema.safeParse(Number(value)).success,
  'lessonsTotalRange',
);
const validityDaysString = checkedString(
  (value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 3650,
  'validityDaysRange',
);

export const packageFormSchema = z
  .object({
    targetKind: z.enum(['student', 'group']),
    targetId: uuidSchema,
    name: optionalText(z.string().trim().min(1).max(120)),
    sizingMode: z.enum(['FIXED_COUNT', 'BY_PERIOD']),
    lessonsTotal: lessonsTotalString,
    validityDays: validityDaysString,
    endDate: z.string(),
    price: priceString({ required: true }),
    currency: currencyCodeSchema,
    notes: optionalText(notesSchema),
    scheduleEnabled: z.boolean(),
    weekdays: weekdaysSchema,
    slotTimes: z.record(localTimeString),
    timezone: timezoneSchema,
    durationMin: durationMinString,
    startMode: z.enum(['TODAY', 'MANUAL']),
    manualStartDate: z.string(),
    paymentStatus: z.enum(['PENDING', 'PARTIAL', 'PAID']),
    paidAmount: z.string(),
    paidAt: z.string(),
  })
  .superRefine((values, ctx) => {
    const needsSchedule = values.sizingMode === 'BY_PERIOD' || values.scheduleEnabled;
    if (values.sizingMode === 'BY_PERIOD' && values.endDate.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        params: { key: 'dateRequired' },
        message: 'End date is required',
      });
    }
    if (
      values.sizingMode === 'BY_PERIOD' &&
      values.endDate &&
      values.endDate < startDateOf(values)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'End date cannot be before the schedule start',
      });
    }
    if (
      values.sizingMode === 'BY_PERIOD' &&
      values.endDate &&
      values.weekdays.length > 0 &&
      packageScheduleSummary(values).lessonsCount === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'The selected period contains no lessons',
      });
    }
    if (needsSchedule && values.weekdays.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weekdays'],
        params: { key: 'weekdaysRequired' },
        message: 'Select at least one weekday',
      });
    }
    if (needsSchedule && values.startMode === 'MANUAL' && !values.manualStartDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['manualStartDate'],
        params: { key: 'dateRequired' },
        message: 'Start date is required',
      });
    }
    if (values.paymentStatus === 'PARTIAL') {
      const amount = parsePriceInput(values.paidAmount);
      const total = packageScheduleSummary(values).totalMinor;
      if (values.targetKind === 'group') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['paymentStatus'],
          message: 'Partial group payment is not supported',
        });
      }
      if (amount == null || amount <= 0 || total == null || amount >= total) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['paidAmount'],
          params: { key: 'partialPaymentRange' },
          message: 'Partial payment must be below the package total',
        });
      }
    }
    if (values.paymentStatus !== 'PENDING') {
      const total = packageScheduleSummary(values).totalMinor;
      if (total == null || total <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['paymentStatus'],
          message: 'A paid package must have a positive total',
        });
      }
      if (!values.paidAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['paidAt'],
          params: { key: 'dateRequired' },
          message: 'Payment date is required',
        });
      } else if (values.paidAt > toLocalDateInput(new Date())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['paidAt'],
          message: 'Payment date cannot be in the future',
        });
      }
    }
  });

export type PackageFormValues = z.infer<typeof packageFormSchema>;

export function emptyPackageForm(input: {
  currency: string;
  timezone: string;
  targetKind?: PackageTargetKind;
  targetId?: string;
}): PackageFormValues {
  return {
    targetKind: input.targetKind ?? 'student',
    targetId: input.targetId ?? '',
    name: '',
    sizingMode: 'FIXED_COUNT',
    lessonsTotal: '8',
    validityDays: '90',
    endDate: '',
    price: '',
    currency: input.currency as PackageFormValues['currency'],
    notes: '',
    scheduleEnabled: true,
    weekdays: [1],
    slotTimes: { '1': '10:00' },
    timezone: input.timezone,
    durationMin: '60',
    startMode: 'TODAY',
    manualStartDate: toLocalDateInput(new Date()),
    paymentStatus: 'PENDING',
    paidAmount: '',
    paidAt: toLocalDateInput(new Date()),
  };
}

function startDateOf(values: PackageFormValues): string {
  return values.startMode === 'TODAY' ? toLocalDateInput(new Date()) : values.manualStartDate;
}

function addDays(date: string, days: number): string {
  if (!date || !Number.isFinite(days)) return '';
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return toLocalDateInput(value);
}

function scheduleStarts(values: PackageFormValues): Date[] {
  const startDate = startDateOf(values);
  if (!startDate || values.weekdays.length === 0) return [];
  const untilDate =
    values.sizingMode === 'BY_PERIOD'
      ? addDays(values.endDate, 1)
      : addDays(startDate, Number(values.validityDays));
  if (!untilDate) return [];
  const start = scheduleStartInstant(values);
  return expandPackageSchedule(
    values.weekdays.map((weekday) => ({
      weekdays: [weekday],
      localTime: values.slotTimes[String(weekday)] ?? '10:00',
      timezone: values.timezone,
      startDate: start,
    })),
    { from: start, until: localDateStartUtc(untilDate, values.timezone) },
  );
}

function scheduleStartInstant(values: PackageFormValues): Date {
  return values.startMode === 'TODAY'
    ? new Date()
    : localDateStartUtc(values.manualStartDate, values.timezone);
}

export function packageScheduleSummary(values: PackageFormValues): {
  firstLesson: Date | null;
  lastLesson: Date | null;
  lessonsCount: number | null;
  totalMinor: number | null;
} {
  const priceMinor = parsePriceInput(values.price);
  if (values.sizingMode === 'FIXED_COUNT') {
    const starts = values.scheduleEnabled
      ? scheduleStarts(values).slice(0, Number(values.lessonsTotal))
      : [];
    const count = Number(values.lessonsTotal);
    return {
      firstLesson: starts[0] ?? null,
      lastLesson: starts.at(-1) ?? null,
      lessonsCount: Number.isFinite(count) ? count : null,
      totalMinor: priceMinor == null || !Number.isFinite(count) ? null : count * priceMinor,
    };
  }
  const starts = scheduleStarts(values);
  return {
    firstLesson: starts[0] ?? null,
    lastLesson: starts.at(-1) ?? null,
    lessonsCount: starts.length,
    totalMinor: priceMinor == null ? null : starts.length * priceMinor,
  };
}

/** Lightweight fixed-count total used by compact package previews. */
export function previewTotalMinor(
  values: Pick<PackageFormValues, 'sizingMode' | 'price' | 'lessonsTotal'>,
): number | null {
  const priceMinor = parsePriceInput(values.price);
  if (priceMinor == null || values.sizingMode !== 'FIXED_COUNT') return null;
  return Number(values.lessonsTotal) * priceMinor;
}

export function buildCreatePackageDto(values: PackageFormValues): CreatePackageDto {
  const summary = packageScheduleSummary(values);
  const startDate = startDateOf(values);
  const hasSchedule = values.sizingMode === 'BY_PERIOD' || values.scheduleEnabled;
  const totalMinor = summary.totalMinor ?? 0;
  const paymentAmount =
    values.paymentStatus === 'PAID' ? totalMinor : (parsePriceInput(values.paidAmount) ?? 0);

  return {
    ...(values.targetKind === 'student'
      ? { studentId: values.targetId }
      : { groupId: values.targetId }),
    ...(values.name.trim() ? { name: values.name.trim() } : {}),
    sizingMode: values.sizingMode,
    ...(values.sizingMode === 'FIXED_COUNT'
      ? {
          lessonsTotal: Number(values.lessonsTotal),
          expiresAt: localDateStartUtc(
            addDays(startDate, Number(values.validityDays)),
            values.timezone,
          ).toISOString(),
        }
      : {
          endDate: new Date(
            localDateStartUtc(addDays(values.endDate, 1), values.timezone).getTime() - 1,
          ).toISOString(),
        }),
    pricePerLessonMinor: parsePriceInput(values.price) ?? 0,
    currency: values.currency,
    ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
    ...(hasSchedule
      ? {
          schedule: {
            slots: values.weekdays.map((weekday) => ({
              weekday,
              localTime: values.slotTimes[String(weekday)] ?? '10:00',
            })),
            timezone: values.timezone,
            durationMin: Number(values.durationMin),
            startDate: scheduleStartInstant(values).toISOString(),
          },
        }
      : {}),
    ...(values.paymentStatus !== 'PENDING'
      ? {
          initialPayment: {
            amountMinor: paymentAmount,
            paidAt: localInputToIso(values.paidAt),
          },
        }
      : {}),
  };
}
