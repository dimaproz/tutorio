import { describe, expect, it } from 'vitest';
import { enrollmentFormSchema } from '@/features/enrollments/model/form';
import { groupFormSchema } from '@/features/groups/model/form';
import {
  emptyPackageForm,
  packageFormSchema,
} from '@/features/packages/model/package-form';
import {
  adjustFormSchema,
  EMPTY_ADJUST_FORM,
  emptyPaymentForm,
  paymentFormSchema,
} from '@/features/packages/model/payment-form';
import {
  EMPTY_LESSON_FORM,
  lessonFormSchema,
} from '@/features/scheduling/model/lesson-form';
import {
  emptySeriesForm,
  seriesFormSchema,
} from '@/features/scheduling/model/series-form';
import { EMPTY_PARENT_FORM, parentFormSchema } from '@/features/parents/model/form';
import { workspaceSettingsFormSchema } from '@/features/settings/model/form';
import { EMPTY_STUDENT_FORM, studentFormSchema } from '@/features/students/model/form';
import { EMPTY_TEACHER_FORM, teacherFormSchema } from '@/features/teachers/model/form';

describe('feature form models', () => {
  it('keeps defaults and schemas colocated for entity forms', () => {
    expect(
      studentFormSchema.safeParse({
        ...EMPTY_STUDENT_FORM,
        fullName: 'Olena Kovalenko',
        timezone: 'Europe/Kyiv',
      }).success,
    ).toBe(true);
    expect(
      teacherFormSchema.safeParse({ ...EMPTY_TEACHER_FORM, fullName: 'Andrii Melnyk' }).success,
    ).toBe(true);
    expect(
      parentFormSchema.safeParse({
        ...EMPTY_PARENT_FORM,
        fullName: 'Iryna Bondar',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid money and policy values before a request is sent', () => {
    expect(
      groupFormSchema.safeParse({
        name: 'Morning group',
        pricePerLesson: '1.234',
        currency: 'EUR',
        notes: '',
      }).success,
    ).toBe(false);
    expect(
      workspaceSettingsFormSchema.safeParse({
        defaultCurrency: 'EUR',
        cancellationDeadlineHours: 337,
      }).success,
    ).toBe(false);
    expect(
      enrollmentFormSchema.safeParse({
        studentId: '11111111-1111-4111-8111-111111111111',
        groupId: 'individual',
        teacherId: '22222222-2222-4222-8222-222222222222',
        status: 'ACTIVE',
        billingType: 'PACKAGE',
        price: '20',
        currency: 'EUR',
        useCustomDeadline: true,
        cancellationDeadlineHours: '337',
      }).success,
    ).toBe(false);
  });

  // Scheduling and finance forms went through a phase of validating by hand in
  // the component. These assertions keep every dialog on a real zod schema.
  it('validates scheduling and finance forms through zod, not the component', () => {
    expect(
      lessonFormSchema.safeParse({
        ...EMPTY_LESSON_FORM,
        studentId: '11111111-1111-4111-8111-111111111111',
        startsAt: [{ value: '2026-08-01T09:00' }],
      }).success,
    ).toBe(true);
    // A lesson with no date is not bookable.
    expect(
      lessonFormSchema.safeParse({
        ...EMPTY_LESSON_FORM,
        studentId: '11111111-1111-4111-8111-111111111111',
        startsAt: [{ value: '' }],
      }).success,
    ).toBe(false);

    expect(
      seriesFormSchema.safeParse({
        ...emptySeriesForm('Europe/Kyiv'),
        studentId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(true);
    expect(
      seriesFormSchema.safeParse({
        ...emptySeriesForm('Europe/Kyiv'),
        weekdays: [],
      }).success,
    ).toBe(false);

    expect(
      packageFormSchema.safeParse({
        ...emptyPackageForm({ currency: 'EUR', timezone: 'Europe/Kyiv' }),
        targetId: '11111111-1111-4111-8111-111111111111',
        price: '20',
      }).success,
    ).toBe(true);

    expect(
      paymentFormSchema.safeParse({
        ...emptyPaymentForm({ enrollmentId: '44444444-4444-4444-8444-444444444444' }),
        amount: '20',
      }).success,
    ).toBe(true);
    // A manual adjustment without a reason must never reach the ledger.
    expect(adjustFormSchema.safeParse({ ...EMPTY_ADJUST_FORM, delta: '2' }).success).toBe(
      false,
    );
  });
});
