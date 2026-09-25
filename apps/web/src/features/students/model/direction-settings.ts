import type { BillingTypeDto, UpdateEnrollmentDto } from '@tutorio/validation';
import { z } from 'zod';
import { priceString } from '@/lib/forms/helpers';
import { parsePriceInput } from '@/lib/money';
import type { BillingDirection } from './learning';

/** «Безкоштовне скасування» choices in hours; `studio` follows the studio (L-10). */
export const CANCELLATION_HOURS = [0, 2, 6, 12, 24, 48] as const;
export const STUDIO_DEADLINE = 'studio';

/**
 * «Налаштування напряму» (L-10, L-11): how the direction pays, its rate for
 * new lessons and its free-cancellation window.
 */
export const directionSettingsSchema = z.object({
  billingType: z.enum(['PACKAGE', 'PER_LESSON']),
  rate: priceString({ required: true }),
  deadline: z.string(),
});

export type DirectionSettingsValues = z.infer<typeof directionSettingsSchema>;

export function directionSettingsDefaults(direction: BillingDirection): DirectionSettingsValues {
  const rate = direction.rateMinor;
  return {
    billingType: direction.billingType,
    rate: rate % 100 === 0 ? String(rate / 100) : (rate / 100).toFixed(2),
    deadline:
      direction.cancellationDeadlineHours === null
        ? STUDIO_DEADLINE
        : String(direction.cancellationDeadlineHours),
  };
}

/** Only what changed, so an untouched field never rewrites the direction. */
export function directionSettingsDto(
  values: DirectionSettingsValues,
  direction: BillingDirection,
): UpdateEnrollmentDto {
  const priceMinor = parsePriceInput(values.rate) ?? direction.rateMinor;
  const deadline = values.deadline === STUDIO_DEADLINE ? null : Number(values.deadline);
  return {
    ...(values.billingType !== direction.billingType ? { billingType: values.billingType } : {}),
    ...(priceMinor !== direction.rateMinor ? { priceMinor } : {}),
    ...(deadline !== direction.cancellationDeadlineHours
      ? { cancellationDeadlineHours: deadline }
      : {}),
  };
}

/** The deadline choices, with the direction's own value when it is not a standard one. */
export function deadlineChoices(direction: BillingDirection): string[] {
  const hours: number[] = [...CANCELLATION_HOURS];
  const own = direction.cancellationDeadlineHours;
  if (own !== null && !hours.includes(own)) hours.push(own);
  return [STUDIO_DEADLINE, ...hours.sort((a, b) => a - b).map(String)];
}

/**
 * What switching the mode does (board 02, state 06): to per lesson, the
 * package stays and its credits are used first, new lessons cost the rate
 * once they run out; to packages, lessons are paid from a package and the
 * money owed stays money (L-91). Past lessons never change. Null while the
 * mode is unchanged.
 */
export function modeSwitchImpact(
  direction: BillingDirection,
  next: BillingTypeDto,
): { to: BillingTypeDto; creditsLeft: number; debtMinor: number } | null {
  if (next === direction.billingType) return null;
  return {
    to: next,
    creditsLeft: direction.creditsLeft,
    debtMinor: direction.balance.debtMinor,
  };
}
