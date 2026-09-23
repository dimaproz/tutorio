import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_COOKIE } from './cookies';

const cookieJar = new Map<string, string>();

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
  }),
}));

const { readServerSession } = await import('./server-session');

const SESSION = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'olena@example.com',
    name: 'Olena',
  },
  workspace: {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'SpeakWise',
    plan: 'FREE',
    mode: 'SOLO',
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
  cookieJar.clear();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('readServerSession', () => {
  it('asks the API with the access cookie and returns the safe session', async () => {
    cookieJar.set(ACCESS_COOKIE, 'access-token');
    fetchMock.mockResolvedValue(new Response(JSON.stringify(SESSION), { status: 200 }));

    await expect(readServerSession()).resolves.toEqual(SESSION);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/me$/);
    expect(init.headers).toEqual({ authorization: 'Bearer access-token' });
  });

  it('leaves the check to the client without an access cookie', async () => {
    await expect(readServerSession()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves the check to the client when the token is rejected or the API fails', async () => {
    cookieJar.set(ACCESS_COOKIE, 'expired-token');
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(readServerSession()).resolves.toBeNull();

    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(readServerSession()).resolves.toBeNull();

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ user: null }), { status: 200 }));
    await expect(readServerSession()).resolves.toBeNull();
  });
});
