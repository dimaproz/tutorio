'use client';

import { createContext, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthMe } from '@tutorio/validation';
import { LoadingScreen } from '@/components/shared';
import { useSessionQuery } from '@/lib/auth/client';

const SessionContext = createContext<AuthMe | null>(null);

// The authoritative session check for the protected shell: proxy.ts only does
// optimistic cookie-presence redirects, while this validates against the API
// via /api/backend/auth/me (which transparently refreshes tokens once).
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = useSessionQuery();

  const unauthenticated = session.isError && session.error.status === 401;

  useEffect(() => {
    if (unauthenticated) {
      router.replace('/login');
    }
  }, [unauthenticated, router]);

  if (session.isPending || unauthenticated) {
    return <LoadingScreen />;
  }

  if (session.isError) {
    // Non-auth failure (network, 5xx): rendering nothing would trap the user,
    // so keep the spinner — TanStack Query retries in the background.
    return <LoadingScreen />;
  }

  return <SessionContext value={session.data}>{children}</SessionContext>;
}

export function useSession(): AuthMe {
  const session = use(SessionContext);
  if (!session) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return session;
}

/**
 * A solo workspace is a single-teacher one: every teacher control is hidden and
 * the owner's own profile is implied. Presentation only — lessons still carry a
 * teacher, and the mode is switchable in workspace settings.
 */
export function useIsSoloWorkspace(): boolean {
  return useSession().workspace.mode === 'SOLO';
}

