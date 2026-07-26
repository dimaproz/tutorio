import { describe, expect, it } from 'vitest';
import {
  buildCreatePackageDto,
  emptyPackageForm,
  packageFormSchema,
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
    expect(packageFormSchema.safeParse({ ...base, lessonsTotal: '0' }).success).toBe(
      false,
    );
    expect(packageFormSchema.safeParse({ ...base, lessonsTotal: '900' }).success).toBe(
      false,
    );
  });

  it('requires an end date and a schedule for a by-period package', () => {
    const period = { ...base, sizingMode: 'BY_PERIOD' as const };
    expect(packageFormSchema.safeParse(period).success).toBe(false);

    const withEnd = { ...period, endDate: '2026-09-30' };
    // Still missing the schedule that sizes it.
    expect(packageFormSchema.safeParse(withEnd).success).toBe(false);

    expect(
      packageFormSchema.safeParse({ ...withEnd, scheduleEnabled: true }).success,
    ).toBe(true);
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
  it('targets a student and sends only the fixed-count field', () => {
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
    expect(dto).not.toHaveProperty('schedule');
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
    expect(dto.endDate).toBe(new Date('2026-09-30').toISOString());
    expect(dto.schedule).toMatchObject({
      weekdays: [1],
      localTime: '10:00',
      durationMin: 60,
    });
  });

  it('drops a blank name and blank notes', () => {
    const dto = buildCreatePackageDto({ ...base, name: '  ', notes: '  ' });
    expect(dto).not.toHaveProperty('name');
    expect(dto).not.toHaveProperty('notes');
  });
});
