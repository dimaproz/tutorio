'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type {
  AdjustBalanceDto,
  CreatePackageDto,
  CreditLedgerResponse,
  ExtendPackageDto,
  MemberSalePreviewResponse,
  PackageDetailResponse,
  PackageListResponse,
  PackagePreviewResponse,
  PackageResponse,
  PackageTransferResponse,
  PaymentListResponse,
  PaymentResponse,
  RecordPaymentDto,
  RefundPackageDto,
  ScheduleListResponse,
  SellToMembersDto,
  SoldPackagesResponse,
  StudentBillingResponse,
  TransferPackageDto,
} from '@tutorio/validation';
import { buildQueryString, type FilterValue } from '@/lib/api/filters';
import { queryKeys } from '@/lib/api/keys';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';

export { useGroupOptionsQuery } from '@/lib/api/groups';
export { useStudentQuery, useStudentsQuery } from '@/lib/api/students';
export { useTeachersQuery } from '@/lib/api/teachers';

/**
 * A package change moves credits, money and the lessons they pay for, so
 * everything that shows them refreshes: the packages and payments, the
 * students (their billing), the directions, the lessons, the groups; the
 * audit trail is marked stale.
 */
export function invalidatePackageGraph(queryClient: QueryClient) {
  for (const queryKey of [
    queryKeys.packages.all,
    queryKeys.payments.all,
    queryKeys.students.all,
    queryKeys.enrollments.all,
    queryKeys.lessons.all,
    queryKeys.groups.all,
  ]) {
    void queryClient.invalidateQueries({ queryKey });
  }
  void queryClient.invalidateQueries({ queryKey: queryKeys.audit.all, refetchType: 'none' });
}

/** The «Пакети» page read (S07 board 04): a page, every tab's count and what is owed. */
export function usePackagePageQuery(query: Record<string, FilterValue>) {
  return useQuery<PackageListResponse, GatewayError>({
    queryKey: [...queryKeys.packages.all, 'page', query],
    placeholderData: keepPreviousData,
    queryFn: () =>
      gatewayFetch<PackageListResponse>(`/api/backend/packages${buildQueryString(query)}`),
  });
}

/** The ticket (S07 board 02): the package with the one ahead and its pause extensions. */
export function usePackageDetailQuery(packageId: string | null) {
  return useQuery<PackageDetailResponse, GatewayError>({
    queryKey: queryKeys.packages.detail(packageId ?? ''),
    enabled: Boolean(packageId),
    queryFn: () => gatewayFetch<PackageDetailResponse>(`/api/backend/packages/${packageId}`),
  });
}

/** Its credit history with the lesson behind each charge. */
export function usePackageLedgerQuery(packageId: string | null) {
  return useQuery<CreditLedgerResponse, GatewayError>({
    queryKey: queryKeys.packages.ledger(packageId ?? ''),
    enabled: Boolean(packageId),
    queryFn: () => gatewayFetch<CreditLedgerResponse>(`/api/backend/packages/${packageId}/ledger`),
  });
}

/** The money in and back for one package. */
export function usePackagePaymentsQuery(packageId: string | null) {
  return useQuery<PaymentListResponse, GatewayError>({
    queryKey: [...queryKeys.payments.all, 'package', packageId],
    enabled: Boolean(packageId),
    queryFn: () =>
      gatewayFetch<PaymentListResponse>(
        `/api/backend/payments${buildQueryString({ packageId: packageId ?? undefined, page: 1, pageSize: 100 })}`,
      ),
  });
}

/** A student's directions with how each is paid (the S06 read): the sale's and a transfer's targets. */
export function useStudentDirectionsQuery(studentId: string | null) {
  return useQuery<StudentBillingResponse, GatewayError>({
    queryKey: queryKeys.students.billing(studentId ?? ''),
    enabled: Boolean(studentId),
    queryFn: () =>
      gatewayFetch<StudentBillingResponse>(`/api/backend/students/${studentId}/billing`),
  });
}

/** The active schedule of a direction: the student's own, or the group's (L-20). */
export function useDirectionScheduleQuery(target: { studentId?: string; groupId?: string } | null) {
  const filter = target?.groupId
    ? { groupId: target.groupId }
    : target?.studentId
      ? { studentId: target.studentId }
      : null;
  return useQuery<ScheduleListResponse, GatewayError>({
    queryKey: [...queryKeys.schedules.all, 'direction', filter],
    enabled: filter !== null,
    queryFn: () =>
      gatewayFetch<ScheduleListResponse>(
        `/api/backend/schedules${buildQueryString({ ...filter, state: 'ACTIVE', page: 1, pageSize: 20 })}`,
      ),
  });
}

/** What a sale would be (L-80): its credits, price, window, the debt it covers and what goes first. */
export function useSalePreviewQuery(dto: CreatePackageDto | null) {
  return useQuery<PackagePreviewResponse, GatewayError>({
    queryKey: [...queryKeys.packages.all, 'preview', dto],
    enabled: dto !== null,
    placeholderData: keepPreviousData,
    queryFn: () =>
      gatewayFetch<PackagePreviewResponse>('/api/backend/packages/preview', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
  });
}

/** What the member sale would be for each member (S08): lessons, total, debt covered, pause. */
export function useMemberSalePreviewQuery(dto: SellToMembersDto | null) {
  return useQuery<MemberSalePreviewResponse, GatewayError>({
    queryKey: [...queryKeys.packages.all, 'members-preview', dto],
    enabled: dto !== null,
    placeholderData: keepPreviousData,
    queryFn: () =>
      gatewayFetch<MemberSalePreviewResponse>('/api/backend/packages/members/preview', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
  });
}

function usePackageMutation<TResult, TInput>(run: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, GatewayError, TInput>({
    mutationFn: run,
    onSuccess: () => invalidatePackageGraph(queryClient),
  });
}

const post = <T>(path: string, body: unknown) =>
  gatewayFetch<T>(`/api/backend${path}`, { method: 'POST', body: JSON.stringify(body) });

export function useSellPackageMutation() {
  return usePackageMutation((dto: CreatePackageDto) => post<PackageResponse>('/packages', dto));
}

/** One package to each selected member, all or none (L-86). */
export function useSellToMembersMutation() {
  return usePackageMutation((dto: SellToMembersDto) =>
    post<SoldPackagesResponse>('/packages/members', dto),
  );
}

export function usePackagePaymentMutation() {
  return usePackageMutation((dto: RecordPaymentDto) => post<PaymentResponse>('/payments', dto));
}

export function useExtendPackageMutation() {
  return usePackageMutation(({ packageId, dto }: { packageId: string; dto: ExtendPackageDto }) =>
    post<PackageResponse>(`/packages/${packageId}/extend`, dto),
  );
}

export function useTransferPackageMutation() {
  return usePackageMutation(({ packageId, dto }: { packageId: string; dto: TransferPackageDto }) =>
    post<PackageTransferResponse>(`/packages/${packageId}/transfer`, dto),
  );
}

export function useRefundPackageMutation() {
  return usePackageMutation(({ packageId, dto }: { packageId: string; dto: RefundPackageDto }) =>
    post<PackageResponse>(`/packages/${packageId}/refund`, dto),
  );
}

export function useAdjustPackageMutation() {
  return usePackageMutation(({ packageId, dto }: { packageId: string; dto: AdjustBalanceDto }) =>
    post<PackageResponse>(`/packages/${packageId}/adjust`, dto),
  );
}

export function useDeletePackageMutation() {
  return usePackageMutation((packageId: string) =>
    gatewayFetch<void>(`/api/backend/packages/${packageId}`, { method: 'DELETE' }),
  );
}
