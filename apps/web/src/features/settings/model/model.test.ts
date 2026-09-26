import { describe, expect, it } from 'vitest';
import type { AuditLogListItem, CurrentWorkspace } from '@tutorio/validation';
import {
  auditQuery,
  fieldSpec,
  filterCount,
  filtersActive,
  groupByDay,
  heldAutomatically,
  moneyCurrency,
  periodDays,
  periodParams,
  readAuditFilters,
  resetAuditParams,
  summaryFields,
  visibleFields,
  weekTotalQuery,
} from './audit';
import {
  buildSettingsDto,
  changedSettings,
  clampSetting,
  generalSettingsDefaults,
  lessonSettingsDefaults,
} from './form';

const KYIV = 'Europe/Kyiv';
/** Saturday 26 September 2026, 12:00 in Kyiv. */
const NOW = Date.parse('2026-09-26T09:00:00.000Z');

const workspace: CurrentWorkspace['workspace'] = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Kyiv English Studio',
  plan: 'PRO',
  mode: 'SCHOOL',
  defaultCurrency: 'UAH',
  cancellationDeadlineHours: 24,
  timezone: KYIV,
  scheduleHorizonWeeks: 4,
  lowCreditThreshold: 2,
};

const row = (fields: Partial<AuditLogListItem>): AuditLogListItem => ({
  id: '55555555-5555-4555-8555-555555555555',
  workspaceId: workspace.id,
  actorId: null,
  actor: null,
  entity: 'TEACHER',
  entityId: '44444444-4444-4444-8444-444444444444',
  action: 'UPDATE',
  changes: null,
  record: {
    label: 'Iryna Bondar',
    detail: null,
    startsAt: null,
    amountMinor: null,
    currency: 'UAH',
    slots: null,
  },
  createdAt: '2026-09-26T07:15:00.000Z',
  ...fields,
});

describe('settings forms', () => {
  it('starts from the studio as saved', () => {
    expect(generalSettingsDefaults(workspace)).toEqual({
      name: 'Kyiv English Studio',
      defaultCurrency: 'UAH',
      mode: 'SCHOOL',
    });
    expect(lessonSettingsDefaults(workspace)).toEqual({
      cancellationDeadlineHours: 24,
      scheduleHorizonWeeks: 4,
      lowCreditThreshold: 2,
    });
  });

  it('sends only what changed, so the log records exactly that', () => {
    const saved = lessonSettingsDefaults(workspace);
    const values = { ...saved, cancellationDeadlineHours: 12, lowCreditThreshold: 3 };
    expect(changedSettings(values, saved)).toEqual([
      'cancellationDeadlineHours',
      'lowCreditThreshold',
    ]);
    expect(buildSettingsDto(values, saved)).toEqual({
      cancellationDeadlineHours: 12,
      lowCreditThreshold: 3,
    });
    expect(buildSettingsDto(saved, saved)).toEqual({});
  });

  it('reads a name by what will be saved: spaces around it change nothing', () => {
    const saved = generalSettingsDefaults(workspace);
    expect(changedSettings({ ...saved, name: ' Kyiv English Studio ' }, saved)).toEqual([]);
    expect(buildSettingsDto({ ...saved, name: ' SpeakWise Kyiv ' }, saved)).toEqual({
      name: 'SpeakWise Kyiv',
    });
  });

  it('keeps a stepped or typed number inside the API range', () => {
    expect(clampSetting('cancellationDeadlineHours', -1)).toBe(0);
    expect(clampSetting('cancellationDeadlineHours', 400)).toBe(336);
    expect(clampSetting('scheduleHorizonWeeks', 0)).toBe(1);
    expect(clampSetting('lowCreditThreshold', 2.6)).toBe(3);
    expect(clampSetting('lowCreditThreshold', Number.NaN)).toBe(0);
  });
});

describe('audit filters', () => {
  it('reads the defaults and ignores what the API would refuse', () => {
    expect(readAuditFilters(new URLSearchParams('entity=CAT&action=EAT&period=year'))).toEqual({
      entity: null,
      action: null,
      actorId: null,
      period: 'week',
      from: null,
      to: null,
    });
  });

  it('reads an own range in order, and only a complete one', () => {
    const state = readAuditFilters(
      new URLSearchParams(
        'entity=TEACHER&action=UPDATE&actor=u1&period=custom&from=2026-09-26&to=2026-09-01',
      ),
    );
    expect(state).toMatchObject({
      entity: 'TEACHER',
      action: 'UPDATE',
      actorId: 'u1',
      period: 'custom',
      from: '2026-09-01',
      to: '2026-09-26',
    });
    expect(readAuditFilters(new URLSearchParams('period=custom&from=2026-09-01')).period).toBe(
      'week',
    );
  });

  it('covers the last 7 days by default, whole days on the studio clock', () => {
    const filters = readAuditFilters(new URLSearchParams());
    expect(periodDays(filters, NOW, KYIV)).toEqual({ from: '2026-09-20', to: '2026-09-26' });
    expect(auditQuery(filters, NOW, KYIV)).toEqual({
      pageSize: 20,
      entity: undefined,
      action: undefined,
      actorId: undefined,
      from: '2026-09-19T21:00:00.000Z',
      to: '2026-09-26T21:00:00.000Z',
    });
    expect(weekTotalQuery(NOW, KYIV)).toEqual({
      pageSize: 1,
      from: '2026-09-19T21:00:00.000Z',
      to: '2026-09-26T21:00:00.000Z',
    });
  });

  it('knows the other periods', () => {
    const at = (period: 'month' | 'thisMonth') =>
      periodDays({ period, from: null, to: null }, NOW, KYIV);
    expect(at('month')).toEqual({ from: '2026-08-28', to: '2026-09-26' });
    expect(at('thisMonth')).toEqual({ from: '2026-09-01', to: '2026-09-26' });
  });

  it('writes no defaults and resets everything', () => {
    expect(periodParams('week')).toEqual({ period: undefined, from: undefined, to: undefined });
    expect(periodParams('custom', { from: '2026-09-01', to: '2026-09-07' })).toEqual({
      period: 'custom',
      from: '2026-09-01',
      to: '2026-09-07',
    });
    expect(Object.keys(resetAuditParams())).toEqual([
      'entity',
      'action',
      'actor',
      'period',
      'from',
      'to',
    ]);
  });

  it('counts the filters the phone sheet sets and shows «Скинути» for any', () => {
    const base = readAuditFilters(new URLSearchParams());
    expect(filtersActive(base)).toBe(false);
    expect(filtersActive({ ...base, period: 'month' })).toBe(true);
    expect(filterCount({ ...base, period: 'month' })).toBe(0);
    expect(filterCount({ ...base, entity: 'TEACHER', action: 'UPDATE', actorId: 'u1' })).toBe(3);
  });
});

