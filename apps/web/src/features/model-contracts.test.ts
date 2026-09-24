import { describe, expect, it } from 'vitest';
import { emptyGroupForm, makeGroupFormSchema } from '@/features/groups/model/form';
import { EMPTY_PARENT_FORM, parentFormSchema } from '@/features/parents/model/form';
import {
  emptyStudentQuickCreate,
  studentEditSchema,
  studentQuickCreateSchema,
} from '@/features/students/model/form';

describe('feature form models', () => {
  it('keeps defaults and schemas colocated for entity forms', () => {
    expect(
      studentQuickCreateSchema.safeParse({
        ...emptyStudentQuickCreate({ currency: 'EUR', timezone: 'Europe/Kyiv' }),
        fullName: 'Olena Kovalenko',
      }).success,
    ).toBe(true);
    expect(
      studentEditSchema.safeParse({
        ...emptyStudentQuickCreate({ currency: 'EUR', timezone: 'Europe/Kyiv' }),
        fullName: 'Olena Kovalenko', languageLevel: '', knowledgeLevel: '', avatarKey: null,
      }).success,
    ).toBe(true);
    expect(
      parentFormSchema.safeParse({
        ...EMPTY_PARENT_FORM,
        fullName: 'Iryna Bondar',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid money values before a request is sent', () => {
    expect(
      makeGroupFormSchema({ teacherRequired: false }).safeParse({
        ...emptyGroupForm('EUR'),
        name: 'Morning group',
        pricePerLesson: '1.234',
      }).success,
    ).toBe(false);
  });
});
