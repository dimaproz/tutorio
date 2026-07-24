import { describe, expect, it } from 'vitest';
import { enrollmentFormSchema } from '@/features/enrollments/model/form';
import { groupFormSchema } from '@/features/groups/model/form';
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
});
