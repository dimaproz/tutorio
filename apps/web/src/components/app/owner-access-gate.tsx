'use client';

import type { ReactNode } from 'react';
import { LockIcon, LogOutIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useLogoutMutation } from '@/lib/auth/client';
import { canUseBusinessRoutes } from './app-navigation';
import { performLogout } from './app-shell-actions';
import { useSession } from './session-provider';

/**
 * Renders the application only for a membership that may use it. The pilot is
 * owner-operated (ADR 0004): a legacy TEACHER membership can sign in but can
 * read or change nothing, so every app route shows why instead of a page of
 * failed requests.
 */
export function OwnerAccessGate({ children }: { children: ReactNode }) {
  const session = useSession();
  return canUseBusinessRoutes(session.role) ? children : <NoBusinessAccess />;
}

function NoBusinessAccess() {
  const tErrors = useTranslations('auth.errors');
  const router = useRouter();
  const logout = useLogoutMutation();

  return (
    <NoBusinessAccessView
      pending={logout.isPending}
      onSignOut={() =>
        void performLogout({
          logout: () => logout.mutateAsync(),
          redirectToLogin: () => router.replace('/login'),
          reportError: () => toast.error(tErrors('generic')),
        })
      }
    />
  );
}

/** The no-access screen itself, without the sign-out mutation behind it. */
export function NoBusinessAccessView({
  pending = false,
  onSignOut,
}: {
  pending?: boolean;
  onSignOut: () => void;
}) {
  const t = useTranslations('app.noAccess');
  const tMenu = useTranslations('app.userMenu');

  return (
    <EmptyState
      pattern
      framed={false}
      minHeight={420}
      icon={<LockIcon />}
      // The empty state sets its title in a paragraph; the span keeps the markup
      // valid while still giving the page its level-one heading.
      title={
        <span role="heading" aria-level={1}>
          {t('title')}
        </span>
      }
      text={t('text')}
      action={
        <Button type="button" variant="outline" disabled={pending} onClick={onSignOut}>
          {pending ? <Spinner data-icon="inline-start" /> : <LogOutIcon data-icon="inline-start" />}
          {tMenu('logout')}
        </Button>
      }
    />
  );
}
