'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { shouldRetryQuery } from '@/lib/api/query-retry';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // Query functions never read the AbortSignal: React Query aborts a
          // read that uses it as soon as its last observer unmounts, so a
          // remount (StrictMode, a tab switch, a prefetch whose screen mounts
          // later) threw away a request in flight and sent it again. The API
          // does the work either way; a read now finishes into the cache.
          queries: {
            retry: shouldRetryQuery,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* Light/dark only — no system option (product decision). */}
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        <TooltipProvider>{children}</TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
