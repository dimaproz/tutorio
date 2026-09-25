import type { PackageResponse } from '@tutorio/validation';

/** What every operation dialog over the ticket takes. */
export type OperationProps = {
  pkg: PackageResponse;
  /** The package's name as the ticket shows it. */
  title: string;
  onClose: () => void;
  /** After a success: back to the ticket, which shows the new values (decision 6). */
  onDone: () => void;
};
