import Link from 'next/link';
import type { PackageResponse } from '@tutorio/validation';
import { useLocale, useTranslations } from 'next-intl';
import { PackagePaymentStatusBadge } from '@/components/app/status-badges';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useDateFormatters } from '@/lib/i18n/format';
import { formatMoneyDisplay } from '@/lib/money';

/** A concise package state card for sidebars and entity detail pages. */
export function PackageSummaryCard({ package: pkg }: { package: PackageResponse }) {
  const t = useTranslations('packages.card');
  const locale = useLocale();
  const format = useDateFormatters();
  const used = Math.max(0, pkg.consumedCredits);
  const progress = pkg.lessonsTotal > 0 ? Math.min(100, (used / pkg.lessonsTotal) * 100) : 0;
  const owner = pkg.student?.fullName ?? pkg.group?.name;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="truncate text-sm">
          <Link href={`/app/packages/${pkg.id}`} className="hover:text-primary">
            {pkg.name ?? t('remaining')}
          </Link>
        </CardTitle>
        {owner ? <CardDescription className="truncate">{owner}</CardDescription> : null}
        <CardAction>
          <PackagePaymentStatusBadge status={pkg.paymentStatus} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Progress value={progress} />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{t('of', { total: pkg.lessonsTotal })}</span>
            <span className="tabular">{used}</span>
          </div>
        </div>
        <div className="flex items-end justify-between gap-3 text-xs text-muted-foreground">
          <span>{pkg.expiresAt ? format.dayMonth(pkg.expiresAt) : '—'}</span>
          <span className="tabular font-semibold text-foreground">
            {formatMoneyDisplay(pkg.effectiveTotalMinor, pkg.currency, locale)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
