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

/**
 * Buying a package.
 *
 * The two sizing modes need different fields, and a by-period package cannot
 * size itself without a schedule — both rules are enforced here rather than in
 * the component, so the form and the API agree on what "valid" means.
 */
export const packageFormSchema = z
  .object({
    targetKind: z.enum(['student', 'group']),
    targetId: uuidSchema,
    name: optionalText(z.string().trim().min(1).max(120)),
    sizingMode: z.enum(['FIXED_COUNT', 'BY_PERIOD']),
    lessonsTotal: lessonsTotalString,
    endDate: z.string(),
    price: priceString({ required: true }),
    currency: currencyCodeSchema,
    notes: optionalText(notesSchema),
    scheduleEnabled: z.boolean(),
    weekdays: weekdaysSchema,
    localTime: localTimeString,
    timezone: timezoneSchema,
    durationMin: durationMinString,
    scheduleStartDate: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.sizingMode !== 'BY_PERIOD') {
      return;
    }
    if (values.endDate.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        params: { key: 'dateRequired' },
        message: 'End date is required',
      });
    }
    if (!values.scheduleEnabled) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduleEnabled'],
        params: { key: 'scheduleRequiredForPeriod' },
        message: 'A by-period package needs a schedule',
      });
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
    endDate: '',
    price: '',
    currency: input.currency as PackageFormValues['currency'],
    notes: '',
    scheduleEnabled: false,
    weekdays: [1],
    localTime: '10:00',
    timezone: input.timezone,
    durationMin: '60',
    scheduleStartDate: toLocalDateInput(new Date()),
  };
}

/**
 * The package's total, for the live preview next to the price field. Takes only
 * the three fields it needs so the form can watch those instead of everything.
 * A by-period package has no total until the server expands its schedule.
 */
export function previewTotalMinor(
  values: Pick<PackageFormValues, 'sizingMode' | 'price' | 'lessonsTotal'>,
): number | null {
  const priceMinor = parsePriceInput(values.price);
  if (priceMinor === null || values.sizingMode !== 'FIXED_COUNT') {
    return null;
  }
  return Number(values.lessonsTotal) * priceMinor;
}

export function buildCreatePackageDto(
  values: PackageFormValues,
): CreatePackageDto {
  const priceMinor = parsePriceInput(values.price) ?? 0;
  const schedule = values.scheduleEnabled
    ? {
        weekdays: values.weekdays,
        localTime: values.localTime,
        timezone: values.timezone,
        durationMin: Number(values.durationMin),
        startDate: localInputToIso(values.scheduleStartDate),
      }
    : null;

  return {
    ...(values.targetKind === 'student'
      ? { studentId: values.targetId }
      : { groupId: values.targetId }),
    ...(values.name.trim() ? { name: values.name.trim() } : {}),
    sizingMode: values.sizingMode,
    ...(values.sizingMode === 'FIXED_COUNT'
      ? { lessonsTotal: Number(values.lessonsTotal) }
      : { endDate: localInputToIso(values.endDate) }),
    pricePerLessonMinor: priceMinor,
    currency: values.currency,
    ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
    ...(schedule ? { schedule } : {}),
  };
}
