import { createTestTokenService } from './testing/token-service.factory';

describe('TokenService', () => {
  const service = createTestTokenService();

  const subject = {
    userId: 'user-1',
    sessionId: 'session-1',
    workspaceId: 'workspace-1',
  };

  describe('access tokens', () => {
    it('signs and verifies an access token with the expected claims', async () => {
      const token = service.signAccessToken({ ...subject, role: 'OWNER' });
      const payload = await service.verifyAccessToken(token);

      expect(payload.sub).toBe('user-1');
      expect(payload.sid).toBe('session-1');
      expect(payload.workspaceId).toBe('workspace-1');
      expect(payload.role).toBe('OWNER');
      expect(payload.type).toBe('access');
    });

    it('rejects a refresh token presented as an access token', async () => {
      const refreshToken = service.signRefreshToken({
        ...subject,
        jti: 'jti-1',
      });
      await expect(service.verifyAccessToken(refreshToken)).rejects.toThrow();
    });

    it('rejects tokens signed with a different secret', async () => {
      const other = createTestTokenService({
        JWT_ACCESS_SECRET: 'another-access-secret-another-access-sec',
      });
      const token = other.signAccessToken({ ...subject, role: 'OWNER' });
      await expect(service.verifyAccessToken(token)).rejects.toThrow();
    });

    it('rejects tokens with a different issuer or audience', async () => {
      const otherIssuer = createTestTokenService({
        JWT_ISSUER: 'someone-else',
      });
      const otherAudience = createTestTokenService({
        JWT_AUDIENCE: 'other-clients',
      });
      await expect(
        service.verifyAccessToken(
          otherIssuer.signAccessToken({ ...subject, role: 'OWNER' }),
        ),
      ).rejects.toThrow();
      await expect(
        service.verifyAccessToken(
          otherAudience.signAccessToken({ ...subject, role: 'OWNER' }),
        ),
      ).rejects.toThrow();
    });

    it('rejects expired tokens', async () => {
      const shortLived = createTestTokenService({ JWT_ACCESS_TTL: '0s' });
      const token = shortLived.signAccessToken({ ...subject, role: 'OWNER' });
      await new Promise((resolve) => setTimeout(resolve, 1100));
      await expect(service.verifyAccessToken(token)).rejects.toThrow();
    });
  });

  describe('refresh tokens', () => {
    it('signs and verifies a refresh token with the expected claims', async () => {
      const token = service.signRefreshToken({ ...subject, jti: 'jti-42' });
      const payload = await service.verifyRefreshToken(token);

      expect(payload.sub).toBe('user-1');
      expect(payload.sid).toBe('session-1');
      expect(payload.type).toBe('refresh');
      expect(payload.jti).toBe('jti-42');
    });

    it('rejects an access token presented as a refresh token', async () => {
      const accessToken = service.signAccessToken({
        ...subject,
        role: 'OWNER',
      });
      await expect(service.verifyRefreshToken(accessToken)).rejects.toThrow();
    });
  });

  describe('hashRefreshToken', () => {
    it('is deterministic and never returns the raw token', () => {
      const token = service.signRefreshToken({ ...subject, jti: 'jti-9' });
      const hash = service.hashRefreshToken(token);
      expect(hash).toBe(service.hashRefreshToken(token));
      expect(hash).not.toContain(token);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
