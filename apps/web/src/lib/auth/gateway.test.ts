import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as loginPost } from '@/app/api/auth/login/route';
import { POST as refreshPost } from '@/app/api/auth/refresh/route';
import { POST as logoutPost } from '@/app/api/auth/logout/route';
import { GET as backendGet } from '@/app/api/backend/[...path]/route';
import { proxy } from '@/proxy';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './cookies';

const SESSION_PAYLOAD = {
  tokens: { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' },
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'olena@example.com',
    name: 'Olena',
  },
  workspace: {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'SpeakWise',
    plan: 'FREE',
    defaultCurrency: 'EUR',
    cancellationDeadlineHours: 24,
  },
  role: 'OWNER',
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeRequest(
  url: string,
  init: {
    method?: string;
    body?: unknown;
    cookies?: Record<string, string>;
    origin?: string;
  } = {},
): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json', host: 'localhost:3000' });
  if (init.origin) {
    headers.set('origin', init.origin);
  }
  if (init.cookies) {
    headers.set(
      'cookie',
      Object.entries(init.cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; '),
    );
  }
  return new NextRequest(`http://localhost:3000${url}`, {
    method: init.method ?? 'POST',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

describe('POST /api/auth/login', () => {
  const credentials = { email: 'olena@example.com', password: 'correct horse battery' };

  it('sets HttpOnly Lax cookies for both tokens and strips them from the body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SESSION_PAYLOAD));

    const response = await loginPost(makeRequest('/api/auth/login', { body: credentials }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      user: SESSION_PAYLOAD.user,
      workspace: SESSION_PAYLOAD.workspace,
      role: 'OWNER',
    });
    expect(JSON.stringify(body)).not.toContain('accessToken');

    const access = response.cookies.get(ACCESS_COOKIE);
    const refresh = response.cookies.get(REFRESH_COOKIE);
    expect(access).toMatchObject({
      value: 'new-access-token',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    });
    expect(refresh).toMatchObject({
      value: 'new-refresh-token',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
  });

  it('marks cookies Secure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SESSION_PAYLOAD));

    const response = await loginPost(makeRequest('/api/auth/login', { body: credentials }));
    expect(response.cookies.get(ACCESS_COOKIE)).toMatchObject({ secure: true });
    expect(response.cookies.get(REFRESH_COOKIE)).toMatchObject({ secure: true });
    vi.unstubAllEnvs();
  });

  it('passes through upstream error codes without setting cookies', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'nope' }),
    );

    const response = await loginPost(makeRequest('/api/auth/login', { body: credentials }));
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('INVALID_CREDENTIALS');
    expect(response.cookies.get(ACCESS_COOKIE)).toBeUndefined();
  });

  it('rejects cross-origin requests before contacting the API', async () => {
    const response = await loginPost(
      makeRequest('/api/auth/login', { body: credentials, origin: 'https://evil.example' }),
    );
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid payloads before contacting the API', async () => {
    const response = await loginPost(
      makeRequest('/api/auth/login', { body: { email: 'not-an-email', password: '' } }),
    );
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/refresh', () => {
  it('clears both cookies and normalizes to 401 when the rotation fails', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { statusCode: 401, code: 'INVALID_REFRESH_TOKEN', message: 'nope' }),
    );

    const response = await refreshPost(
      makeRequest('/api/auth/refresh', { cookies: { [REFRESH_COOKIE]: 'stale-token' } }),
    );

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('SESSION_EXPIRED');
    expect(response.cookies.get(ACCESS_COOKIE)).toMatchObject({ value: '', maxAge: 0 });
    expect(response.cookies.get(REFRESH_COOKIE)).toMatchObject({ value: '', maxAge: 0 });
  });

  it('rotates cookies on success', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SESSION_PAYLOAD));

    const response = await refreshPost(
      makeRequest('/api/auth/refresh', { cookies: { [REFRESH_COOKIE]: 'old-refresh' } }),
    );

    expect(response.status).toBe(200);
    expect(response.cookies.get(ACCESS_COOKIE)).toMatchObject({ value: 'new-access-token' });
    expect(response.cookies.get(REFRESH_COOKIE)).toMatchObject({ value: 'new-refresh-token' });
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes upstream and clears cookies with 204', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const response = await logoutPost(
      makeRequest('/api/auth/logout', { cookies: { [REFRESH_COOKIE]: 'some-refresh' } }),
    );

    expect(response.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.cookies.get(ACCESS_COOKIE)).toMatchObject({ value: '', maxAge: 0 });
    expect(response.cookies.get(REFRESH_COOKIE)).toMatchObject({ value: '', maxAge: 0 });
  });

  it('still clears cookies without a refresh cookie', async () => {
    const response = await logoutPost(makeRequest('/api/auth/logout', {}));
    expect(response.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.cookies.get(REFRESH_COOKIE)).toMatchObject({ value: '', maxAge: 0 });
  });
});

