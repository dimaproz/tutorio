'use client';

import { BellIcon, MenuIcon, MoonIcon, SearchIcon, SunIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';

// TailAdmin's top bar: mobile menu trigger + search on the left, utility
// controls (theme, notifications, account) on the right. Sticky so it stays put
// while the content column scrolls.
export function Header({
  isDark,
  onToggleDark,
  onOpenSidebar,
}: {
  isDark: boolean;
  onToggleDark: () => void;
  onOpenSidebar: () => void;
}) {
  return (
    <header className="bg-card border-border sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 lg:px-6">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="lg:hidden"
        aria-label="Відкрити меню"
        onClick={onOpenSidebar}
      >
        <MenuIcon />
      </Button>

      <div className="hidden w-full max-w-xs md:block">
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput type="search" placeholder="Пошук або команда…" aria-label="Пошук" />
        </InputGroup>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onToggleDark}
          aria-pressed={isDark}
          aria-label={isDark ? 'Світла тема' : 'Темна тема'}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Сповіщення"
          className="relative"
        >
          <BellIcon />
          <span className="bg-primary absolute top-2 right-2 size-2 rounded-full ring-2 ring-[var(--card)]" />
        </Button>

        <div className="ml-1 flex items-center gap-2.5">
          <Avatar className="size-9">
            <AvatarFallback className="text-xs">ОГ</AvatarFallback>
          </Avatar>
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-medium">Олена Гриценко</span>
            <span className="text-muted-foreground text-xs">Викладач</span>
          </div>
        </div>
      </div>
    </header>
  );
}
