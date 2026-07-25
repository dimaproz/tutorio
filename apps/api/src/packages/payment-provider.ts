/**
 * How money reaches the workspace. The MVP records payments the tutor already
 * received (cash, bank transfer) — Tutorio never holds anyone's money.
 *
 * The interface exists now so adding an online provider later is an
 * implementation, not a refactor of the payments module.
 */
export interface PaymentIntent {
  workspaceId: string;
  enrollmentId: string;
  amountMinor: number;
  currency: string;
}

export interface PaymentSettlement {
  /** Whether the money is already in hand at the moment of recording. */
  settled: boolean;
  /** Provider-side reference, if any. */
  externalId?: string;
}

export interface PaymentProvider {
  readonly kind: string;
  settle(intent: PaymentIntent): Promise<PaymentSettlement>;
}

/** The only provider in the MVP: the tutor got paid, we write it down. */
export class ManualPaymentProvider implements PaymentProvider {
  readonly kind = 'manual';

  // The intent carries no work for a manual payment: the money already
  // changed hands, so settling is simply acknowledging it.
  settle(): Promise<PaymentSettlement> {
    return Promise.resolve({ settled: true });
  }
}
