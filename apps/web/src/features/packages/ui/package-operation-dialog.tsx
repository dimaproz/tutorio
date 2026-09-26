'use client';

import { usePackageDetailQuery } from '../api';
import { ExtendDialog } from './operations/extend-dialog';
import { PackagePaymentDialog } from './operations/payment-dialog';
import { usePackageTitle } from './use-package-title';

/**
 * One package operation from outside the ticket (the Today page, S11):
 * «Записати оплату» on a sold package, or «Подовжити» on one that would
 * expire unused. The dialog opens once the package is read.
 */
export function PackageOperationDialog({
  packageId,
  operation,
  onClose,
}: {
  packageId: string;
  operation: 'pay' | 'extend';
  onClose: () => void;
}) {
  const detail = usePackageDetailQuery(packageId);
  const titleOf = usePackageTitle();
  if (!detail.data) return null;
  const props = { pkg: detail.data, title: titleOf(detail.data), onClose, onDone: onClose };
  return operation === 'pay' ? <PackagePaymentDialog {...props} /> : <ExtendDialog {...props} />;
}
