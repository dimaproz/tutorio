import 'server-only';
import { cookies } from 'next/headers';
import { authMeSchema, type AuthMe } from '@tutorio/validation';
import { ACCESS_COOKIE } from './cookies';
import { apiUrl } from './gateway';

/** A slow API must not hold the page: the client can still ask on its own. */
const SERVER_SESSION_TIMEOUT_MS = 2_500;

/**
 * The session as the server sees it on a full page load, read with the access
 * cookie exactly as the gateway calls the API. It seeds the client session
 * query so the protected shell renders without waiting for a browser round
 * trip to /auth/me.
 *
 * Anything but a clean answer (no cookie, an expired or rejected token, an API
 * that is down or slow) returns null and the client falls back to asking
 * /api/backend/auth/me, which also rotates an expired token. The server never
 * refreshes: a layout cannot set the rotated cookies.
 */
export async function readServerSession(): Promise<AuthMe | null> {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!accessToken) return null;
  try {
    const response = await fetch(apiUrl('/auth/me'), {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(SERVER_SESSION_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const parsed = authMeSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
