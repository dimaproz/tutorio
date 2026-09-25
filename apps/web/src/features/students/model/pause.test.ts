import { describe, expect, it } from 'vitest';
import {
  pauseCreateDto,
  pauseFormDefaults,
  pauseFormSchema,
  pauseUpdateDto,
  type PauseFormValues,
} from './pause';
import { samplePause } from './testing';

const TODAY = '2026-09-24';
const STUDENT = 'ffffffff-0000-4000-8000-000000000001';

const values = (overrides: Partial<PauseFormValues> = {}): PauseFormValues => ({
  scope: 'student',
  enrollmentId: '',
  from: '2026-10-01',
  until: '2026-10-14',
  reason: 'HOLIDAY',
  ...overrides,
});

const keys = (input: PauseFormValues) => {
  const result = pauseFormSchema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map((issue) => (issue as { params?: { key: string } }).params?.key);
};

describe('pause form', () => {
  it('names the first day and an end before the start (board 02, state 10)', () => {
    expect(keys(values({ from: '' }))).toEqual(['pauseStartRequired']);
    expect(keys(values({ until: '2026-09-30' }))).toEqual(['pauseEndBeforeStart']);
    expect(keys(values({ scope: 'direction' }))).toEqual(['directionRequired']);
    expect(keys(values({ until: '' }))).toEqual([]);
  });

  it('sends the window from the first midnight to the one after the last day', () => {
    expect(pauseCreateDto(values(), STUDENT, TODAY)).toEqual({
      studentId: STUDENT,
      enrollmentId: null,
      startsAt: new Date(2026, 9, 1).toISOString(),
      endsAt: new Date(2026, 9, 15).toISOString(),
      reason: 'HOLIDAY',
    });
    // From today: now; no last day: until the tutor brings them back.
    expect(
      pauseCreateDto(
        values({ from: TODAY, until: '', scope: 'direction', enrollmentId: 'e' }),
        STUDENT,
        TODAY,
      ),
    ).toEqual({ studentId: STUDENT, enrollmentId: 'e', endsAt: null, reason: 'HOLIDAY' });
  });

  it('opens a change on the pause as it is', () => {
    const pause = samplePause({
      startsAt: new Date(2026, 9, 1).toISOString(),
      endsAt: new Date(2026, 9, 15).toISOString(),
      reason: 'ILLNESS',
    });
    expect(pauseFormDefaults({ today: TODAY, pause })).toEqual(values({ reason: 'ILLNESS' }));
  });

  it('changes only the end and the reason of a running pause', () => {
    expect(
      pauseUpdateDto(values({ until: '2026-10-20' }), samplePause({ state: 'ACTIVE' }), TODAY),
    ).toEqual({ endsAt: new Date(2026, 9, 21).toISOString(), reason: 'HOLIDAY' });
    expect(pauseUpdateDto(values(), samplePause({ state: 'SCHEDULED' }), TODAY)).toMatchObject({
      enrollmentId: null,
      startsAt: new Date(2026, 9, 1).toISOString(),
    });
  });
});
