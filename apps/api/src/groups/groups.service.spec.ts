import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BusinessApiException } from '../common/business.errors';
import type { PrismaService } from '../prisma/prisma.service';
import type { MaterializerService } from '../scheduling/materializer.service';
import { GroupsService } from './groups.service';

const WORKSPACE_ID = '22222222-2222-4222-8222-222222222222';
const GROUP_ID = '55555555-5555-4555-8555-555555555555';
const TEACHER_ID = '66666666-6666-4666-8666-666666666666';
const OTHER_TEACHER_ID = '77777777-7777-4777-8777-777777777777';
const ALICE_ID = '44444444-4444-4444-8444-444444444444';
const BOB_ID = '88888888-8888-4888-8888-888888888888';
const CAROL_ID = '99999999-9999-4999-8999-999999999999';
const NOW = new Date('2026-07-20T10:00:00.000Z');

const owner: AuthenticatedUser = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 's1',
  workspaceId: WORKSPACE_ID,
  role: 'OWNER',
};

const groupRow = {
  id: GROUP_ID,
  workspaceId: WORKSPACE_ID,
  name: 'B1 English',
  teacherId: TEACHER_ID,
  capacity: null,
  pricePerLesson: 2500,
  currency: 'EUR',
  notes: null,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  rosterSuspensionToken: null,
};

type Row = Record<string, unknown>;

function buildPrismaMock() {
  const prisma = {
    group: {
      findFirst: jest.fn().mockResolvedValue(groupRow),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(groupRow),
      update: jest.fn().mockImplementation(({ data }: { data: Row }) => ({
        ...groupRow,
        ...data,
      })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    student: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(1),
    },
    teacher: {
      findFirst: jest.fn().mockResolvedValue({ id: TEACHER_ID }),
      findMany: jest.fn().mockResolvedValue([{ id: TEACHER_ID }]),
    },
    enrollment: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(1),
      createManyAndReturn: jest
        .fn()
        .mockImplementation(({ data }: { data: { studentId: string }[] }) =>
          data.map((row) => ({
            id: `enrollment-${row.studentId}`,
            studentId: row.studentId,
          })),
        ),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    lesson: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    lessonSeries: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(({ data }: { data: Row }) => ({
        id: 'series-1',
        endsAt: null,
        enrollmentId: null,
        packageId: null,
        ...data,
      })),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    lessonPackage: { findMany: jest.fn().mockResolvedValue([]) },
    workspace: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        defaultCurrency: 'EUR',
        timezone: 'Europe/Kyiv',
      }),
    },
    auditLog: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (arg: Promise<unknown>[] | ((tx: unknown) => unknown)) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
  );
  return prisma;
}

function buildService() {
  const prisma = buildPrismaMock();
  const audit = new AuditService(prisma as unknown as PrismaService);
  const materializer = {
    horizonUntil: jest
      .fn()
      .mockReturnValue(new Date('2026-10-12T00:00:00.000Z')),
    materializeSeries: jest.fn().mockResolvedValue([]),
    assertSeriesSlotsFree: jest.fn().mockResolvedValue(undefined),
  };
  const service = new GroupsService(
    prisma as unknown as PrismaService,
    audit,
    materializer as unknown as MaterializerService,
  );
  return { prisma, service, materializer };
}