describe('GET /api/backend/[...path]', () => {
  const ctx = { params: Promise.resolve({ path: ['auth', 'me'] }) };
  const ME_PAYLOAD = {
    user: SESSION_PAYLOAD.user,
    workspace: SESSION_PAYLOAD.workspace,
    role: 'OWNER',
  };

  it('forwards with the access token from the cookie', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, ME_PAYLOAD));

    const response = await backendGet(
      makeRequest('/api/backend/auth/me', {
        method: 'GET',
        cookies: { [ACCESS_COOKIE]: 'valid-access', [REFRESH_COOKIE]: 'valid-refresh' },
      }),
      ctx,
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target, init] = fetchMock.mock.calls[0];
    expect(String(target)).toContain('/auth/me');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer valid-access');
  });

  it('on 401 refreshes once, retries once and rotates cookies', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { code: 'SESSION_EXPIRED' })) // original
      .mockResolvedValueOnce(jsonResponse(200, SESSION_PAYLOAD)) // refresh rotation
      .mockResolvedValueOnce(jsonResponse(200, ME_PAYLOAD)); // retried original

    const response = await backendGet(
      makeRequest('/api/backend/auth/me', {
        method: 'GET',
        cookies: { [ACCESS_COOKIE]: 'expired-access', [REFRESH_COOKIE]: 'valid-refresh' },
      }),
      ctx,
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retryHeaders = new Headers(fetchMock.mock.calls[2][1].headers);
    expect(retryHeaders.get('authorization')).toBe('Bearer new-access-token');
    expect(response.cookies.get(ACCESS_COOKIE)).toMatchObject({ value: 'new-access-token' });
    expect(response.cookies.get(REFRESH_COOKIE)).toMatchObject({ value: 'new-refresh-token' });
  });

  it('never retries more than once even if the retry also fails', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { code: 'SESSION_EXPIRED' }))
      .mockResolvedValueOnce(jsonResponse(200, SESSION_PAYLOAD))
      .mockResolvedValueOnce(jsonResponse(401, { code: 'SESSION_EXPIRED' }));

    const response = await backendGet(
      makeRequest('/api/backend/auth/me', {
        method: 'GET',
        cookies: { [ACCESS_COOKIE]: 'expired-access', [REFRESH_COOKIE]: 'valid-refresh' },
      }),
      ctx,
    );

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('clears cookies and returns 401 when the refresh rotation fails', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { code: 'SESSION_EXPIRED' }))
      .mockResolvedValueOnce(jsonResponse(401, { code: 'INVALID_REFRESH_TOKEN' }));

    const response = await backendGet(
      makeRequest('/api/backend/auth/me', {
        method: 'GET',
        cookies: { [ACCESS_COOKIE]: 'expired-access', [REFRESH_COOKIE]: 'stale-refresh' },
      }),
      ctx,
    );

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('SESSION_EXPIRED');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.cookies.get(ACCESS_COOKIE)).toMatchObject({ value: '', maxAge: 0 });
    expect(response.cookies.get(REFRESH_COOKIE)).toMatchObject({ value: '', maxAge: 0 });
  });

  it('returns 401 without contacting the API when no cookies exist', async () => {
    const response = await backendGet(
      makeRequest('/api/backend/auth/me', { method: 'GET' }),
      ctx,
    );
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects path traversal segments', async () => {
    const response = await backendGet(
      makeRequest('/api/backend/auth/me', {
        method: 'GET',
        cookies: { [ACCESS_COOKIE]: 'valid-access' },
      }),
      { params: Promise.resolve({ path: ['..', 'internal'] }) },
    );
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('proxy (optimistic redirects)', () => {
  it('redirects anonymous /app visits to /login', () => {
    const response = proxy(makeRequest('/app', { method: 'GET' }));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('redirects authenticated /login visits to /app', () => {
    const response = proxy(
      makeRequest('/login', { method: 'GET', cookies: { [REFRESH_COOKIE]: 'token' } }),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/app');
  });

  it('lets authenticated /app visits and anonymous /login visits through', () => {
    const authed = proxy(
      makeRequest('/app', { method: 'GET', cookies: { [REFRESH_COOKIE]: 'token' } }),
    );
    expect(authed.headers.get('location')).toBeNull();

    const anonymous = proxy(makeRequest('/login', { method: 'GET' }));
    expect(anonymous.headers.get('location')).toBeNull();
  });
});
