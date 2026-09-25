'use client';

import { useTranslations } from 'next-intl';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import type { PackageFormat } from '../use-package-format';
import {
  CreditsCell,
  PaymentCell,
  useDirectionLine,
  WindowCell,
  type ListPackage,
} from './package-cells';

/**
 * A package on phones (board 04, phone): the student and direction with the
 * price, the credits with the window, and the payment on its own line. The
 * whole card opens the ticket.
 */
export function PackageCard({
  pkg,
  now,
  threshold,
  format,
  onOpen,
}: {
  pkg: ListPackage;
  now: Date;
  threshold: number;
  format: PackageFormat;
  onOpen: () => void;
}) {
  const t = useTranslations('packages.list');
  const line = useDirectionLine();
  return (
    <article className="relative flex flex-col gap-3 rounded-card bg-card p-5">
      <div className="flex items-start gap-3">
        <EntityAvatar avatarKey={pkg.student.avatarKey} fullName={pkg.student.fullName} size="md" />
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <button
            type="button"
            onClick={onOpen}
            aria-label={t('open', { name: pkg.student.fullName })}
            className="truncate text-left text-base font-semibold outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:outline-2 focus-visible:after:outline-ring"
          >
            {pkg.student.fullName}
          </button>
          <span className="truncate text-[13px] text-muted-foreground">{line(pkg)}</span>
        </div>
        <span className="shrink-0 text-base font-bold tabular-nums">
          {format.money(pkg.totalPriceMinorSnapshot, pkg.currency)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <CreditsCell pkg={pkg} now={now} threshold={threshold} />
        <WindowCell pkg={pkg} now={now} threshold={threshold} format={format} />
      </div>
      <PaymentCell pkg={pkg} format={format} />
    </article>
  );
}
