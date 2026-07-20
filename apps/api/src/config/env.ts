import { z } from 'zod';

const DURATION_RE = /^\d+(s|m|h|d)$/;

const durationSchema = z
  .string()
  .regex(DURATION_RE, 'expected a duration like 15m, 12h or 30d');

// Required configuration fails fast at boot — there are no insecure defaults
// for secrets in any environment.
const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1),
    WEB_ORIGIN: z.string().min(1).default('http://localhost:3000'),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL: durationSchema.default('15m'),
    JWT_REFRESH_TTL: durationSchema.default('30d'),
    JWT_ISSUER: z.string().min(1).default('tutorio-api'),
    JWT_AUDIENCE: z.string().min(1).default('tutorio-clients'),
    THROTTLE_AUTH_LIMIT: z.coerce.number().int().positive().default(5),
    THROTTLE_REFRESH_LIMIT: z.coerce.number().int().positive().default(20),
    SENTRY_DSN: z.string().optional(),
  })
  .refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
    message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different',
    path: ['JWT_REFRESH_SECRET'],
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const details = result.error.issues
      .map(
        (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
      )
      .join('\n');
    // Never echo values back — variable names and constraint messages only.
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}

const DURATION_UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function durationToMs(value: string): number {
  const match = DURATION_RE.exec(value);
  if (!match) {
    throw new Error(
      `Invalid duration "${value}" — expected a value like 15m, 12h or 30d`,
    );
  }
  const unit = match[1];
  return parseInt(value, 10) * DURATION_UNIT_MS[unit];
}
