import { GatewayError } from '@/lib/auth/client';

/**
 * The default query retry: once, for a failure that may pass (the network, a
 * 5xx). A 4xx answer is the API's final word — asking again only doubles the
 * request and delays the error the screen has to show.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof GatewayError && error.status < 500) return false;
  return failureCount < 1;
}
