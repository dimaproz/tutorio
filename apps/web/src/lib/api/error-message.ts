import { AUTH_ERROR_CODES, BUSINESS_ERROR_CODES } from '@tutorio/validation';
import type { GatewayError } from '@/lib/auth/client';

const KNOWN_CODES = new Set<string>([...AUTH_ERROR_CODES, ...BUSINESS_ERROR_CODES]);

// API error codes are stable and never localized; the UI maps them to
// translated messages under `errors.*`, falling back to a generic one.
export function errorMessageKey(error: GatewayError): string {
  return KNOWN_CODES.has(error.code) ? error.code : 'generic';
}
