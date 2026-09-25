'use client';

import { useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUpdateSearchParams } from '@/components/shared/list-controls';

/** The query parameter that opens a package's ticket over a page (S07 decision 4). */
export const PACKAGE_PARAM = 'package';

/**
 * The ticket modal's own URL: `?package=<id>` over the «Пакети» page or the
 * student profile, so a package can be linked to and the page stays under
 * it (there is no package page). The ticket opens at once and the URL
 * follows; a URL that changes on its own (back, forward, a link) wins again.
 */
export function usePackageTicket() {
  const updateParams = useUpdateSearchParams();
  const params = useSearchParams();
  const fromUrl = params.get(PACKAGE_PARAM);
  const [state, setState] = useState<{ url: string | null; packageId: string | null }>({
    url: fromUrl,
    packageId: fromUrl,
  });
  if (state.url !== fromUrl) setState({ url: fromUrl, packageId: fromUrl });

  const open = useCallback(
    (id: string) => {
      setState((current) => ({ ...current, packageId: id }));
      updateParams({ [PACKAGE_PARAM]: id });
    },
    [updateParams],
  );
  const close = useCallback(() => {
    setState((current) => ({ ...current, packageId: null }));
    updateParams({ [PACKAGE_PARAM]: undefined });
  }, [updateParams]);

  return { packageId: state.packageId, open, close };
}
