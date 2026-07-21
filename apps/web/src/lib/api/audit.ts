'use client';

import { useQuery } from '@tanstack/react-query';
import type { AuditLogListResponse } from '@tutorio/validation';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';
import { buildQueryString } from './filters';
import { queryKeys, type AuditListFilters } from './keys';

// Owner-only. The API enforces it; the UI simply never mounts this for a
// teacher.
export function useAuditLogsQuery(filters: AuditListFilters, enabled = true) {
  return useQuery<AuditLogListResponse, GatewayError>({
    queryKey: queryKeys.audit.lists(filters),
    queryFn: () =>
      gatewayFetch<AuditLogListResponse>(
        `/api/backend/audit-logs${buildQueryString({
          page: filters.page,
          entity: filters.entity,
          entityId: filters.entityId,
          actorId: filters.actorId,
          action: filters.action,
        })}`,
      ),
    enabled,
    placeholderData: (previous) => previous,
  });
}
