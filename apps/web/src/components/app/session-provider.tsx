'use client';

import { createContext, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthMe } from '@tutorio/validation';
import { Skeleton } from '@/components/ui/skeleton';
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
    return <SessionSkeleton />;
  }

  if (session.isError) {
    // Non-auth failure (network, 5xx): rendering nothing would trap the user,
    // so keep the skeleton — TanStack Query retries in the background.
    return <SessionSkeleton />;
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

function SessionSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full max-w-2xl" />
      <Skeleton className="h-32 w-full max-w-2xl" />
    </div>
  );
}
