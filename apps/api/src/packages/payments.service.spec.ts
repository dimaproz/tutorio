import { PaymentsService } from './payments.service';

const auth = {
  userId: 'user-1',
  sessionId: 'session-1',
  workspaceId: 'workspace-1',
  role: 'OWNER',
} as const;

function serviceWith(transaction: Record<string, unknown>): PaymentsService {
  const prisma = {
    $transaction: async (
      callback: (tx: Record<string, unknown>) => Promise<unknown>,
    ) => callback(transaction),
  };
  const audit = { record: jest.fn(), buildChanges: jest.fn(() => ({})) };
  return new PaymentsService(prisma as never, audit as never);
}

describe('PaymentsService.record', () => {
  it('rejects an enrollment that is not the package student before writing money', async () => {
    const create = jest.fn();
    const service = serviceWith({
      payment: { create, findFirst: jest.fn() },
      enrollment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'enrollment-1',
          studentId: 'student-1',
          groupId: null,
          currency: 'UAH',
        }),
      },
      lessonPackage: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'package-1',
          studentId: 'student-2',
          groupId: null,
          currency: 'UAH',
          totalPriceMinorSnapshot: 100000,
        }),
      },
    });

    await expect(
      service.record(auth, {
        enrollmentId: 'enrollment-1',
        packageId: 'package-1',
        amountMinor: 50000,
        currency: 'UAH',
        method: 'CASH',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PACKAGE_PAYMENT_RELATION' });
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects package-less payments in a different enrollment currency', async () => {
    const create = jest.fn();
    const service = serviceWith({
      payment: { create, findFirst: jest.fn() },
      enrollment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'enrollment-1',
          studentId: 'student-1',
          groupId: null,
          currency: 'UAH',
        }),
      },
    });

    await expect(
      service.record(auth, {
        enrollmentId: 'enrollment-1',
        amountMinor: 50000,
        currency: 'EUR',
        method: 'CASH',
      }),
    ).rejects.toMatchObject({ code: 'CURRENCY_MISMATCH' });
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a package payment exceeding the remaining agreed total', async () => {
    const create = jest.fn();
    const service = serviceWith({
      payment: {
        create,
        findFirst: jest.fn(),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { amountMinor: 90000 } }),
      },
      enrollment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'enrollment-1',
          studentId: 'student-1',
          groupId: null,
          currency: 'UAH',
        }),
      },
      lessonPackage: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'package-1',
          studentId: 'student-1',
          groupId: null,
          currency: 'UAH',
          totalPriceMinorSnapshot: 100000,
        }),
      },
    });

    await expect(
      service.record(auth, {
        enrollmentId: 'enrollment-1',
        packageId: 'package-1',
        amountMinor: 10001,
        currency: 'UAH',
        method: 'CASH',
      }),
    ).rejects.toMatchObject({ code: 'OVERPAYMENT' });
    expect(create).not.toHaveBeenCalled();
  });
});
