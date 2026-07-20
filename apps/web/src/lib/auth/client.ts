'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthMe, LoginDto } from '@tutorio/validation';

// Client-side access to the same-origin auth gateway. Tokens live in
// HttpOnly cookies — this module only ever sees safe session data.

export class GatewayError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`Gateway request failed (${status} ${code})`);
    this.name = 'GatewayError';
  }
}

export async function gatewayFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code =
      data && typeof data === 'object' && 'code' in data ? String(data.code) : 'UNEXPECTED';
    throw new GatewayError(response.status, code);
  }
  return data as T;
}

export const SESSION_QUERY_KEY = ['session'] as const;

export function useSessionQuery() {
  return useQuery<AuthMe, GatewayError>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: () => gatewayFetch<AuthMe>('/api/backend/auth/me'),
    retry: (failureCount, error) => error.status !== 401 && failureCount < 2,
  });
}

export interface RegisterPayload {
  name: string;
  workspaceName: string;
  email: string;
  password: string;
}

export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation<AuthMe, GatewayError, LoginDto>({
    mutationFn: (dto) =>
      gatewayFetch<AuthMe>('/api/auth/login', { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: (session) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, session);
    },
  });
}

export function useRegisterMutation() {
  const queryClient = useQueryClient();
  return useMutation<AuthMe, GatewayError, RegisterPayload>({
    mutationFn: (dto) =>
      gatewayFetch<AuthMe>('/api/auth/register', { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: (session) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, session);
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, GatewayError, void>({
    mutationFn: () => gatewayFetch<void>('/api/auth/logout', { method: 'POST' }),
    onSettled: () => {
      queryClient.removeQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });
}
