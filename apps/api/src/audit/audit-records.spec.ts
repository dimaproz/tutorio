import { resolveAuditRecords, type AuditRowRef } from './audit-records';

const WORKSPACE_ID = '22222222-2222-4222-8222-222222222222';
const id = (n: number) =>
  `44444444-4444-4444-8444-${String(n).padStart(12, '0')}`;

type Tables = Record<string, unknown[]>;

function buildReader(tables: Tables = {}) {
  const table = (name: string) => ({
    findMany: jest.fn().mockResolvedValue(tables[name] ?? []),
  });
  return {
    student: table('student'),
    parent: table('parent'),
    teacher: table('teacher'),
    group: table('group'),
    workspace: table('workspace'),
    enrollment: table('enrollment'),
    lesson: table('lesson'),
    lessonSeries: table('lessonSeries'),
    schedule: table('schedule'),
    pause: table('pause'),
    lessonPackage: table('lessonPackage'),
    payment: table('payment'),
    user: table('user'),
  };
}

const row = (
  entity: string,
  entityId: string,
  fields: Record<string, { before: unknown; after: unknown }> | null = null,
): AuditRowRef => ({
  entity,
  entityId,
  diff: fields ? ({ fields } as AuditRowRef['diff']) : null,
});

const resolve = (reader: ReturnType<typeof buildReader>, rows: AuditRowRef[]) =>
  resolveAuditRecords(
    reader as unknown as Parameters<typeof resolveAuditRecords>[0],
    WORKSPACE_ID,
    rows,
    new Date('2026-09-26T09:00:00.000Z'),
  );

