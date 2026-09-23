import {
  GATEWAY_SECRET_HEADER,
  resolveThrottleTracker,
  type ThrottleTrackerRequest,
} from './client-throttler.guard';

const SECRET = 'gateway-shared-secret-0123456789';

function request(
  overrides: Partial<ThrottleTrackerRequest> = {},
): ThrottleTrackerRequest {
  return { headers: {}, ip: '10.0.0.5', ...overrides };
}

describe('resolveThrottleTracker', () => {
  it('keys authenticated traffic on the session, ignoring addresses', () => {
    const tracker = resolveThrottleTracker(
      request({
        headers: {
          'x-forwarded-for': '203.0.113.7',
          [GATEWAY_SECRET_HEADER]: SECRET,
        },
        user: {
          userId: 'user-1',
          sessionId: 'session-1',
          workspaceId: 'workspace-1',
          role: 'OWNER',
        },
      }),
      { gatewaySecret: SECRET, production: true },
    );
    expect(tracker).toBe('user:session-1');
  });

  it('gives two sessions behind the same gateway separate buckets', () => {
    const base = { workspaceId: 'w', role: 'OWNER' as const };
    const options = { production: true };
    const a = resolveThrottleTracker(
      request({ user: { ...base, userId: 'u1', sessionId: 's1' } }),
      options,
    );
    const b = resolveThrottleTracker(
      request({ user: { ...base, userId: 'u2', sessionId: 's2' } }),
      options,
    );
    expect(a).not.toBe(b);
  });

  it('uses the forwarded client address when the gateway secret matches', () => {
    const tracker = resolveThrottleTracker(
      request({
        headers: {
          'x-forwarded-for': '203.0.113.7, 10.0.0.1',
          [GATEWAY_SECRET_HEADER]: SECRET,
        },
      }),
      { gatewaySecret: SECRET, production: true },
    );
    expect(tracker).toBe('ip:203.0.113.7');
  });

  it('ignores a forwarded address with a wrong or missing secret', () => {
    const options = { gatewaySecret: SECRET, production: false };
    expect(
      resolveThrottleTracker(
        request({
          headers: {
            'x-forwarded-for': '203.0.113.7',
            [GATEWAY_SECRET_HEADER]: 'wrong',
          },
        }),
        options,
      ),
    ).toBe('ip:10.0.0.5');
    expect(
      resolveThrottleTracker(
        request({ headers: { 'x-forwarded-for': '203.0.113.7' } }),
        options,
      ),
    ).toBe('ip:10.0.0.5');
  });

  it('trusts an unsigned forwarded address only outside production', () => {
    const req = request({ headers: { 'x-forwarded-for': '203.0.113.7' } });
    expect(resolveThrottleTracker(req, { production: false })).toBe(
      'ip:203.0.113.7',
    );
    expect(resolveThrottleTracker(req, { production: true })).toBe(
      'ip:10.0.0.5',
    );
  });

  it('falls back to the socket address without a forwarded header', () => {
    expect(
      resolveThrottleTracker(request(), {
        gatewaySecret: SECRET,
        production: true,
      }),
    ).toBe('ip:10.0.0.5');
  });
});
