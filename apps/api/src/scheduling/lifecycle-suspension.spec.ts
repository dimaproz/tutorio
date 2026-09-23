import type { Prisma } from '@prisma/client';
import {
  assertLessonsAreFree,
  lockStudentLifecycles,
  lockTeacherSchedules,
} from './lifecycle-suspension';

const WORKSPACE = 'workspace-1';
const at = (iso: string) => new Date(`2026-10-01T${iso}:00.000Z`);

function txWith(busy: unknown[]) {
  const findMany = jest.fn().mockResolvedValue(busy);
  return {
    tx: { lesson: { findMany } } as unknown as Prisma.TransactionClient,
    findMany,
  };
}

async function conflictIds(promise: Promise<unknown>): Promise<string[]> {
  try {
    await promise;
  } catch (error) {
    const body = (
      error as { getResponse(): { details?: unknown } }
    ).getResponse();
    return (
      (body.details as { conflictIds?: string[] } | undefined)?.conflictIds ??
      []
    );
  }
  throw new Error('expected SCHEDULE_CONFLICT');
}

describe('assertLessonsAreFree', () => {
  it('checks the whole batch with one query over the covering window', async () => {
    const { tx, findMany } = txWith([]);

    await assertLessonsAreFree(
      tx,
      WORKSPACE,
      [
        { id: 'a', teacherId: 't1', startsAtUtc: at('10:00'), durationMin: 60 },
        { id: 'b', teacherId: 't2', startsAtUtc: at('15:00'), durationMin: 30 },
      ],
      { excludeIds: ['moved'] },
    );

    expect(findMany).toHaveBeenCalledTimes(1);
    const { where } = findMany.mock.calls[0][0] as {
      where: Prisma.LessonWhereInput;
    };
    expect(where).toMatchObject({
      workspaceId: WORKSPACE,
      teacherId: { in: ['t1', 't2'] },
      deletedAt: null,
      id: { notIn: ['a', 'b', 'moved'] },
      startsAtUtc: {
        gte: new Date(at('10:00').getTime() - 720 * 60_000),
        lt: at('15:30'),
      },
    });
  });

  it('reports busy lessons of the same teacher that overlap a candidate', async () => {
    const { tx } = txWith([
      // Overlaps a (t1 10:00–11:00).
      {
        id: 'busy-1',
        teacherId: 't1',
        startsAtUtc: at('10:30'),
        durationMin: 60,
      },
      // Touches a's end only — not an overlap.
      {
        id: 'busy-2',
        teacherId: 't1',
        startsAtUtc: at('11:00'),
        durationMin: 60,
      },
      // Overlaps a's time but belongs to another teacher's candidate window.
      {
        id: 'busy-3',
        teacherId: 't2',
        startsAtUtc: at('10:00'),
        durationMin: 60,
      },
    ]);

    const ids = await conflictIds(
      assertLessonsAreFree(tx, WORKSPACE, [
        { id: 'a', teacherId: 't1', startsAtUtc: at('10:00'), durationMin: 60 },
        { id: 'b', teacherId: 't2', startsAtUtc: at('15:00'), durationMin: 30 },
      ]),
    );

    expect(ids).toEqual(['busy-1']);
  });

  it('detects overlaps between lessons of the same batch', async () => {
    const { tx } = txWith([]);

    const ids = await conflictIds(
      assertLessonsAreFree(tx, WORKSPACE, [
        { id: 'a', teacherId: 't1', startsAtUtc: at('10:00'), durationMin: 60 },
        { id: 'b', teacherId: 't1', startsAtUtc: at('10:30'), durationMin: 60 },
        { id: 'c', teacherId: 't2', startsAtUtc: at('10:30'), durationMin: 60 },
      ]),
    );

    expect(ids).toEqual(['a']);
  });

  it('skips the query for an empty batch', async () => {
    const { tx, findMany } = txWith([]);
    await assertLessonsAreFree(tx, WORKSPACE, []);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('advisory locks', () => {
  function lockingTx() {
    const executeRaw = jest.fn().mockResolvedValue(1);
    return {
      tx: { $executeRaw: executeRaw } as unknown as Prisma.TransactionClient,
      executeRaw,
    };
  }

  it('locks every teacher in one statement with sorted, deduplicated keys', async () => {
    const { tx, executeRaw } = lockingTx();

    await lockTeacherSchedules(tx, WORKSPACE, ['t2', 't1', 't2']);

    expect(executeRaw).toHaveBeenCalledTimes(1);
    const [strings, keys] = executeRaw.mock.calls[0] as [
      TemplateStringsArray,
      string[],
    ];
    expect(strings.join('?')).toContain('unnest(');
    expect(strings.join('?')).toContain('ORDER BY u.k COLLATE "C"');
    expect(keys).toEqual([
      `${WORKSPACE}:teacher:t1`,
      `${WORKSPACE}:teacher:t2`,
    ]);
  });

  it('uses a single-key statement for one id and none for zero', async () => {
    const { tx, executeRaw } = lockingTx();

    await lockStudentLifecycles(tx, WORKSPACE, ['s1']);
    await lockStudentLifecycles(tx, WORKSPACE, []);

    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(executeRaw.mock.calls[0][1]).toBe(`${WORKSPACE}:student:s1`);
  });
});