async function expectBusinessError(
  promise: Promise<unknown>,
  code: string,
  status: number,
): Promise<void> {
  try {
    await promise;
    throw new Error(`expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(BusinessApiException);
    expect((error as BusinessApiException).code).toBe(code);
    expect((error as BusinessApiException).getStatus()).toBe(status);
  }
}

const listQuery = {
  page: 1,
  pageSize: 20,
  state: 'active' as const,
  sort: 'name' as const,
  order: 'asc' as const,
};

describe('GroupsService roster reconciliation', () => {
  it('enrolls the initial roster inside the create transaction', async () => {
    const { prisma, service } = buildService();
    prisma.student.findMany.mockResolvedValue([
      { id: ALICE_ID, hourlyRateMinor: null, currency: null },
      { id: BOB_ID, hourlyRateMinor: null, currency: null },
    ]);

    await service.create(owner, {
      name: 'B1 English',
      students: { studentIds: [ALICE_ID, BOB_ID], teacherId: TEACHER_ID },
    });

    // One transaction and one insert for the whole roster.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.enrollment.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(
      prisma.enrollment.createManyAndReturn.mock.calls[0][0].data,
    ).toHaveLength(2);
    expect(prisma.group.create.mock.calls[0][0].data).toMatchObject({
      teacherId: TEACHER_ID,
    });
    expect(prisma.group.create.mock.calls[0][0].data).not.toHaveProperty(
      'students',
    );
    // Two enrollment audit rows in one write.
    expect(prisma.auditLog.createMany.mock.calls[0][0].data).toHaveLength(2);
  });

  it('adds only the newcomers and removes only the dropped students', async () => {
    const { prisma, service } = buildService();
    prisma.enrollment.findMany.mockResolvedValue([
      { id: 'enrollment-alice', studentId: ALICE_ID, status: 'ACTIVE' },
      { id: 'enrollment-bob', studentId: BOB_ID, status: 'PAUSED' },
    ]);
    prisma.student.findMany.mockResolvedValue([
      { id: ALICE_ID, hourlyRateMinor: null, currency: null },
      { id: CAROL_ID, hourlyRateMinor: null, currency: null },
    ]);

    await service.update(owner, GROUP_ID, {
      students: { studentIds: [ALICE_ID, CAROL_ID] },
    });

    // Alice is untouched, Bob is removed, Carol is enrolled with the group's
    // own teacher because the roster payload names none.
    expect(prisma.enrollment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['enrollment-bob'] } },
      data: { deletedAt: expect.any(Date) },
    });
    expect(prisma.enrollment.createManyAndReturn.mock.calls[0][0].data).toEqual(
      [
        expect.objectContaining({
          studentId: CAROL_ID,
          groupId: GROUP_ID,
          teacherId: TEACHER_ID,
        }),
      ],
    );
  });

  it('never touches a membership suspended by a student archive', async () => {
    const { prisma, service } = buildService();
    prisma.student.findMany.mockResolvedValue([
      { id: ALICE_ID, hourlyRateMinor: null, currency: null },
    ]);

    await service.update(owner, GROUP_ID, {
      students: { studentIds: [ALICE_ID] },
    });

    // Rows marked by a student archive are outside the reconciled set, so the
    // student's restore can bring them back exactly as they were.
    expect(prisma.enrollment.findMany.mock.calls[0][0].where).toMatchObject({
      groupId: GROUP_ID,
      deletedAt: null,
      studentArchivedAt: null,
    });
  });

  it('reactivates a membership archived by hand instead of duplicating it', async () => {
    const { prisma, service } = buildService();
    prisma.enrollment.findMany.mockResolvedValue([
      { id: 'enrollment-bob', studentId: BOB_ID, status: 'ARCHIVED' },
    ]);
    prisma.student.findMany.mockResolvedValue([
      { id: BOB_ID, hourlyRateMinor: null, currency: null },
    ]);

    await service.update(owner, GROUP_ID, {
      students: { studentIds: [BOB_ID] },
    });

    expect(prisma.enrollment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['enrollment-bob'] } },
      data: { status: 'ACTIVE' },
    });
    expect(prisma.enrollment.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('reconciles the roster even when no group field changed', async () => {
    const { prisma, service } = buildService();
    prisma.student.findMany.mockResolvedValue([
      { id: ALICE_ID, hourlyRateMinor: null, currency: null },
    ]);

    await service.update(owner, GROUP_ID, {
      name: groupRow.name,
      students: { studentIds: [ALICE_ID], teacherId: TEACHER_ID },
    });

    // A no-op PATCH still writes no group audit row, but the roster applies.
    expect(prisma.group.update).not.toHaveBeenCalled();
    expect(prisma.enrollment.createManyAndReturn).toHaveBeenCalledTimes(1);
  });

  it('generates the schedule the moment the roster allows it', async () => {
    const { prisma, service, materializer } = buildService();
    prisma.student.findMany.mockResolvedValue([
      { id: ALICE_ID, hourlyRateMinor: null, currency: null },
    ]);
    prisma.lessonSeries.findMany.mockResolvedValue([
      { id: 'series-1', groupId: GROUP_ID },
    ]);

    await service.update(owner, GROUP_ID, {
      students: { studentIds: [ALICE_ID] },
    });

    expect(materializer.materializeSeries).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ id: 'series-1' }),
      expect.any(Date),
      expect.any(Date),
    );
  });

  it('prices a newcomer from the group, falling back to the student rate', async () => {
    const { prisma, service } = buildService();
    prisma.group.findFirst.mockResolvedValue({
      ...groupRow,
      pricePerLesson: null,
      currency: null,
    });
    prisma.student.findMany.mockResolvedValue([
      { id: ALICE_ID, hourlyRateMinor: 3000, currency: 'UAH' },
      { id: BOB_ID, hourlyRateMinor: null, currency: null },
    ]);

    await service.update(owner, GROUP_ID, {
      students: { studentIds: [ALICE_ID, BOB_ID], teacherId: TEACHER_ID },
    });

    const [alice, bob] =
      prisma.enrollment.createManyAndReturn.mock.calls[0][0].data;
    expect(alice).toMatchObject({ priceMinor: 3000, currency: 'UAH' });
    // No rate anywhere: free, in the workspace currency.
    expect(bob).toMatchObject({ priceMinor: 0, currency: 'EUR' });
  });

  it('needs a teacher before it can enroll anyone', async () => {
    const { prisma, service } = buildService();
    prisma.group.findFirst.mockResolvedValue({ ...groupRow, teacherId: null });
    prisma.student.findMany.mockResolvedValue([
      { id: ALICE_ID, hourlyRateMinor: null, currency: null },
    ]);

    await expectBusinessError(
      service.update(owner, GROUP_ID, { students: { studentIds: [ALICE_ID] } }),
      'GROUP_TEACHER_REQUIRED',
      400,
    );
  });

  it('rejects a roster holding a student from another workspace', async () => {
    const { prisma, service } = buildService();
    prisma.student.findMany.mockResolvedValue([
      { id: ALICE_ID, hourlyRateMinor: null, currency: null },
    ]);

    await expectBusinessError(
      service.update(owner, GROUP_ID, {
        students: { studentIds: [ALICE_ID, BOB_ID], teacherId: TEACHER_ID },
      }),
      'STUDENT_NOT_FOUND',
      404,
    );
    expect(prisma.enrollment.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('rejects a roster pointing at a teacher from another workspace', async () => {
    const { prisma, service } = buildService();
    prisma.student.findMany.mockResolvedValue([
      { id: ALICE_ID, hourlyRateMinor: null, currency: null },
    ]);
    prisma.teacher.findFirst.mockResolvedValue(null);

    await expectBusinessError(
      service.update(owner, GROUP_ID, {
        students: { studentIds: [ALICE_ID], teacherId: OTHER_TEACHER_ID },
      }),
      'TEACHER_NOT_FOUND',
      404,
    );
    expect(prisma.enrollment.createManyAndReturn).not.toHaveBeenCalled();
  });
});

describe('GroupsService teacher and schedule', () => {
  it('creates a first schedule in the workspace timezone at the group price', async () => {
    const { prisma, service, materializer } = buildService();

    await service.create(owner, {
      name: 'B1 English',
      pricePerLesson: 2500,
      currency: 'EUR',
      schedule: { weekdays: [2, 4], localTime: '17:00', durationMin: 60 },
    });

    expect(prisma.lessonSeries.create.mock.calls[0][0].data).toMatchObject({
      groupId: GROUP_ID,
      teacherId: TEACHER_ID,
      weekdays: [2, 4],
      localTime: '17:00',
      timezone: 'Europe/Kyiv',
      durationMin: 60,
      priceMinor: 2500,
      currency: 'EUR',
    });
    // Nothing generated yet (no students): the slots are still clash-checked.
    expect(materializer.assertSeriesSlotsFree).toHaveBeenCalled();
  });

  it('picks the only active teacher when none is named', async () => {
    const { prisma, service } = buildService();

    await service.create(owner, { name: 'Solo group' });

    expect(prisma.group.create.mock.calls[0][0].data).toMatchObject({
      teacherId: TEACHER_ID,
    });
  });

  it('leaves the teacher empty when several could run the group', async () => {
    const { prisma, service } = buildService();
    prisma.teacher.findMany.mockResolvedValue([
      { id: TEACHER_ID },
      { id: OTHER_TEACHER_ID },
    ]);
    prisma.group.create.mockResolvedValue({ ...groupRow, teacherId: null });

    await expectBusinessError(
      service.create(owner, {
        name: 'No teacher',
        schedule: { weekdays: [1], localTime: '10:00', durationMin: 45 },
      }),
      'GROUP_TEACHER_REQUIRED',
      400,
    );
  });

  it('refuses a second schedule from the group form', async () => {
    const { prisma, service } = buildService();
    prisma.lessonSeries.count.mockResolvedValue(1);

    await expectBusinessError(
      service.update(owner, GROUP_ID, {
        schedule: { weekdays: [1], localTime: '10:00', durationMin: 45 },
      }),
      'GROUP_SCHEDULE_EXISTS',
      409,
    );
    expect(prisma.lessonSeries.create).not.toHaveBeenCalled();
  });

  it('moves the roster, schedule and upcoming lessons to a new teacher', async () => {
    const { prisma, service } = buildService();
    prisma.lesson.findMany.mockImplementation(({ where }: { where: Row }) =>
      where.groupId === GROUP_ID
        ? [
            {
              id: 'lesson-1',
              teacherId: TEACHER_ID,
              startsAtUtc: new Date('2026-07-21T14:00:00.000Z'),
              durationMin: 60,
              deletedAt: null,
            },
          ]
        : [],
    );
    prisma.lessonSeries.findMany.mockResolvedValue([
      { id: 'series-1', teacherId: TEACHER_ID },
    ]);
    prisma.lesson.updateMany.mockResolvedValue({ count: 1 });

    await service.update(owner, GROUP_ID, { teacherId: OTHER_TEACHER_ID });

    expect(prisma.lesson.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['lesson-1'] } },
      data: { teacherId: OTHER_TEACHER_ID },
    });
    expect(prisma.lessonSeries.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { teacherId: OTHER_TEACHER_ID } }),
    );
    expect(prisma.enrollment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { teacherId: OTHER_TEACHER_ID } }),
    );
  });

  it('refuses a new teacher who is busy at an upcoming group lesson', async () => {
    const { prisma, service } = buildService();
    prisma.lesson.findMany.mockImplementation(({ where }: { where: Row }) =>
      where.groupId === GROUP_ID
        ? [
            {
              id: 'lesson-1',
              teacherId: TEACHER_ID,
              startsAtUtc: new Date('2026-07-21T14:00:00.000Z'),
              durationMin: 60,
              deletedAt: null,
            },
          ]
        : [
            {
              id: 'busy-1',
              startsAtUtc: new Date('2026-07-21T14:30:00.000Z'),
              durationMin: 60,
            },
          ],
    );

    await expectBusinessError(
      service.update(owner, GROUP_ID, { teacherId: OTHER_TEACHER_ID }),
      'SCHEDULE_CONFLICT',
      409,
    );
    expect(prisma.lesson.updateMany).not.toHaveBeenCalled();
  });
});

describe('GroupsService reads and lifecycle', () => {
  it('narrows by every filter together instead of letting one overwrite another', async () => {
    const { prisma, service } = buildService();

    await service.list(owner, {
      ...listQuery,
      studentId: ALICE_ID,
      status: 'ACTIVE',
      teacherId: TEACHER_ID,
      weekday: 2,
      payment: 'unpaid',
    });

    const where = prisma.group.findMany.mock.calls[0][0].where;
    expect(where.AND).toHaveLength(5);
    expect(where.AND).toEqual(
      expect.arrayContaining([
        {
          enrollments: {
            some: expect.objectContaining({ studentId: ALICE_ID }),
          },
        },
        { teacherId: TEACHER_ID },
        { lessonSeries: { some: { deletedAt: null, weekdays: { has: 2 } } } },
      ]),
    );
  });

  it('pages by name in the database and reads rosters for that page only', async () => {
    const { prisma, service } = buildService();
    prisma.group.findMany
      .mockResolvedValueOnce([{ id: GROUP_ID }])
      .mockResolvedValueOnce([
        {
          ...groupRow,
          teacher: null,
          enrollments: [
            {
              teacher: {
                id: TEACHER_ID,
                fullName: 'T',
                avatarKey: null,
                color: null,
              },
              student: { id: ALICE_ID, fullName: 'Alice', avatarKey: null },
            },
          ],
          lessonSeries: [],
        },
      ]);
    prisma.group.count.mockResolvedValue(21);

    const result = await service.list(owner, { ...listQuery, pageSize: 1 });

    expect(prisma.group.findMany.mock.calls[0][0]).toMatchObject({
      skip: 0,
      take: 1,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    expect(prisma.group.findMany.mock.calls[1][0].where).toEqual({
      id: { in: [GROUP_ID] },
    });
    const liveEnrollment =
      prisma.group.findMany.mock.calls[1][0].include.enrollments.where;
    expect(liveEnrollment).toMatchObject({
      status: { in: ['ACTIVE', 'PAUSED'] },
      student: { deletedAt: null, status: { not: 'ARCHIVED' } },
    });
    expect(result.total).toBe(21);
    expect(result.items[0]).toMatchObject({
      status: 'ACTIVE',
      activeStudentCount: 1,
      // A legacy group without its own teacher shows its roster's.
      teacher: { id: TEACHER_ID },
      nextLesson: null,
      paymentDue: false,
    });
  });

  it('counts free seats only across groups that set a capacity', async () => {
    const { prisma, service } = buildService();
    prisma.group.findMany.mockResolvedValue([
      { capacity: 8, _count: { enrollments: 6 } },
      { capacity: 4, _count: { enrollments: 5 } },
    ]);

    const summary = await service.summary(owner);

    // An overfull group contributes nothing rather than a negative seat.
    expect(summary.freeSeats).toBe(2);
  });

  it('archives only future operational work and preserves the group graph', async () => {
    const { prisma, service } = buildService();

    await service.softDelete(owner, GROUP_ID);

    expect(prisma.lesson.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          groupId: GROUP_ID,
          status: 'SCHEDULED',
          deletedAt: null,
        }),
      }),
    );
    expect(prisma.lessonSeries.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ groupId: GROUP_ID, deletedAt: null }),
      }),
    );
    expect(prisma.enrollment.updateMany).not.toHaveBeenCalled();
    expect(prisma.group.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it('refuses a legacy destructive group restore for manual repair', async () => {
    const { prisma, service } = buildService();
    prisma.group.findFirst.mockResolvedValue({
      ...groupRow,
      deletedAt: new Date('2026-08-24T10:00:00.000Z'),
    });
    prisma.auditLog.findMany.mockResolvedValue([{ diff: null }]);

    await expectBusinessError(
      service.restore(owner, GROUP_ID),
      'GROUP_LEGACY_REPAIR_REQUIRED',
      409,
    );
    expect(prisma.group.update).not.toHaveBeenCalled();
  });

  it('keeps an archived group readable for its restore', async () => {
    const { prisma, service } = buildService();
    prisma.group.findFirst.mockResolvedValue({
      ...groupRow,
      deletedAt: new Date('2026-08-24T10:00:00.000Z'),
      teacher: { id: TEACHER_ID, fullName: 'T', avatarKey: null, color: null },
      enrollments: [],
      lessonSeries: [],
    });

    const detail = await service.getDetail(owner, GROUP_ID);

    expect(prisma.group.findFirst.mock.calls[0][0].where).toEqual({
      id: GROUP_ID,
      workspaceId: WORKSPACE_ID,
    });
    expect(detail).toMatchObject({
      deletedAt: '2026-08-24T10:00:00.000Z',
      status: 'EMPTY',
    });
  });
});
