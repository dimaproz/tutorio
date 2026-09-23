'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CurrentWorkspace,
  UpdateWorkspaceSettingsDto,
  WorkspaceMemberListResponse,
} from '@tutorio/validation';
import { gatewayFetch, type GatewayError } from '@/lib/auth/client';
import { applyInvalidations, workspaceSettingsInvalidations } from './invalidation';
import { queryKeys } from './keys';

// Read-only roster powering the teacher selector.
export function useWorkspaceMembersQuery(enabled = true) {
  return useQuery<WorkspaceMemberListResponse, GatewayError>({
    queryKey: queryKeys.workspace.members,
    enabled,
    queryFn: ({ signal }) =>
      gatewayFetch<WorkspaceMemberListResponse>('/api/backend/workspaces/current/members', {
        signal,
      }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateWorkspaceSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation<CurrentWorkspace, GatewayError, UpdateWorkspaceSettingsDto>({
    mutationFn: (dto) =>
      gatewayFetch<CurrentWorkspace>('/api/backend/workspaces/current/settings', {
        method: 'PATCH',
        body: JSON.stringify(dto),
      }),
    onSuccess: (_workspace, dto) => {
      applyInvalidations(queryClient, workspaceSettingsInvalidations(dto));
    },
  });
}
