import { afterEach, describe, expect, it, vi } from 'vitest';
import { gatewayFetch } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('gatewayFetch', () => {
  it('preserves typed-safe API error details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'SCHEDULE_CONFLICT',
            details: { conflictIds: ['lesson-1'], conflicts: [{ source: 'NEW_SLOT' }] },
          }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    await expect(gatewayFetch('/api/backend/packages')).rejects.toMatchObject({
      status: 409,
      code: 'SCHEDULE_CONFLICT',
      details: {
        conflictIds: ['lesson-1'],
        conflicts: [{ source: 'NEW_SLOT' }],
      },
    });
  });
});
