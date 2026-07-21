'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CurrentWorkspace,
  UpdateWorkspaceSettingsDto,
  WorkspaceMemberListResponse,
} from '@tutorio/validation';
import { gatewayFetch, SESSION_QUERY_KEY, type GatewayError } from '@/lib/auth/client';
import { queryKeys } from './keys';

// Read-only roster powering the teacher selector.
export function useWorkspaceMembersQuery(enabled = true) {
  return useQuery<WorkspaceMemberListResponse, GatewayError>({
    queryKey: queryKeys.workspace.members,
    enabled,
    queryFn: () =>
      gatewayFetch<WorkspaceMemberListResponse>('/api/backend/workspaces/current/members'),
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
    onSuccess: () => {
      // The session carries workspace defaults, and enrollments without an
      // override display the new effective deadline.
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace.current });
      void queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.all });
    },
  });
}
