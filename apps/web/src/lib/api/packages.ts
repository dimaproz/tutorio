'use client';

import {
  queryOptions,
  useMutation,
  usePrefetchQuery,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type {
  AdjustBalanceDto,
  CreatePackageDto,
  CreditLedgerResponse,
  PackageListResponse,
  PackageResponse,
  PaymentListResponse,
  PaymentResponse,
  RecordPaymentDto,
} from '@tutorio/validation';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';
import { buildQueryString } from './filters';
import { queryKeys, type PackageListFilters, type PaymentListFilters } from './keys';

// Money moves as a graph: a payment changes a package, a package change moves a
// balance, and both leave an audit trail — so any mutation refreshes all three.
function invalidateFinanceGraph(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.packages.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
  // The audit log lives on the settings page: mark it stale, read it when shown.
  void queryClient.invalidateQueries({ queryKey: queryKeys.audit.all, refetchType: 'none' });
  // Booking a package provisions lessons.
  void queryClient.invalidateQueries({ queryKey: queryKeys.lessons.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.series.all });
  // Group rows and the collection metrics say which groups owe money.
  void queryClient.invalidateQueries({ queryKey: queryKeys.groups.listsAll });
  void queryClient.invalidateQueries({ queryKey: queryKeys.groups.summary });
}

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
    queryFn: ({ signal }) =>
      gatewayFetch<PackageListResponse>(
        `/api/backend/packages${buildQueryString({
          page: filters.page,
          pageSize: filters.pageSize,
          studentId: filters.studentId,
          groupId: filters.groupId,
          paymentStatus: filters.paymentStatus,
          state: filters.state,
        })}`,
        { signal },
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
    queryFn: async ({ signal }) => {
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
          { signal },
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
    queryFn: ({ signal }) =>
      gatewayFetch<PackageResponse>(`/api/backend/packages/${packageId}`, { signal }),
  });
}

/** The "why is the balance this" history. */
export function usePackageLedgerQuery(packageId: string, enabled = true) {
  return useQuery<CreditLedgerResponse, GatewayError>({
    queryKey: queryKeys.packages.ledger(packageId),
    enabled: enabled && Boolean(packageId),
    queryFn: ({ signal }) =>
      gatewayFetch<CreditLedgerResponse>(`/api/backend/packages/${packageId}/ledger`, { signal }),
  });
}

export function useCreatePackageMutation() {
  const queryClient = useQueryClient();
  return useMutation<PackageResponse, GatewayError, { dto: CreatePackageDto; force?: boolean }>({
    mutationFn: ({ dto, force = false }) =>
      gatewayFetch<PackageResponse>(`/api/backend/packages?force=${force}`, {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidateFinanceGraph(queryClient),
  });
}

export function useAdjustBalanceMutation() {
  const queryClient = useQueryClient();
  return useMutation<PackageResponse, GatewayError, { packageId: string; dto: AdjustBalanceDto }>({
    mutationFn: ({ packageId, dto }) =>
      gatewayFetch<PackageResponse>(`/api/backend/packages/${packageId}/adjust`, {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidateFinanceGraph(queryClient),
  });
}

export function useDeletePackageMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, GatewayError, string>({
    mutationFn: (packageId) =>
      gatewayFetch<void>(`/api/backend/packages/${packageId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => invalidateFinanceGraph(queryClient),
  });
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export function usePaymentsQuery(filters: PaymentListFilters, enabled = true) {
  return useQuery<PaymentListResponse, GatewayError>({
    queryKey: queryKeys.payments.lists(filters),
    enabled,
    queryFn: ({ signal }) =>
      gatewayFetch<PaymentListResponse>(
        `/api/backend/payments${buildQueryString({
          page: filters.page,
          pageSize: filters.pageSize,
          enrollmentId: filters.enrollmentId,
          packageId: filters.packageId,
          studentId: filters.studentId,
        })}`,
        { signal },
      ),
    placeholderData: (previous) => previous,
  });
}

export function useRecordPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation<PaymentResponse, GatewayError, RecordPaymentDto>({
    mutationFn: (dto) =>
      gatewayFetch<PaymentResponse>('/api/backend/payments', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidateFinanceGraph(queryClient),
  });
}
