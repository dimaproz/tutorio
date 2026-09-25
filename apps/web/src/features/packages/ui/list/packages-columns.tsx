'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import type { PackageFormat } from '../use-package-format';
import {
  CreditsCell,
  KindCell,
  PaymentCell,
  PriceCell,
  WhoCell,
  WindowCell,
  type ListPackage,
} from './package-cells';
import { PackageRowMenu, type RowAction } from './package-row-menu';

/** Student and direction, kind, lessons, window, payment, price, ⋯ (board 04). */
export const PACKAGES_ROW_LAYOUT = 'minmax(0,1.5fr) 100px 190px 100px 150px 84px 24px';

/** The «Пакети» table's columns (S07 board 04). */
export function usePackagesColumns({
  now,
  threshold,
  format,
  onAction,
}: {
  now: Date;
  threshold: number;
  format: PackageFormat;
  onAction: (action: RowAction, pkg: ListPackage) => void;
}) {
  const t = useTranslations('packages.list.columns');
  return useMemo<ColumnDef<ListPackage, unknown>[]>(
    () => [
      {
        id: 'who',
        header: () => t('who'),
        cell: ({ row }) => (
          <WhoCell pkg={row.original} onOpen={() => onAction('open', row.original)} />
        ),
      },
      { id: 'kind', header: () => t('kind'), cell: ({ row }) => <KindCell pkg={row.original} /> },
      {
        id: 'credits',
        header: () => t('credits'),
        cell: ({ row }) => <CreditsCell pkg={row.original} now={now} threshold={threshold} />,
      },
      {
        id: 'window',
        header: () => t('window'),
        cell: ({ row }) => (
          <WindowCell pkg={row.original} now={now} threshold={threshold} format={format} />
        ),
      },
      {
        id: 'payment',
        header: () => t('payment'),
        cell: ({ row }) => <PaymentCell pkg={row.original} format={format} />,
      },
      {
        id: 'price',
        header: () => <span className="block text-right">{t('price')}</span>,
        cell: ({ row }) => <PriceCell pkg={row.original} format={format} />,
      },
      {
        id: 'menu',
        header: () => <span className="sr-only">{t('actions')}</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <PackageRowMenu pkg={row.original} onAction={onAction} />
          </div>
        ),
      },
    ],
    [format, now, onAction, t, threshold],
  );
}
