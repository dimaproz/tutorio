import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthApiException } from './auth.errors';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { createTestTokenService } from './testing/token-service.factory';

const NOW = Date.now();

async function captureAuthError(
  promise: Promise<unknown>,
): Promise<AuthApiException> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AuthApiException);
    return error as AuthApiException;
  }
  throw new Error('expected the promise to reject with AuthApiException');
}

function buildPrismaMock() {
  const prisma = {
    user: { create: jest.fn(), findUnique: jest.fn() },
    workspace: { create: jest.fn() },
    workspaceMember: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    teacher: { create: jest.fn() },
    authSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  return prisma;
}

const userRow = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'olena@example.com',
  passwordHash: 'set-in-beforeAll',
  name: 'Olena',
  createdAt: new Date(NOW),
  updatedAt: new Date(NOW),
  deletedAt: null,
};

const workspaceRow = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'SpeakWise',
  plan: 'FREE' as const,
  defaultCurrency: 'EUR',
  cancellationDeadlineHours: 24,
  createdAt: new Date(NOW),
  updatedAt: new Date(NOW),
  deletedAt: null,
};

const membershipRow = {
  id: '33333333-3333-4333-8333-333333333333',
  workspaceId: workspaceRow.id,
  userId: userRow.id,
  role: 'OWNER' as const,
  createdAt: new Date(NOW),
  updatedAt: new Date(NOW),
};

