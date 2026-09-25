import { describe, expect, it } from 'vitest';
import {
  linkedPrice,
  saleDto,
  saleFormDefaults,
  saleFormSchema,
  saleName,
  salePreviewDto,
  type SaleDirection,
  type SaleFormValues,
} from './sale';

const STUDENT = '11111111-1111-4111-8111-111111111111';
const TEACHER = '22222222-2222-4222-8222-222222222222';
const GROUP = '33333333-3333-4333-8333-333333333333';

function direction(patch: Partial<SaleDirection> = {}): SaleDirection {
  return {
    enrollmentId: '44444444-4444-4444-8444-444444444444',
    billingType: 'PACKAGE',
    rateMinor: 50000,
    currency: 'UAH',
    packages: [],
    creditsLeft: 0,
    debtLessons: 0,
    balance: {
      chargedMinor: 0,
      paidMinor: 0,
      debtMinor: 0,
      advanceMinor: 0,
      unpaidLessons: 0,
      unpaid: [],
    },
    warning: null,
    status: 'ACTIVE',
    teacher: { id: TEACHER, name: 'Dmytro Tutor', avatarKey: null, subjects: ['English'] },
    group: null,
    cancellationDeadlineHours: null,
    ...patch,
  };
}

const NOW = new Date('2026-09-25T10:00:00');
const TODAY = '2026-09-25';

function values(patch: Partial<SaleFormValues> = {}): SaleFormValues {
  return { ...saleFormDefaults(direction(), NOW), ...patch };
}

describe('the sale form (S07 board 01)', () => {
  it("opens as 8 lessons at the direction's rate, valid for a month", () => {
    expect(saleFormDefaults(direction(), NOW)).toMatchObject({
      kind: 'FIXED_COUNT',
      lessons: '8',
      until: '2026-10-25',
      from: '2026-09-26',
      perLesson: '500',
      priceSource: 'perLesson',
    });
  });

  it('keeps the price field typed last and derives the other (decision 2)', () => {
    expect(linkedPrice({ perLesson: '500', total: '', priceSource: 'perLesson' }, 8)).toEqual({
      perLessonMinor: 50000,
      totalMinor: 400000,
    });
    expect(linkedPrice({ perLesson: '500', total: '3000', priceSource: 'total' }, 7)).toEqual({
      perLessonMinor: 42857,
      totalMinor: 300000,
    });
    expect(linkedPrice({ perLesson: '500', total: '', priceSource: 'perLesson' }, null)).toEqual({
      perLessonMinor: 50000,
      totalMinor: null,
    });
  });

  it('reports the board 05 errors by key', () => {
    const result = saleFormSchema(TODAY).safeParse(
      values({ lessons: '0', until: '2026-09-20', perLesson: '0' }),
    );
    expect(result.success).toBe(false);
    const keys = Object.fromEntries(
      (result.error?.issues ?? []).map((issue) => [
        issue.path[0],
        (issue as { params?: { key: string } }).params?.key,
      ]),
    );
    expect(keys).toEqual({
      lessons: 'lessonsAtLeastOne',
      until: 'dateIsPast',
      perLesson: 'amountAboveZero',
    });
  });

  it('checks the typed price only: a total wins over an empty per-lesson field', () => {
    expect(
      saleFormSchema(TODAY).safeParse(
        values({ perLesson: '', total: '4000', priceSource: 'total' }),
      ).success,
    ).toBe(true);
  });

  it('sells a count package to the teacher direction with one price and an exclusive end', () => {
    const dto = saleDto(values(), direction(), STUDENT);
    expect(dto).toEqual({
      studentId: STUDENT,
      teacherId: TEACHER,
      sizingMode: 'FIXED_COUNT',
      currency: 'UAH',
      lessonsTotal: 8,
      expiresAt: new Date('2026-10-26T00:00').toISOString(),
      pricePerLessonMinor: 50000,
    });
    expect(saleDto(values({ until: '' }), direction(), STUDENT).expiresAt).toBeNull();
  });

  it('sends a period window, the schedule count unless typed, and a weekly count', () => {
    const period = values({
      kind: 'BY_PERIOD',
      lessons: '',
      from: '2026-10-01',
      to: '2026-10-31',
      total: '4500',
      priceSource: 'total',
    });
    const dto = saleDto(period, direction({ group: { id: GROUP, name: 'B1' } }), STUDENT);
    expect(dto).toEqual({
      studentId: STUDENT,
      groupId: GROUP,
      sizingMode: 'BY_PERIOD',
      currency: 'UAH',
      validFrom: new Date('2026-10-01T00:00').toISOString(),
      endDate: new Date(new Date('2026-11-01T00:00').getTime() - 1).toISOString(),
      totalPriceMinor: 450000,
    });
    expect(saleDto({ ...period, lessons: '9' }, direction(), STUDENT)).toMatchObject({
      lessonsTotal: 9,
    });
    expect(
      saleDto({ ...period, kind: 'BY_PERIOD_WEEKLY', perWeek: '3' }, direction(), STUDENT),
    ).toMatchObject({ sizingMode: 'BY_PERIOD_WEEKLY', lessonsPerWeek: 3 });
  });

  it('previews only a form that can describe a package', () => {
    expect(salePreviewDto(values(), direction(), STUDENT, TODAY)).not.toBeNull();
    expect(salePreviewDto(values({ lessons: '' }), direction(), STUDENT, TODAY)).toBeNull();
    expect(salePreviewDto(values(), null, STUDENT, TODAY)).toBeNull();
  });

  it("sells with the tutor's name, or the suggestion when untouched or empty", () => {
    const suggested = 'English · 8 занять';
    expect(saleName(values(), suggested)).toBe(suggested);
    expect(saleName(values({ name: '  ', nameEdited: true }), suggested)).toBe(suggested);
    expect(saleName(values({ name: ' Autumn ', nameEdited: true }), suggested)).toBe('Autumn');
    expect(saleDto(values(), direction(), STUDENT, 'Autumn')).toMatchObject({ name: 'Autumn' });
  });
});