describe('resolveAuditRecords', () => {
  it('scopes every read to the workspace and reads only the kinds on the page', async () => {
    const reader = buildReader({
      teacher: [{ id: id(1), fullName: 'Iryna Bondar', currency: 'UAH' }],
    });

    await resolve(reader, [row('TEACHER', id(1))]);

    expect(reader.teacher.findMany.mock.calls[0][0].where).toEqual({
      workspaceId: WORKSPACE_ID,
      id: { in: [id(1)] },
    });
    expect(reader.lesson.findMany.mock.calls[0][0].where).toEqual({
      workspaceId: WORKSPACE_ID,
      id: { in: [] },
    });
    // Users carry no workspace and are only read for ids a diff names.
    expect(reader.user.findMany).not.toHaveBeenCalled();
  });

  it('names people, groups and the studio with the currency of their money', async () => {
    const reader = buildReader({
      teacher: [{ id: id(1), fullName: 'Iryna Bondar', currency: 'UAH' }],
      group: [{ id: id(2), name: 'Speaking club', currency: 'PLN' }],
      workspace: [
        {
          id: WORKSPACE_ID,
          name: 'Kyiv English Studio',
          defaultCurrency: 'UAH',
        },
      ],
      parent: [{ id: id(3), fullName: 'Oksana Melnyk' }],
    });

    const { records } = await resolve(reader, [
      row('TEACHER', id(1)),
      row('GROUP', id(2)),
      row('WORKSPACE', WORKSPACE_ID),
      row('PARENT', id(3)),
    ]);

    expect(records.map((item) => [item.label, item.currency])).toEqual([
      ['Iryna Bondar', 'UAH'],
      ['Speaking club', 'PLN'],
      ['Kyiv English Studio', 'UAH'],
      ['Oksana Melnyk', null],
    ]);
  });

  it('tells a lesson, a payment and a package by whose they are', async () => {
    const reader = buildReader({
      lesson: [
        {
          id: id(1),
          startsAtUtc: new Date('2026-09-09T13:30:00.000Z'),
          currency: 'UAH',
          group: null,
          enrollment: { student: { fullName: 'Maksym Tkachenko' } },
        },
      ],
      payment: [
        {
          id: id(2),
          amountMinor: 320000,
          currency: 'UAH',
          package: { name: 'Жовтень' },
          enrollment: { student: { fullName: 'Anna Shevchenko' } },
        },
      ],
      lessonPackage: [
        {
          id: id(3),
          name: null,
          currency: 'UAH',
          student: { fullName: 'Anna Shevchenko' },
        },
      ],
      enrollment: [
        {
          id: id(4),
          currency: 'UAH',
          student: { fullName: 'Mila Savchuk' },
          group: { name: 'Kids A2' },
          teacher: { fullName: 'Dmytro Tutor' },
        },
      ],
    });

    const { records } = await resolve(reader, [
      row('LESSON', id(1)),
      row('PAYMENT', id(2)),
      row('LESSON_PACKAGE', id(3)),
      row('ENROLLMENT', id(4)),
    ]);

    expect(records[0]).toMatchObject({
      label: 'Maksym Tkachenko',
      startsAt: '2026-09-09T13:30:00.000Z',
    });
    expect(records[1]).toMatchObject({
      label: 'Anna Shevchenko',
      detail: 'Жовтень',
      amountMinor: 320000,
      currency: 'UAH',
    });
    expect(records[2]).toMatchObject({
      label: 'Anna Shevchenko',
      detail: null,
    });
    expect(records[3]).toMatchObject({
      label: 'Mila Savchuk',
      detail: 'Kids A2',
    });
  });

  it('reads a schedule by its group and the slots of the rule in force', async () => {
    const reader = buildReader({
      schedule: [
        {
          id: id(1),
          group: { name: 'Kids A2' },
          enrollment: null,
          series: [
            {
              weekdays: [2, 4],
              localTime: '15:00',
              startDate: new Date('2026-09-01T00:00:00.000Z'),
              endsAt: new Date('2026-10-01T00:00:00.000Z'),
              currency: 'UAH',
            },
            {
              weekdays: [4],
              localTime: '16:00',
              startDate: new Date('2026-10-01T00:00:00.000Z'),
              endsAt: null,
              currency: 'UAH',
            },
          ],
        },
        {
          id: id(2),
          group: null,
          enrollment: { student: { fullName: 'Anna Shevchenko' } },
          // Stopped: it reads by the last rule it had.
          series: [
            {
              weekdays: [1],
              localTime: '10:00',
              startDate: new Date('2026-08-01T00:00:00.000Z'),
              endsAt: new Date('2026-09-01T00:00:00.000Z'),
              currency: 'PLN',
            },
          ],
        },
      ],
    });

    const { records } = await resolve(reader, [
      row('SCHEDULE', id(1)),
      row('SCHEDULE', id(2)),
    ]);

    expect(records[0]).toMatchObject({
      label: 'Kids A2',
      slots: [
        { weekday: 2, localTime: '15:00' },
        { weekday: 4, localTime: '15:00' },
      ],
    });
    expect(records[1]).toMatchObject({
      label: 'Anna Shevchenko',
      currency: 'PLN',
      slots: [{ weekday: 1, localTime: '10:00' }],
    });
  });

  it('keeps the name a deleted record carries in its own diff', async () => {
    const { records } = await resolve(buildReader(), [
      row('STUDENT', id(1), {
        fullName: { before: null, after: 'Mila Savchuk' },
      }),
      row('PARENT', id(2)),
    ]);

    expect(records[0].label).toBe('Mila Savchuk');
    expect(records[1].label).toBeNull();
  });

  it('names the ids a diff points at, and only those that resolve', async () => {
    const reader = buildReader({
      teacher: [
        { id: id(1), fullName: 'Iryna Bondar', currency: 'UAH' },
        { id: id(5), fullName: 'Oleh Marchenko', currency: 'UAH' },
      ],
      parent: [{ id: id(6), fullName: 'Oksana Melnyk' }],
      lessonPackage: [
        {
          id: id(7),
          name: null,
          currency: 'UAH',
          student: { fullName: 'Anna' },
        },
      ],
    });

    const { names } = await resolve(reader, [
      row('TEACHER', id(1), {
        transferredTo: { before: null, after: id(5) },
      }),
      row('STUDENT', id(2), {
        parentIds: { before: [], after: [id(6), id(9)] },
      }),
      row('LESSON_PACKAGE', id(7), {
        toPackageId: { before: null, after: id(7) },
      }),
    ]);

    // The row's own teacher is not referenced by a diff; a nameless package is left out.
    expect(names).toEqual({
      [id(5)]: 'Oleh Marchenko',
      [id(6)]: 'Oksana Melnyk',
    });
    expect(reader.user.findMany.mock.calls[0][0].where).toEqual({
      id: { in: [id(5), id(6), id(9), id(7)] },
      memberships: { some: { workspaceId: WORKSPACE_ID } },
    });
  });
});
