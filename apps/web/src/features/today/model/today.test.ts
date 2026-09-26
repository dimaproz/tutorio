import { describe, expect, it } from 'vitest';
import {
  categoryHref,
  dayOverview,
  firstOpen,
  lessonsOn,
  nearestDay,
  partOfDay,
  scopeMode,
  scopeView,
  studioDays,
} from './today';

const KYIV = 'Europe/Kyiv';
// Saturday 26 September 2026, 13:05 in Kyiv.
const now = Date.parse('2026-09-26T10:05:00.000Z');
const at = (time: string, date = '2026-09-26') => {
  const [h, m] = time.split(':').map(Number) as [number, number];
  // Kyiv is UTC+3 in September.
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + ((h - 3) * 60 + m) * 60_000).toISOString();
};
const lesson = (id: string, time: string, status = 'SCHEDULED', durationMin = 60) => ({
  id,
  startsAtUtc: at(time),
  durationMin,
  status: status as 'SCHEDULED',
});

describe('whose day', () => {
  const me = { id: 'me', status: 'ACTIVE' };

  it('switches only for an owner who teaches with colleagues', () => {
    expect(scopeMode({ solo: true, me, others: 3 })).toBe('solo');
    expect(scopeMode({ solo: false, me, others: 3 })).toBe('switch');
    expect(scopeMode({ solo: false, me, others: 0 })).toBe('solo');
    expect(scopeMode({ solo: false, me: null, others: 3 })).toBe('studio');
    expect(scopeMode({ solo: false, me: { id: 'me', status: 'ARCHIVED' }, others: 3 })).toBe(
      'studio',
    );
  });

  it('filters «Мої» to the owner and names teachers in the studio view', () => {
    expect(scopeView('switch', 'mine', 'me')).toEqual({ teacherId: 'me', showTeacher: false });
    expect(scopeView('switch', 'studio', 'me')).toEqual({ teacherId: null, showTeacher: true });
    expect(scopeView('studio', 'mine', null)).toEqual({ teacherId: null, showTeacher: true });
    expect(scopeView('solo', 'mine', 'me')).toEqual({ teacherId: null, showTeacher: false });
  });
});

describe('the studio clock', () => {
  it('greets by the part of the day', () => {
    expect(partOfDay(Date.parse(at('08:00')), KYIV)).toBe('morning');
    expect(partOfDay(now, KYIV)).toBe('day');
    expect(partOfDay(Date.parse(at('19:30')), KYIV)).toBe('evening');
    expect(partOfDay(Date.parse(at('02:00')), KYIV)).toBe('evening');
  });

  it('reads today and the two weeks after it', () => {
    expect(studioDays(now, KYIV)).toEqual({
      today: '2026-09-26',
      tomorrow: '2026-09-27',
      day: { from: '2026-09-25T21:00:00.000Z', to: '2026-09-26T21:00:00.000Z' },
      ahead: { from: '2026-09-26T21:00:00.000Z', to: '2026-10-10T21:00:00.000Z' },
    });
  });
});

describe('the day as one timeline', () => {
  const day = [
    lesson('b', '11:15', 'COMPLETED'),
    lesson('a', '10:00', 'COMPLETED'),
    lesson('c', '12:30'),
    lesson('d', '14:30'),
    lesson('e', '17:00', 'CANCELLED_UNCHARGED'),
    lesson('f', '18:00', 'SCHEDULED', 90),
  ];

  it('finds the running lesson and puts the line under it', () => {
    const overview = dayOverview(day, now);
    expect(overview.lessons.map((row) => row.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(overview).toMatchObject({ cancelled: 1, taking: 5, over: false, nowAfter: 3 });
    expect(overview.running?.id).toBe('c');
    expect(overview.next?.id).toBe('d');
  });

  it('says the day is over once every lesson that takes place ended', () => {
    const late = Date.parse(at('19:40'));
    const overview = dayOverview(day, late);
    expect(overview).toMatchObject({ over: true, running: null, next: null, nowAfter: 6 });
  });

  it('has no running lesson between two lessons', () => {
    const between = Date.parse(at('13:45'));
    expect(dayOverview(day, between)).toMatchObject({ running: null, next: { id: 'd' } });
  });
});

describe('the days ahead', () => {
  const ahead = [
    { startsAtUtc: at('12:30', '2026-09-28') },
    { startsAtUtc: at('10:00', '2026-09-28') },
    { startsAtUtc: at('09:00', '2026-09-29') },
  ];

  it('takes the nearest day with lessons', () => {
    expect(nearestDay(ahead, KYIV)).toEqual({
      date: '2026-09-28',
      lessons: [ahead[1], ahead[0]],
    });
    expect(nearestDay([], KYIV)).toBeNull();
    expect(lessonsOn(ahead, '2026-09-29', KYIV)).toEqual([ahead[2]]);
  });
});

describe('«Потребує уваги»', () => {
  const category = (kind: 'attendance' | 'makeups' | 'debtors', count: number) => ({
    kind,
    count,
    items: [],
    names: [],
  });

  it('opens the first category with something in it', () => {
    expect(
      firstOpen([category('attendance', 0), category('makeups', 0), category('debtors', 5)]),
    ).toBe('debtors');
    expect(firstOpen([category('attendance', 0)])).toBe('');
  });

  it('links «Усі N» to the list that holds them, in the same scope', () => {
    expect(categoryHref('attendance', 'me')).toBe(
      '/app/lessons?quick=unconfirmed&period=all&teacher=me',
    );
    expect(categoryHref('debtors', null)).toBe('/app/lessons?quick=unpaid&period=all');
    expect(categoryHref('expiringPackages', 'me')).toBe('/app/packages?tab=ENDING');
  });
});
