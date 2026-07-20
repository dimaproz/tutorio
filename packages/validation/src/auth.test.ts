import { describe, expect, it } from 'vitest';

import { loginSchema, refreshSchema, registerSchema } from './auth';
import { DEFAULT_LOCALE, localeSchema } from './locale';

const validRegister = {
  name: 'Olena',
  workspaceName: 'SpeakWise',
  email: 'olena@example.com',
  password: 'correct horse battery',
};

describe('registerSchema', () => {
  it('accepts a valid payload', () => {
    expect(registerSchema.parse(validRegister)).toEqual(validRegister);
  });

  it('normalizes email with trim + lowercase', () => {
    const parsed = registerSchema.parse({
      ...validRegister,
      email: '  Olena@Example.COM ',
    });
    expect(parsed.email).toBe('olena@example.com');
  });

  it('trims name and workspace name', () => {
    const parsed = registerSchema.parse({
      ...validRegister,
      name: '  Olena  ',
      workspaceName: '  SpeakWise  ',
    });
    expect(parsed.name).toBe('Olena');
    expect(parsed.workspaceName).toBe('SpeakWise');
  });

  it('rejects passwords shorter than 12 characters', () => {
    expect(registerSchema.safeParse({ ...validRegister, password: 'short pass' }).success).toBe(
      false,
    );
  });

  it('accepts Unicode passphrases with spaces', () => {
    const parsed = registerSchema.parse({
      ...validRegister,
      password: 'кінь батарея скріпка добре',
    });
    expect(parsed.password).toBe('кінь батарея скріпка добре');
  });

  it('does not trim passwords', () => {
    const parsed = registerSchema.parse({
      ...validRegister,
      password: ' padded passphrase ',
    });
    expect(parsed.password).toBe(' padded passphrase ');
  });

  it('rejects unknown properties (confirmPassword must never reach the API)', () => {
    expect(
      registerSchema.safeParse({ ...validRegister, confirmPassword: validRegister.password })
        .success,
    ).toBe(false);
  });

  it('rejects workspace names shorter than 2 characters', () => {
    expect(registerSchema.safeParse({ ...validRegister, workspaceName: 'A' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid credentials and normalizes email', () => {
    const parsed = loginSchema.parse({ email: 'USER@Example.com', password: 'x'.repeat(12) });
    expect(parsed.email).toBe('user@example.com');
  });

  it('rejects unknown properties', () => {
    expect(
      loginSchema.safeParse({ email: 'user@example.com', password: 'pw', remember: true }).success,
    ).toBe(false);
  });
});

describe('refreshSchema', () => {
  it('requires a non-empty refresh token', () => {
    expect(refreshSchema.safeParse({ refreshToken: '' }).success).toBe(false);
    expect(refreshSchema.safeParse({ refreshToken: 'token' }).success).toBe(true);
  });
});

describe('localeSchema', () => {
  it('accepts supported locales and rejects others', () => {
    expect(localeSchema.parse('uk')).toBe('uk');
    expect(localeSchema.parse('en')).toBe('en');
    expect(localeSchema.safeParse('de').success).toBe(false);
  });

  it('defaults to Ukrainian', () => {
    expect(DEFAULT_LOCALE).toBe('uk');
  });
});
