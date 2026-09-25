import { describe, expect, it } from 'vitest';
import { lowCreditThresholdSchema, updateWorkspaceSettingsSchema } from './index';
import { listSchedulesQuerySchema } from './schedules';
import { listLessonPageQuerySchema } from './scheduling';

describe('listLessonPageQuerySchema', () => {
  it('pages newest first by default and parses query strings', () => {
    expect(listLessonPageQuerySchema.parse({ page: '2', filter: 'needs_makeup' })).toEqual({
      page: 2,
      pageSize: 20,
      order: 'desc',
      filter: 'needs_makeup',
    });
  });

  it('reads several statuses from a list or a repeated parameter', () => {
    expect(listLessonPageQuerySchema.parse({ status: 'NO_SHOW,COMPLETED' }).status).toEqual([
      'NO_SHOW',
      'COMPLETED',
    ]);
    expect(listLessonPageQuerySchema.parse({ status: ['SCHEDULED'] }).status).toEqual([
      'SCHEDULED',
    ]);
    expect(listLessonPageQuerySchema.safeParse({ status: 'HELD' }).success).toBe(false);
  });

  it('refuses an unknown filter and a period that ends before it starts', () => {
    expect(listLessonPageQuerySchema.safeParse({ filter: 'paid' }).success).toBe(false);
    expect(
      listLessonPageQuerySchema.safeParse({
        from: '2026-10-10T00:00:00.000Z',
        to: '2026-10-01T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });
});

describe('listSchedulesQuerySchema', () => {
  it('lists active schedules newest first by default', () => {
    expect(listSchedulesQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      state: 'ACTIVE',
      sort: 'created',
    });
  });

  it('takes the changing state, a kind and a sort by the next lesson', () => {
    expect(
      listSchedulesQuerySchema.parse({ state: 'CHANGING', kind: 'group', sort: 'next' }),
    ).toMatchObject({ state: 'CHANGING', kind: 'group', sort: 'next' });
    expect(listSchedulesQuerySchema.safeParse({ kind: 'trial' }).success).toBe(false);
  });
});

describe('lowCreditThreshold (L-120)', () => {
  it('accepts zero to turn the warning off and refuses negatives', () => {
    expect(lowCreditThresholdSchema.safeParse(0).success).toBe(true);
    expect(lowCreditThresholdSchema.safeParse(-1).success).toBe(false);
    expect(updateWorkspaceSettingsSchema.parse({ lowCreditThreshold: 3 })).toEqual({
      lowCreditThreshold: 3,
    });
  });
});
