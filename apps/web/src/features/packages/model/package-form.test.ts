import { describe, expect, it } from 'vitest';
import {
  buildCreatePackageDto,
  emptyPackageForm,
  packageFormSchema,
  packageScheduleSummary,
  previewTotalMinor,
  type PackageFormValues,
} from './package-form';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const GROUP_ID = '33333333-3333-4333-8333-333333333333';

const base: PackageFormValues = {
  ...emptyPackageForm({ currency: 'UAH', timezone: 'Europe/Kyiv' }),
  targetId: STUDENT_ID,
  price: '450',
};

describe('packageFormSchema', () => {
  it('accepts a complete fixed-count package', () => {
    expect(packageFormSchema.safeParse(base).success).toBe(true);
  });

  it('requires a target and a price', () => {
    expect(packageFormSchema.safeParse({ ...base, targetId: '' }).success).toBe(false);
    expect(packageFormSchema.safeParse({ ...base, price: '' }).success).toBe(false);
  });

  it('rejects a lesson count outside the allowed range', () => {
    expect(packageFormSchema.safeParse({ ...base, lessonsTotal: '0' }).success).toBe(false);
    expect(packageFormSchema.safeParse({ ...base, lessonsTotal: '900' }).success).toBe(false);
  });

  it('requires an end date for a by-period package', () => {
    const period = { ...base, sizingMode: 'BY_PERIOD' as const };
    expect(packageFormSchema.safeParse(period).success).toBe(false);

    const withEnd = { ...period, endDate: '2026-09-30' };
    expect(packageFormSchema.safeParse(withEnd).success).toBe(true);
  });

  it('requires at least one weekday', () => {
    expect(packageFormSchema.safeParse({ ...base, weekdays: [] }).success).toBe(false);
  });
});

describe('previewTotalMinor', () => {
  it('multiplies the price by the lesson count', () => {
    expect(previewTotalMinor({ ...base, lessonsTotal: '8' })).toBe(8 * 45000);
  });

  it('has nothing to preview for a by-period package or a blank price', () => {
    expect(previewTotalMinor({ ...base, sizingMode: 'BY_PERIOD' })).toBeNull();
    expect(previewTotalMinor({ ...base, price: '' })).toBeNull();
  });
});

describe('buildCreatePackageDto', () => {
  it('targets a student and includes the default fixed-count schedule', () => {
    const dto = buildCreatePackageDto(base);
    expect(dto).toMatchObject({
      studentId: STUDENT_ID,
      sizingMode: 'FIXED_COUNT',
      lessonsTotal: 8,
      pricePerLessonMinor: 45000,
      currency: 'UAH',
    });
    expect(dto).not.toHaveProperty('groupId');
    expect(dto).not.toHaveProperty('endDate');
    expect(dto.schedule).toMatchObject({
      slots: [{ weekday: 1, localTime: '10:00' }],
      durationMin: 60,
    });
    expect(dto).toHaveProperty('expiresAt');
  });

  it('targets a group instead of a student', () => {
    const dto = buildCreatePackageDto({
      ...base,
      targetKind: 'group',
      targetId: GROUP_ID,
    });
    expect(dto).toMatchObject({ groupId: GROUP_ID });
    expect(dto).not.toHaveProperty('studentId');
  });

  it('sends the end date instead of a count for a by-period package', () => {
    const dto = buildCreatePackageDto({
      ...base,
      sizingMode: 'BY_PERIOD',
      endDate: '2026-09-30',
      scheduleEnabled: true,
    });
    expect(dto).not.toHaveProperty('lessonsTotal');
    expect(dto.endDate).toBe('2026-09-30T20:59:59.999Z');
    expect(dto.schedule).toMatchObject({
      slots: [{ weekday: 1, localTime: '10:00' }],
      durationMin: 60,
    });
  });

  it('omits schedule when the fixed-count switch is off', () => {
    const dto = buildCreatePackageDto({ ...base, scheduleEnabled: false });
    expect(dto).not.toHaveProperty('schedule');
  });

  it('maps partial and full initial payments', () => {
    const partial = buildCreatePackageDto({
      ...base,
      paymentStatus: 'PARTIAL',
      paidAmount: '100',
      paidAt: '2026-08-01',
    });
    expect(partial.initialPayment?.amountMinor).toBe(10000);

    const paid = buildCreatePackageDto({
      ...base,
      paymentStatus: 'PAID',
      paidAt: '2026-08-01',
    });
    expect(paid.initialPayment?.amountMinor).toBe(8 * 45000);
  });

  it('drops a blank name and blank notes', () => {
    const dto = buildCreatePackageDto({ ...base, name: '  ', notes: '  ' });
    expect(dto).not.toHaveProperty('name');
    expect(dto).not.toHaveProperty('notes');
  });
});

describe('packageScheduleSummary', () => {
  it('finds the next Saturday when generation starts on Sunday', () => {
    const summary = packageScheduleSummary({
      ...base,
      startMode: 'MANUAL',
      manualStartDate: '2026-08-02',
      weekdays: [6],
      slotTimes: { '6': '10:00' },
    });

    expect(summary.firstLesson?.toISOString().slice(0, 10)).toBe('2026-08-08');
  });
});
