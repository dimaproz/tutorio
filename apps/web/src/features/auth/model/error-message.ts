import { AUTH_ERROR_CODES } from '@tutorio/validation';
import type { GatewayError } from '@/lib/auth/client';

const KNOWN_CODES = new Set<string>(AUTH_ERROR_CODES);

export function authErrorMessageKey(error: GatewayError): string {
  return KNOWN_CODES.has(error.code) ? error.code : 'generic';
}
