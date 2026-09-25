'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { packageTitle, type PackageTitle } from '../model/names';
import { usePackageFormat } from './use-package-format';

/** Names a package: its own name, else «Пакет на 8 занять» or «Пакет 1–31 жовт.». */
export function usePackageTitle() {
  const t = useTranslations('packages.title');
  const format = usePackageFormat();
  return useCallback(
    (title: PackageTitle | Parameters<typeof packageTitle>[0]) => {
      const resolved = 'kind' in title ? title : packageTitle(title);
      if (resolved.kind === 'named') return resolved.name;
      if (resolved.kind === 'count') return t('count', { count: resolved.lessons });
      return t('period', { range: format.shortRange(resolved.from, resolved.lastDay) });
    },
    [format, t],
  );
}
