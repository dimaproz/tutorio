'use client';

import { useRouter } from 'next/navigation';
import { MailIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLogoutMutation } from '@/lib/auth/client';
import { nameInitials } from '@/lib/utils';
import { useSession } from './session-provider';

export function UserMenu() {
  const t = useTranslations('app.userMenu');
  const tErrors = useTranslations('auth.errors');
  const router = useRouter();
  const session = useSession();
  const logout = useLogoutMutation();

  async function onLogout() {
    try {
      await logout.mutateAsync();
    } catch {
      toast.error(tErrors('generic'));
      return;
    }
    router.replace('/login');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('label')}
          className="size-11 rounded-full md:size-9"
        >
          <Avatar className="size-8">
            <AvatarFallback>{nameInitials(session.user.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-0">
        <div className="flex items-center gap-3 p-4">
          <Avatar className="size-11">
            <AvatarFallback className="text-sm font-medium">
              {nameInitials(session.user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{session.user.name}</span>
            <span className="text-xs text-muted-foreground">{t(`roles.${session.role}`)}</span>
            <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MailIcon className="size-3 shrink-0" />
              <span className="truncate">{session.user.email}</span>
            </span>
          </div>
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="p-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void onLogout()}
            disabled={logout.isPending}
          >
            {t('logout')}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
