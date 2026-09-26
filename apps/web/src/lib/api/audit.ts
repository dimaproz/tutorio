'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { AuditLogListResponse } from '@tutorio/validation';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';
import { buildQueryString } from './filters';
import { queryKeys, type AuditListFilters } from './keys';

// Owner-only. The API enforces it; the UI simply never mounts this for a
// teacher.

function fetchAuditPage(filters: AuditListFilters, page: number) {
  return gatewayFetch<AuditLogListResponse>(
    `/api/backend/audit-logs${buildQueryString({ ...filters, page })}`,
  );
}

/** The log as «Показати ще» reads it: page after page into one list. */
export function useAuditFeedQuery(filters: AuditListFilters, enabled = true) {
  return useInfiniteQuery<
    AuditLogListResponse,
    GatewayError,
    { pages: AuditLogListResponse[] },
    ReturnType<typeof queryKeys.audit.feed>,
    number
  >({
    queryKey: queryKeys.audit.feed(filters),
    queryFn: ({ pageParam }) => fetchAuditPage(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled,
  });
}

/** One page of the log; with `pageSize: 1`, a count. */
export function useAuditLogsQuery(filters: AuditListFilters, enabled = true) {
  return useQuery<AuditLogListResponse, GatewayError>({
    queryKey: queryKeys.audit.lists(filters),
    queryFn: () => fetchAuditPage(filters, 1),
    enabled,
  });
}
