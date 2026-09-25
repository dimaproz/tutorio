'use client';

import { queryOptions, usePrefetchQuery, useQuery } from '@tanstack/react-query';
import type { PackageListResponse, PackageResponse } from '@tutorio/validation';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';
import { buildQueryString } from './filters';
import { queryKeys, type PackageListFilters } from './keys';

// ---------------------------------------------------------------------------
// Packages
// ---------------------------------------------------------------------------

export function usePackagesQuery(filters: PackageListFilters, enabled = true) {
  return useQuery({
    ...packagesQueryOptions(filters),
    enabled,
    placeholderData: (previous) => previous,
  });
}

/** Starts a package page read during render without subscribing the caller to it. */
export function usePrefetchPackagesQuery(filters: PackageListFilters) {
  usePrefetchQuery(packagesQueryOptions(filters));
}

/** The package page read, shared by the hook and by a screen that prefetches it. */
export function packagesQueryOptions(filters: PackageListFilters) {
  return queryOptions<PackageListResponse, GatewayError>({
    queryKey: queryKeys.packages.lists(filters),
    queryFn: () =>
      gatewayFetch<PackageListResponse>(
        `/api/backend/packages${buildQueryString({
          page: filters.page,
          pageSize: filters.pageSize,
          studentId: filters.studentId,
          groupId: filters.groupId,
          paymentStatus: filters.paymentStatus,
          state: filters.state,
        })}`,
      ),
  });
}

/** The API's largest page; a larger `pageSize` is rejected with a 400. */
export const PACKAGE_PAGE_SIZE_MAX = 100;
/** Stop after this many pages so a runaway workspace cannot stall the page. */
const PACKAGE_PAGES_MAX = 20;

/**
 * Every package matching the filters, read page by page. Client-side
 * aggregates need the whole set; the response keeps the server's `total`, so
 * a caller can still tell when the page cap left the set incomplete.
 */
export function useAllPackagesQuery(
  filters: Omit<PackageListFilters, 'page' | 'pageSize'>,
  enabled = true,
) {
  return useQuery<PackageListResponse, GatewayError>({
    queryKey: queryKeys.packages.everything(filters),
    enabled,
    queryFn: async () => {
      const fetchPage = (page: number) =>
        gatewayFetch<PackageListResponse>(
          `/api/backend/packages${buildQueryString({
            page,
            pageSize: PACKAGE_PAGE_SIZE_MAX,
            studentId: filters.studentId,
            groupId: filters.groupId,
            paymentStatus: filters.paymentStatus,
            state: filters.state,
          })}`,
        );
      // The first page says how many there are; the rest are read at once.
      const first = await fetchPage(1);
      const lastPage = Math.min(first.totalPages, PACKAGE_PAGES_MAX);
      const rest = await Promise.all(
        Array.from({ length: Math.max(lastPage - 1, 0) }, (_, index) => fetchPage(index + 2)),
      );
      const items = [...first.items, ...rest.flatMap((page) => page.items)];
      return { ...first, items, page: 1, pageSize: items.length || PACKAGE_PAGE_SIZE_MAX };
    },
    placeholderData: (previous) => previous,
  });
}

export function usePackageQuery(packageId: string, enabled = true) {
  return useQuery<PackageResponse, GatewayError>({
    queryKey: queryKeys.packages.detail(packageId),
    enabled: enabled && Boolean(packageId),
    queryFn: () => gatewayFetch<PackageResponse>(`/api/backend/packages/${packageId}`),
  });
}
