'use client';

import { useRouter } from 'next/navigation';
import { LogOutIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLogoutMutation } from '@/lib/auth/client';
import { useSession } from './session-provider';

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
}

export function UserMenu() {
  const t = useTranslations('app.userMenu');
  const tErrors = useTranslations('auth.errors');
  const router = useRouter();
  const session = useSession();
  const logout = useLogoutMutation();
  const { theme, setTheme } = useTheme();

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
            <AvatarFallback>{initialsOf(session.user.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate font-medium">{session.user.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {session.user.email}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {t(`roles.${session.role}`)}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <SunIcon className="dark:hidden" data-icon="inline-start" />
              <MoonIcon className="hidden dark:block" data-icon="inline-start" />
              {t('theme')}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="light">{t('themeLight')}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">{t('themeDark')}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">{t('themeSystem')}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              void onLogout();
            }}
            disabled={logout.isPending}
          >
            <LogOutIcon data-icon="inline-start" />
            {t('logout')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
