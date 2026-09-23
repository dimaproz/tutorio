import { describe, expect, it } from 'vitest';
import { GatewayError } from '@/lib/auth/client';
import { shouldRetryQuery } from './query-retry';

describe('shouldRetryQuery', () => {
  it('never retries an answer the API gave on purpose', () => {
    for (const status of [400, 401, 403, 404, 409, 422]) {
      expect(shouldRetryQuery(0, new GatewayError(status, 'X'))).toBe(false);
    }
  });

  it('retries a server or network failure once', () => {
    expect(shouldRetryQuery(0, new GatewayError(502, 'UNEXPECTED'))).toBe(true);
    expect(shouldRetryQuery(0, new TypeError('Failed to fetch'))).toBe(true);
    expect(shouldRetryQuery(1, new GatewayError(502, 'UNEXPECTED'))).toBe(false);
  });
});
