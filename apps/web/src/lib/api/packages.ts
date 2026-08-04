'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
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
  void queryClient.invalidateQueries({ queryKey: queryKeys.audit.all });
  // Booking a package provisions lessons.
  void queryClient.invalidateQueries({ queryKey: queryKeys.lessons.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.series.all });
}

// ---------------------------------------------------------------------------
// Packages
// ---------------------------------------------------------------------------

export function usePackagesQuery(filters: PackageListFilters, enabled = true) {
  return useQuery<PackageListResponse, GatewayError>({
    queryKey: queryKeys.packages.lists(filters),
    enabled,
    queryFn: () =>
      gatewayFetch<PackageListResponse>(
        `/api/backend/packages${buildQueryString({
          page: filters.page,
          pageSize: filters.pageSize,
          studentId: filters.studentId,
          groupId: filters.groupId,
          paymentStatus: filters.paymentStatus,
        })}`,
      ),
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

/** The "why is the balance this" history. */
export function usePackageLedgerQuery(packageId: string, enabled = true) {
  return useQuery<CreditLedgerResponse, GatewayError>({
    queryKey: queryKeys.packages.ledger(packageId),
    enabled: enabled && Boolean(packageId),
    queryFn: () => gatewayFetch<CreditLedgerResponse>(`/api/backend/packages/${packageId}/ledger`),
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
    queryFn: () =>
      gatewayFetch<PaymentListResponse>(
        `/api/backend/payments${buildQueryString({
          page: filters.page,
          pageSize: filters.pageSize,
          enrollmentId: filters.enrollmentId,
          packageId: filters.packageId,
          studentId: filters.studentId,
        })}`,
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
