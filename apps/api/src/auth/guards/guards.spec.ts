import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { WorkspaceRole } from '@prisma/client';
import { AuthApiException } from '../auth.errors';
import type { AuthenticatedUser } from '../auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { createTestTokenService } from '../testing/token-service.factory';
import { AccessTokenGuard } from './access-token.guard';
import { RolesGuard } from './roles.guard';

interface MockRequest {
  headers: Record<string, string | undefined>;
  user?: AuthenticatedUser;
}

function createContext(
  request: MockRequest,
  metadata: Record<string, unknown> = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({ metadata }),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function createReflector(metadata: Record<string, unknown>): Reflector {
  return {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
}

describe('AccessTokenGuard', () => {
  const tokens = createTestTokenService();

  it('allows @Public() routes without a token', async () => {
    const guard = new AccessTokenGuard(
      createReflector({ [IS_PUBLIC_KEY]: true }),
      tokens,
    );
    await expect(
      guard.canActivate(createContext({ headers: {} })),
    ).resolves.toBe(true);
  });

  it('rejects requests without a bearer token', async () => {
    const guard = new AccessTokenGuard(createReflector({}), tokens);
    await expect(
      guard.canActivate(createContext({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects malformed and invalid tokens', async () => {
    const guard = new AccessTokenGuard(createReflector({}), tokens);
    await expect(
      guard.canActivate(
        createContext({ headers: { authorization: 'Bearer garbage' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      guard.canActivate(
        createContext({ headers: { authorization: 'Basic abc' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a refresh token used as an access token', async () => {
    const guard = new AccessTokenGuard(createReflector({}), tokens);
    const refreshToken = tokens.signRefreshToken({
      userId: 'u1',
      sessionId: 's1',
      workspaceId: 'w1',
      jti: 'j1',
    });
    await expect(
      guard.canActivate(
        createContext({ headers: { authorization: `Bearer ${refreshToken}` } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the authenticated user to the request for a valid token', async () => {
    const guard = new AccessTokenGuard(createReflector({}), tokens);
    const accessToken = tokens.signAccessToken({
      userId: 'u1',
      sessionId: 's1',
      workspaceId: 'w1',
      role: 'TEACHER',
    });
    const request: MockRequest = {
      headers: { authorization: `Bearer ${accessToken}` },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({
      userId: 'u1',
      sessionId: 's1',
      workspaceId: 'w1',
      role: 'TEACHER',
    });
  });
});

describe('RolesGuard', () => {
  const user = (role: WorkspaceRole): AuthenticatedUser => ({
    userId: 'u1',
    sessionId: 's1',
    workspaceId: 'w1',
    role,
  });

  it('allows routes without role metadata', () => {
    const guard = new RolesGuard(createReflector({}));
    expect(
      guard.canActivate(createContext({ headers: {}, user: user('TEACHER') })),
    ).toBe(true);
  });

  it('allows an OWNER on an owner-only route', () => {
    const guard = new RolesGuard(createReflector({ [ROLES_KEY]: ['OWNER'] }));
    expect(
      guard.canActivate(createContext({ headers: {}, user: user('OWNER') })),
    ).toBe(true);
  });

  it('denies a TEACHER on an owner-only route with a FORBIDDEN code', () => {
    const guard = new RolesGuard(createReflector({ [ROLES_KEY]: ['OWNER'] }));
    try {
      guard.canActivate(createContext({ headers: {}, user: user('TEACHER') }));
      fail('expected FORBIDDEN');
    } catch (error) {
      expect(error).toBeInstanceOf(AuthApiException);
      expect((error as AuthApiException).getStatus()).toBe(403);
      expect((error as AuthApiException).getResponse()).toMatchObject({
        code: 'FORBIDDEN',
      });
    }
  });

  it('denies when no user is attached', () => {
    const guard = new RolesGuard(createReflector({ [ROLES_KEY]: ['OWNER'] }));
    expect(() => guard.canActivate(createContext({ headers: {} }))).toThrow(
      AuthApiException,
    );
  });
});
