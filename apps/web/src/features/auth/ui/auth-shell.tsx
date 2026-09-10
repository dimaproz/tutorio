'use client';

import { GraduationCapIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

interface AuthShellProps {
  localeControl: ReactNode;
  children: ReactNode;
}

export function AuthShell({ localeControl, children }: AuthShellProps) {
  const t = useTranslations('common');

  return (
    <div className="min-h-svh bg-muted p-4 sm:p-6">
      <div className="flex justify-end">{localeControl}</div>
      <main className="flex min-h-[calc(100svh-4rem)] items-center justify-center py-8 sm:min-h-[calc(100svh-5rem)]">
        <div className="flex w-full max-w-md flex-col gap-6">
          <div className="flex items-center gap-2 self-center font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GraduationCapIcon />
            </div>
            {t('appName')}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
