import { describe, expect, it } from 'vitest';
import type { MemberBillingState } from './member-billing';
import {
  appliedPrices,
  defaultSelection,
  memberLine,
  memberPreviewDto,
  memberSaleDefaults,
  memberSaleDto,
  nextMonth,
  ownRateHint,
  type MemberSaleCandidate,
} from './member-sale';

const KYIV = 'Europe/Kyiv';
// Wednesday 9 September 2026, 12:00 in Kyiv.
const NOW = new Date('2026-09-09T09:00:00.000Z');
const GROUP = '99999999-9999-4999-8999-000000000001';
const id = (n: number) => `d6bf671d-7a0f-4cf3-8a67-${String(n).padStart(12, '0')}`;

const stateOf = (kind: MemberBillingState['kind']): MemberBillingState => ({
  kind,
  currency: 'UAH',
  billingType: 'PACKAGE',
  pkg: null,
  debt: null,
  pausedUntil: null,
});

const candidate = (
  n: number,
  kind: MemberBillingState['kind'],
  ownRateMinor: number | null = null,
): MemberSaleCandidate => ({
  studentId: id(n),
  fullName: `Member ${n}`,
  avatarKey: null,
  ownRateMinor,
  state: stateOf(kind),
});

const BOARD = [
  candidate(1, 'low'),
  candidate(5, 'debt'),
  candidate(2, 'noPackage'),
  candidate(11, 'paid', 35000),
  candidate(10, 'partial'),
  candidate(7, 'paused'),
];

describe('the member sale (S08 board 02)', () => {
  it('ticks running low, owing and no package (decision 10)', () => {
    expect(defaultSelection(BOARD)).toEqual([id(1), id(5), id(2)]);
  });

  it("opens on the next month from the group's schedule at the group price", () => {
    expect(nextMonth(NOW, KYIV)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(memberSaleDefaults(NOW, KYIV, { hasSchedule: true, rateMinor: 40000 })).toMatchObject({
      kind: 'BY_PERIOD',
      lessons: '',
      from: '2026-10-01',
      to: '2026-10-31',
      perLesson: '400',
      priceSource: 'perLesson',
    });
    expect(memberSaleDefaults(NOW, KYIV, { hasSchedule: false, rateMinor: 40000 })).toMatchObject({
      kind: 'FIXED_COUNT',
      lessons: '8',
      perLesson: '400',
    });
  });

  it('sells an own rate only once applied, and only to a ticked member (decision 8)', () => {
    expect(appliedPrices(BOARD, new Set(), [id(11)])).toEqual([]);
    expect(appliedPrices(BOARD, new Set([id(11)]), [id(1)])).toEqual([]);
    expect(appliedPrices(BOARD, new Set([id(11)]), [id(1), id(11)])).toEqual([
      { studentId: id(11), pricePerLessonMinor: 35000 },
    ]);
  });

  it('asks for the group, the members, their rates and the period on the studio clock', () => {
    const values = memberSaleDefaults(NOW, KYIV, { hasSchedule: true, rateMinor: 40000 });
    expect(
      memberSaleDto(
        values,
        {
          groupId: GROUP,
          studentIds: [id(1), id(11)],
          prices: [{ studentId: id(11), pricePerLessonMinor: 35000 }],
          currency: 'UAH',
        },
        KYIV,
        'B2 prep · 1–31 жовт',
      ),
    ).toEqual({
      groupId: GROUP,
      studentIds: [id(1), id(11)],
      prices: [{ studentId: id(11), pricePerLessonMinor: 35000 }],
      name: 'B2 prep · 1–31 жовт',
      sizingMode: 'BY_PERIOD',
      currency: 'UAH',
      validFrom: '2026-09-30T21:00:00.000Z',
      endDate: '2026-10-31T21:59:59.999Z',
      pricePerLessonMinor: 40000,
    });
  });

  it('previews every member once the form is valid', () => {
    const values = memberSaleDefaults(NOW, KYIV, { hasSchedule: true, rateMinor: 40000 });
    const target = {
      groupId: GROUP,
      candidates: BOARD,
      applied: new Set<string>(),
      currency: 'UAH',
    };
    expect(memberPreviewDto(values, target, '2026-09-09', KYIV)?.studentIds).toHaveLength(6);
    expect(memberPreviewDto({ ...values, perLesson: '' }, target, '2026-09-09', KYIV)).toBeNull();
  });

  it("shows each ticked member's line and the own-rate hint", () => {
    const mark = BOARD[3]!;
    const shared = { lessons: 9, sharedPerLessonMinor: 40000, sharedTotalMinor: null };
    expect(memberLine(mark, { ...shared, preview: undefined, applied: false })).toEqual({
      lessons: 9,
      totalMinor: 360000,
    });
    expect(memberLine(mark, { ...shared, preview: undefined, applied: true })).toEqual({
      lessons: 9,
      totalMinor: 315000,
    });
    expect(ownRateHint(mark, { ...shared, applied: false })).toEqual({
      rateMinor: 35000,
      lessons: 9,
      totalMinor: 315000,
    });
    expect(ownRateHint(mark, { ...shared, applied: true })).toBeNull();
    expect(ownRateHint(BOARD[0]!, { ...shared, applied: false })).toBeNull();
  });
});
