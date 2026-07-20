import { AUTH_ERROR_CODES, BUSINESS_ERROR_CODES } from '@tutorio/validation';
import { describe, expect, it } from 'vitest';
import enMessages from '../../../messages/en.json';
import ukMessages from '../../../messages/uk.json';
import { errorMessageKey } from './error-message';
import type { GatewayError } from '@/lib/auth/client';

const error = (code: string): GatewayError =>
  ({ code, status: 400, message: code }) as GatewayError;

describe('errorMessageKey', () => {
  it('passes through every stable API error code', () => {
    for (const code of [...AUTH_ERROR_CODES, ...BUSINESS_ERROR_CODES]) {
      expect(errorMessageKey(error(code))).toBe(code);
    }
  });

  it('falls back to a generic message for unknown codes', () => {
    expect(errorMessageKey(error('SOMETHING_NEW'))).toBe('generic');
    expect(errorMessageKey(error(''))).toBe('generic');
  });
});

describe('error messages coverage', () => {
  // A missing translation would surface a raw code to the user, so every
  // stable code must exist in both locales.
  it.each([
    ['en', enMessages],
    ['uk', ukMessages],
  ])('%s translates every error code plus the generic fallback', (_locale, messages) => {
    const errors = (messages as { errors: Record<string, string> }).errors;
    for (const code of [...AUTH_ERROR_CODES, ...BUSINESS_ERROR_CODES, 'generic']) {
      expect(errors[code]).toBeTruthy();
    }
  });
});
