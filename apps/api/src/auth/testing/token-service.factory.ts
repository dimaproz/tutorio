import { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { TokenService } from '../token.service';

export const TEST_ENV: Partial<Env> = {
  JWT_ACCESS_SECRET: 'test-access-secret-test-access-secret-0000',
  JWT_REFRESH_SECRET: 'test-refresh-secret-test-refresh-secret-11',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
  JWT_ISSUER: 'tutorio-api',
  JWT_AUDIENCE: 'tutorio-clients',
};

export function createTestTokenService(
  overrides: Partial<Env> = {},
): TokenService {
  const values: Partial<Env> = { ...TEST_ENV, ...overrides };
  const config = {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env, true>;
  return new TokenService(new JwtService({}), config);
}
