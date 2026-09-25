'use client';

import { useState, type ReactNode } from 'react';
import {
  ArchiveIcon,
  BanknoteIcon,
  CirclePauseIcon,
  MoreHorizontalIcon,
  PlayIcon,
  RepeatIcon,
  SlidersHorizontalIcon,
  XIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { IconButton } from '@/components/shared/icon-button';
import { RowActionsTrigger } from '@/components/shared/row-actions-trigger';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export type DirectionAction = 'pay' | 'settings' | 'schedule' | 'pause' | 'return' | 'end';

type Item = { action: DirectionAction; icon: ReactNode; label: string; destructive?: boolean };

/**
 * A direction's ⋯ (board 01, state 11): record a payment, its settings, its
 * schedule, pause it (or bring it back) and end it. «Продати пакет» joins the
 * menu with the package sale (S07). A dropdown on desktop, a sheet on phones.
 */
export function DirectionMenu({
  name,
  subtitle,
  paused,
  onAction,
}: {
  name: string;
  subtitle: string;
  /** The direction has its own running pause: the menu offers its return. */
  paused: boolean;
  onAction: (action: DirectionAction) => void;
}) {
  const t = useTranslations('students.learningBlock.menu');
  const mobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const label = t('label', { name });

  const items: Item[] = [
    { action: 'pay', icon: <BanknoteIcon />, label: t('pay') },
    { action: 'settings', icon: <SlidersHorizontalIcon />, label: t('settings') },
    { action: 'schedule', icon: <RepeatIcon />, label: t('schedule') },
    paused
      ? { action: 'return', icon: <PlayIcon />, label: t('return') }
      : { action: 'pause', icon: <CirclePauseIcon />, label: t('pause') },
  ];
  const end: Item = { action: 'end', icon: <ArchiveIcon />, label: t('end'), destructive: true };

  if (mobile) {
    const choose = (action: DirectionAction) => {
      setSheetOpen(false);
      onAction(action);
    };
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
        >
          <MoreHorizontalIcon data-icon />
        </Button>
        <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
          <DrawerContent>
            <DrawerHeader className="flex-row items-start justify-between gap-3 px-5 pt-5 pb-2 text-left">
              <div className="flex min-w-0 flex-col gap-0.5">
                <DrawerTitle className="text-lg leading-6 font-semibold">{name}</DrawerTitle>
                <DrawerDescription className="text-sm text-muted-foreground">
                  {subtitle}
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <IconButton size={36} tone="paper" icon={<XIcon />} label={t('close')} />
              </DrawerClose>
            </DrawerHeader>
            <div className="flex flex-col px-3 pb-2">
              {[...items, end].map((item) => (
                <button
                  key={item.action}
                  type="button"
                  onClick={() => choose(item.action)}
                  className={cn(
                    'flex min-h-13 w-full items-center gap-3.5 rounded-field px-3 text-left text-[15px] transition-colors outline-none hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-ring [&_svg]:size-4.5 [&_svg]:shrink-0',
                    item.destructive ? 'text-destructive' : 'text-foreground',
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
            <DrawerFooter className="px-5 pt-2">
              <DrawerClose asChild>
                <Button type="button" variant="outline">
                  {t('close')}
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <DropdownMenu>
      <RowActionsTrigger label={label} className="size-8 md:size-8" />
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          {items.map((item) => (
            <DropdownMenuItem key={item.action} onSelect={() => onAction(item.action)}>
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onSelect={() => onAction('end')}>
            {end.icon}
            {end.label}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
