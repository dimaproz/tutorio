import { describe, expect, it } from 'vitest';
import {
  buildCreateLessonDto,
  effectiveTeacherId,
  lessonFormSchema,
  prefillPriceMinor,
  type LessonFormValues,
} from './lesson-form';

const teacher = (id: string) => ({ value: id, label: id });

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const TEACHER_ID = '22222222-2222-4222-8222-222222222222';

const base: LessonFormValues = {
  studentId: STUDENT_ID,
  teacherId: '',
  durationMin: '60',
  price: '450',
  startsAt: [{ value: '2026-08-01T09:00' }],
  notes: '',
};

describe('effectiveTeacherId', () => {
  it('uses the explicit choice even when several teachers exist', () => {
    expect(effectiveTeacherId('t2', [teacher('t1'), teacher('t2')])).toBe('t2');
  });

  it('auto-selects the only teacher in the workspace', () => {
    expect(effectiveTeacherId('', [teacher('t1')])).toBe('t1');
  });

  it('stays empty when the choice would be a guess', () => {
    expect(effectiveTeacherId('', [teacher('t1'), teacher('t2')])).toBe('');
    expect(effectiveTeacherId('', [])).toBe('');
  });
});

describe('prefillPriceMinor', () => {
  it("prefers the student's own rate", () => {
    expect(
      prefillPriceMinor(
        { id: 's1', hourlyRateMinor: 45000, currency: 'UAH' },
        { id: 't1', defaultRateMinor: 20000, currency: 'EUR' },
      ),
    ).toBe(45000);
  });

  it("falls back to the teacher's default rate", () => {
    expect(
      prefillPriceMinor(
        { id: 's1', hourlyRateMinor: null, currency: null },
        { id: 't1', defaultRateMinor: 20000, currency: 'EUR' },
      ),
    ).toBe(20000);
  });

  it('returns null when nothing is configured', () => {
    expect(prefillPriceMinor(undefined, undefined)).toBeNull();
  });
});

describe('lessonFormSchema', () => {
  it('accepts a complete booking', () => {
    expect(lessonFormSchema.safeParse(base).success).toBe(true);
  });

  it('requires a student', () => {
    expect(lessonFormSchema.safeParse({ ...base, studentId: '' }).success).toBe(false);
  });

  it('allows a blank teacher so the server can resolve it', () => {
    expect(lessonFormSchema.safeParse({ ...base, teacherId: '' }).success).toBe(true);
    expect(
      lessonFormSchema.safeParse({ ...base, teacherId: TEACHER_ID }).success,
    ).toBe(true);
  });

  it('rejects a duration outside the domain bounds', () => {
    expect(lessonFormSchema.safeParse({ ...base, durationMin: '2' }).success).toBe(
      false,
    );
    expect(lessonFormSchema.safeParse({ ...base, durationMin: '900' }).success).toBe(
      false,
    );
  });

  it('allows a blank price but rejects an unparseable one', () => {
    expect(lessonFormSchema.safeParse({ ...base, price: '' }).success).toBe(true);
    expect(lessonFormSchema.safeParse({ ...base, price: 'abc' }).success).toBe(false);
  });

  it('requires at least one filled date', () => {
    expect(lessonFormSchema.safeParse({ ...base, startsAt: [{ value: '' }] }).success).toBe(
      false,
    );
    expect(
      lessonFormSchema.safeParse({ ...base, startsAt: [{ value: '' }, { value: '2026-08-01T09:00' }] })
        .success,
    ).toBe(true);
  });
});

describe('buildCreateLessonDto', () => {
  it('books by student, carrying price and currency together', () => {
    expect(
      buildCreateLessonDto(base, { teacherId: TEACHER_ID, currency: 'UAH' }),
    ).toEqual({
      studentId: STUDENT_ID,
      teacherId: TEACHER_ID,
      startsAt: [new Date('2026-08-01T09:00').toISOString()],
      durationMin: 60,
      priceMinor: 45000,
      currency: 'UAH',
    });
  });

  it('omits the price entirely when the pair is incomplete', () => {
    expect(
      buildCreateLessonDto({ ...base, price: '' }, { teacherId: TEACHER_ID, currency: 'UAH' }),
    ).not.toHaveProperty('priceMinor');
    expect(
      buildCreateLessonDto(base, { teacherId: TEACHER_ID, currency: null }),
    ).not.toHaveProperty('currency');
  });

  it('omits the teacher so the server can auto-resolve it', () => {
    expect(
      buildCreateLessonDto(base, { teacherId: '', currency: 'UAH' }),
    ).not.toHaveProperty('teacherId');
  });

  it('drops blank dates and blank notes', () => {
    const dto = buildCreateLessonDto(
      { ...base, startsAt: [{ value: '2026-08-01T09:00' }, { value: '' }], notes: '   ' },
      { teacherId: TEACHER_ID, currency: 'UAH' },
    );
    expect(dto.startsAt).toHaveLength(1);
    expect(dto).not.toHaveProperty('notes');
  });

  it('trims a real note', () => {
    expect(
      buildCreateLessonDto(
        { ...base, notes: '  Past Simple  ' },
        { teacherId: TEACHER_ID, currency: 'UAH' },
      ).notes,
    ).toBe('Past Simple');
  });
});