describe('audit rows', () => {
  it('groups by the day on the studio clock, not UTC', () => {
    const items = [
      row({ id: 'a', createdAt: '2026-09-25T21:30:00.000Z' }), // 00:30 on the 26th in Kyiv
      row({ id: 'b', createdAt: '2026-09-25T20:30:00.000Z' }), // 23:30 on the 25th
      row({ id: 'c', createdAt: '2026-09-25T09:00:00.000Z' }),
    ];
    expect(
      groupByDay(items, KYIV).map((day) => [day.day, day.items.map((item) => item.id)]),
    ).toEqual([
      ['2026-09-26', ['a']],
      ['2026-09-25', ['b', 'c']],
    ]);
  });

  it('reads each field by what it holds, and whose status it is', () => {
    expect(fieldSpec('TEACHER', 'defaultRateMinor')).toMatchObject({ kind: 'money' });
    expect(fieldSpec('TEACHER', 'color')).toMatchObject({ kind: 'color' });
    expect(fieldSpec('STUDENT', 'parentIds')).toMatchObject({ kind: 'refs' });
    expect(fieldSpec('LESSON', 'status')).toMatchObject({ kind: 'enum', values: 'lessonStatus' });
    expect(fieldSpec('TEACHER', 'status')).toMatchObject({ values: 'teacherStatus' });
    expect(fieldSpec('LESSON', 'attendance.44444444')).toMatchObject({ values: 'attendance' });
    expect(fieldSpec('GROUP', 'repricedMembers')).toMatchObject({ kind: 'count' });
    expect(fieldSpec('PAYMENT', 'method')).toMatchObject({ kind: 'enum', values: 'paymentMethod' });
    expect(fieldSpec('LESSON', 'workspaceId')).toBeNull();
    // A field the API adds later still shows, under its own name.
    expect(fieldSpec('GROUP', 'somethingNew')).toEqual({ kind: 'text', label: 'somethingNew' });
  });

  it('summarises the first three fields, values only where they are short', () => {
    const item = row({
      changes: {
        fields: {
          defaultRateMinor: { before: 40000, after: 45000 },
          color: { before: '#D6336C', after: '#AE3EC9' },
          bio: { before: 'a', after: 'b' },
          subjects: { before: ['English'], after: ['English', 'Kids'] },
          workspaceId: { before: null, after: 'x' },
        },
      },
    });
    const summary = summaryFields(item);
    expect(summary.fields.map((field) => [field.key, field.withValues])).toEqual([
      ['defaultRateMinor', true],
      ['color', false],
      ['bio', false],
    ]);
    expect(summary.more).toBe(true);
    expect(visibleFields(item).map((field) => field.key)).not.toContain('workspaceId');
  });

  it('prices money in the diff currency first, then the record currency', () => {
    const own = row({
      changes: {
        fields: {
          defaultRateMinor: { before: 11000, after: 12000 },
          currency: { before: 'UAH', after: 'PLN' },
        },
      },
    });
    expect(moneyCurrency(own, 'before')).toBe('UAH');
    expect(moneyCurrency(own, 'after')).toBe('PLN');
    expect(moneyCurrency(row({}), 'after')).toBe('UAH');
  });

  it('tells a lesson Tutorio held by itself (L-50)', () => {
    const held = row({
      entity: 'LESSON',
      changes: {
        fields: {
          status: { before: 'SCHEDULED', after: 'COMPLETED' },
          completedBy: { before: null, after: 'SCHEDULE' },
        },
      },
    });
    expect(heldAutomatically(held)).toBe(true);
    expect(summaryFields(held).fields.map((field) => field.key)).toEqual(['status']);
    expect(
      heldAutomatically({
        ...held,
        actor: { id: 'u1', name: 'Olena', email: 'o@example.test' },
      }),
    ).toBe(false);
  });
});
