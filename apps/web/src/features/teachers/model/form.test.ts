import { describe, expect, it } from 'vitest';
import type { TeacherResponse } from '@tutorio/validation';
import { TEACHER_COLORS } from '@/lib/theme/user-colors';
import {
  buildTeacherCreateDto,
  buildTeacherEditDto,
  emptyTeacherForm,
  teacherFormDefaults,
  teacherFormSchema,
  teacherFormSectionStatus,
} from './form';

const [INDIGO, PINK, , , , PURPLE] = TEACHER_COLORS;

const filled = {
  ...emptyTeacherForm('UAH', PURPLE),
  fullName: '  Claire Dubois ',
  email: 'claire@kyivenglish.ua',
  telegramUsername: '@claire_fr',
  subjects: ['Français', 'DELF'],
  rate: '450',
  bio: 'DELF B1–B2',
};

describe('teacher form', () => {
  it('requires only the name', () => {
    expect(teacherFormSchema.safeParse(emptyTeacherForm('UAH', PURPLE)).success).toBe(false);
    expect(
      teacherFormSchema.safeParse({ ...emptyTeacherForm('UAH', PURPLE), fullName: 'Claire' })
        .success,
    ).toBe(true);
    expect(teacherFormSchema.safeParse({ ...filled, rate: 'abc' }).success).toBe(false);
  });

  it('marks a section done by its meaningful fields, errors first', () => {
    expect(teacherFormSectionStatus(filled, ['email'])).toEqual({
      identity: 'done',
      contacts: 'error',
      teaching: 'done',
      about: 'done',
    });
    // The colour always holds a value, so it does not fill the section.
    expect(teacherFormSectionStatus(emptyTeacherForm('UAH', PURPLE), []).teaching).toBe('none');
  });

  it('creates with the rate in minor units and leaves blanks out', () => {
    expect(buildTeacherCreateDto(filled)).toEqual({
      fullName: 'Claire Dubois',
      avatarKey: undefined,
      email: 'claire@kyivenglish.ua',
      phone: undefined,
      telegramUsername: 'claire_fr',
      subjects: ['Français', 'DELF'],
      defaultRateMinor: 45000,
      currency: 'UAH',
      color: PURPLE,
      bio: 'DELF B1–B2',
      notes: undefined,
      status: 'ACTIVE',
    });
  });

  it('clears emptied fields on edit, the currency with the rate', () => {
    const dto = buildTeacherEditDto({ ...filled, rate: '', email: '' });
    expect(dto).toMatchObject({ email: null, defaultRateMinor: null, currency: null, notes: null });
  });

  it('reads a saved teacher back into the form', () => {
    const values = teacherFormDefaults(
      {
        fullName: 'Iryna Bondar',
        avatarKey: 'user-9',
        email: null,
        phone: '+380501234567',
        telegramUsername: 'iryna_b',
        subjects: ['English'],
        defaultRateMinor: 40050,
        currency: null,
        color: PINK.toLowerCase(),
        bio: null,
        notes: 'Free mornings',
      } as TeacherResponse,
      { currency: 'EUR', color: INDIGO },
    );
    expect(values).toMatchObject({
      rate: '400.50',
      currency: 'EUR',
      color: PINK,
      email: '',
      notes: 'Free mornings',
    });
  });
});