describe('AuthService', () => {
  const passwords = new PasswordService();
  const tokens = createTestTokenService();
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: AuthService;

  beforeAll(async () => {
    userRow.passwordHash = await passwords.hash('correct horse battery staple');
  });

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new AuthService(
      prisma as unknown as PrismaService,
      passwords,
      tokens,
    );
  });

  describe('register', () => {
    const dto = {
      name: 'Olena',
      workspaceName: 'SpeakWise',
      email: 'olena@example.com',
      password: 'correct horse battery staple',
    };

    beforeEach(() => {
      prisma.user.create.mockResolvedValue(userRow);
      prisma.workspace.create.mockResolvedValue(workspaceRow);
      prisma.workspaceMember.create.mockResolvedValue(membershipRow);
      prisma.authSession.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => ({ ...data }),
      );
    });

    it('creates user, workspace, owner membership and session in one transaction', async () => {
      const result = await service.register(dto);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.workspaceMember.create).toHaveBeenCalledWith({
        data: {
          workspaceId: workspaceRow.id,
          userId: userRow.id,
          role: 'OWNER',
        },
      });
      expect(result.role).toBe('OWNER');
      expect(result.user).toEqual({
        id: userRow.id,
        email: userRow.email,
        name: userRow.name,
      });
      expect(result.workspace.plan).toBe('FREE');
      expect(result.workspace.defaultCurrency).toBe('EUR');
      expect(result.workspace.cancellationDeadlineHours).toBe(24);
      await expect(
        tokens.verifyAccessToken(result.tokens.accessToken),
      ).resolves.toMatchObject({
        sub: userRow.id,
        workspaceId: workspaceRow.id,
        role: 'OWNER',
      });
    });

    it('hashes the password with argon2id before storing it', async () => {
      await service.register(dto);
      const createArgs = prisma.user.create.mock.calls[0][0] as {
        data: { passwordHash: string };
      };
      expect(createArgs.data.passwordHash).toMatch(/^\$argon2id\$/);
      expect(createArgs.data.passwordHash).not.toContain(dto.password);
    });

    it('stores only a hash of the refresh token', async () => {
      const result = await service.register(dto);
      const sessionArgs = prisma.authSession.create.mock.calls[0][0] as {
        data: { refreshTokenHash: string };
      };
      expect(sessionArgs.data.refreshTokenHash).not.toBe(
        result.tokens.refreshToken,
      );
      expect(sessionArgs.data.refreshTokenHash).toBe(
        tokens.hashRefreshToken(result.tokens.refreshToken),
      );
    });

    it('never exposes secret fields in the response', async () => {
      const serialized = JSON.stringify(await service.register(dto));
      expect(serialized).not.toContain('passwordHash');
      expect(serialized).not.toContain('refreshTokenHash');
      expect(serialized).not.toContain('argon2id');
    });

    it('maps the unique-email constraint violation to EMAIL_TAKEN', async () => {
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      const failure = service.register(dto);
      await expect(failure).rejects.toBeInstanceOf(AuthApiException);
      await failure.catch((error: AuthApiException) => {
        expect(error.getStatus()).toBe(409);
        expect(error.getResponse()).toMatchObject({ code: 'EMAIL_TAKEN' });
      });
    });
  });

  describe('login', () => {
    it('returns the same generic error for unknown email and wrong password', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      const unknownEmail = await captureAuthError(
        service.login({
          email: 'ghost@example.com',
          password: 'whatever whatever',
        }),
      );

      prisma.user.findUnique.mockResolvedValueOnce(userRow);
      const wrongPassword = await captureAuthError(
        service.login({
          email: userRow.email,
          password: 'wrong horse battery staple',
        }),
      );

      expect(unknownEmail.getStatus()).toBe(401);
      expect(unknownEmail.getResponse()).toEqual(wrongPassword.getResponse());
      expect(unknownEmail.getResponse()).toMatchObject({
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('logs in with valid credentials and creates a session', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow);
      prisma.workspaceMember.findFirst.mockResolvedValue({
        ...membershipRow,
        workspace: workspaceRow,
      });
      prisma.authSession.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => ({ ...data }),
      );

      const result = await service.login({
        email: userRow.email,
        password: 'correct horse battery staple',
      });
      expect(result.role).toBe('OWNER');
      expect(prisma.authSession.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('refresh', () => {
    const sessionId = '44444444-4444-4444-8444-444444444444';

    function makeSession(
      refreshToken: string,
      overrides: Record<string, unknown> = {},
    ) {
      return {
        id: sessionId,
        userId: userRow.id,
        workspaceId: workspaceRow.id,
        refreshTokenHash: tokens.hashRefreshToken(refreshToken),
        expiresAt: new Date(NOW + 86_400_000),
        lastUsedAt: new Date(NOW),
        revokedAt: null,
        createdAt: new Date(NOW),
        updatedAt: new Date(NOW),
        ...overrides,
      };
    }

    function makeRefreshToken(jti = 'jti-1') {
      return tokens.signRefreshToken({
        userId: userRow.id,
        sessionId,
        workspaceId: workspaceRow.id,
        jti,
      });
    }

    beforeEach(() => {
      prisma.workspaceMember.findUnique.mockResolvedValue({
        ...membershipRow,
        user: userRow,
        workspace: workspaceRow,
      });
    });

    it('rotates the refresh token and updates the session atomically', async () => {
      const refreshToken = makeRefreshToken();
      prisma.authSession.findUnique.mockResolvedValue(
        makeSession(refreshToken),
      );
      prisma.authSession.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.refresh(refreshToken);

      expect(result.tokens.refreshToken).not.toBe(refreshToken);
      const updateArgs = prisma.authSession.updateMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
        data: { refreshTokenHash: string };
      };
      expect(updateArgs.where).toMatchObject({
        id: sessionId,
        refreshTokenHash: tokens.hashRefreshToken(refreshToken),
        revokedAt: null,
      });
      expect(updateArgs.data.refreshTokenHash).toBe(
        tokens.hashRefreshToken(result.tokens.refreshToken),
      );
    });

    it('treats reuse of a rotated token as an attack and revokes the session', async () => {
      const rotatedAwayToken = makeRefreshToken('old-jti');
      const currentToken = makeRefreshToken('current-jti');
      prisma.authSession.findUnique.mockResolvedValue(
        makeSession(currentToken),
      );
      prisma.authSession.updateMany.mockResolvedValue({ count: 1 });

      const failure = await captureAuthError(service.refresh(rotatedAwayToken));

      expect(failure.getResponse()).toMatchObject({
        code: 'INVALID_REFRESH_TOKEN',
      });
      expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects an expired session with SESSION_EXPIRED', async () => {
      const refreshToken = makeRefreshToken();
      prisma.authSession.findUnique.mockResolvedValue(
        makeSession(refreshToken, { expiresAt: new Date(NOW - 1000) }),
      );

      const failure = await captureAuthError(service.refresh(refreshToken));
      expect(failure.getResponse()).toMatchObject({ code: 'SESSION_EXPIRED' });
    });

    it('rejects a revoked session', async () => {
      const refreshToken = makeRefreshToken();
      prisma.authSession.findUnique.mockResolvedValue(
        makeSession(refreshToken, { revokedAt: new Date(NOW) }),
      );

      const failure = await captureAuthError(service.refresh(refreshToken));
      expect(failure.getResponse()).toMatchObject({
        code: 'INVALID_REFRESH_TOKEN',
      });
    });

    it('rejects garbage tokens', async () => {
      const failure = await captureAuthError(
        service.refresh('not-a-real-token'),
      );
      expect(failure.getResponse()).toMatchObject({
        code: 'INVALID_REFRESH_TOKEN',
      });
      expect(prisma.authSession.findUnique).not.toHaveBeenCalled();
    });

    it('treats a lost concurrent rotation race as reuse', async () => {
      const refreshToken = makeRefreshToken();
      prisma.authSession.findUnique.mockResolvedValue(
        makeSession(refreshToken),
      );
      prisma.authSession.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });

      const failure = await captureAuthError(service.refresh(refreshToken));
      expect(failure.getResponse()).toMatchObject({
        code: 'INVALID_REFRESH_TOKEN',
      });
    });
  });

  describe('logout', () => {
    it('revokes the session for a valid refresh token', async () => {
      const refreshToken = tokens.signRefreshToken({
        userId: userRow.id,
        sessionId: 'session-x',
        workspaceId: workspaceRow.id,
        jti: 'jti-x',
      });
      prisma.authSession.updateMany.mockResolvedValue({ count: 1 });

      await service.logout(refreshToken);
      expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-x', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('is idempotent: invalid tokens resolve without touching the database', async () => {
      await expect(service.logout('garbage')).resolves.toBeUndefined();
      expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    });
  });
});
