/** What a charge of this lesson would take, for the hints of the cancel and status dialogs. */
export type ChargeContext =
  | { kind: 'package'; name: string; remaining: number; total: number }
  | { kind: 'money'; amount: string }
  | { kind: 'group' };
