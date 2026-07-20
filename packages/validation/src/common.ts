import { SUPPORTED_CURRENCIES } from '@tutorio/domain';
import { z } from 'zod';

// Shared Stage 2 primitives reused across student/group/enrollment contracts.

export const uuidSchema = z.string().uuid();

export const currencyCodeSchema = z.enum(SUPPORTED_CURRENCIES);
export type CurrencyCodeDto = z.infer<typeof currencyCodeSchema>;

// Non-negative decimal money string ("12.30", "0.5", "1500"); the API converts
// it to minor units via @tutorio/domain decimalStringToMinorUnits.
export const moneyDecimalStringSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, 'Expected a non-negative decimal with up to 2 decimal places')
  .max(20);

// Amounts leave the API only as integers in minor units.
export const amountMinorSchema = z.number().int().nonnegative();

// Hours before the lesson start; two weeks is the maximum sensible window.
export const cancellationDeadlineHoursSchema = z.number().int().min(0).max(336);

// Soft-delete visibility filter for list endpoints. Non-`active` states are
// OWNER-only (enforced by feature services).
export const recordStateSchema = z.enum(['active', 'deleted', 'all']);
export type RecordStateDto = z.infer<typeof recordStateSchema>;

// IANA timezone identifier, verified against the runtime timezone database.
export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(
    (value) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Invalid IANA timezone' },
  );

export const isoDateTimeSchema = z.string().datetime();

export const notesSchema = z.string().trim().max(2000);

export const phoneSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^\+?[\d ()-]+$/, 'Invalid phone number');

// ---------------------------------------------------------------------------
// Stable machine-readable business error codes (Stage 2)
// ---------------------------------------------------------------------------

export const BUSINESS_ERROR_CODES = [
  'STUDENT_NOT_FOUND',
  'GROUP_NOT_FOUND',
  'ENROLLMENT_NOT_FOUND',
  'WORKSPACE_MEMBER_NOT_FOUND',
  'ACTIVE_ENROLLMENTS_EXIST',
  'DUPLICATE_ENROLLMENT',
  'INVALID_WORKSPACE_RELATION',
  'INVALID_MONEY_AMOUNT',
  'FORBIDDEN',
  'UNEXPECTED',
] as const;

export const businessErrorCodeSchema = z.enum(BUSINESS_ERROR_CODES);

export type BusinessErrorCode = z.infer<typeof businessErrorCodeSchema>;
