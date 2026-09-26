'use client';

import { useState, type ReactNode } from 'react';
import {
  BanknoteIcon,
  ChevronDownIcon,
  PackageIcon,
  PlusIcon,
  UserRoundIcon,
  UsersIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { PAGE_TITLE_CLASS } from '@/components/shared/page-shell';
import { Segmented } from '@/components/shared/segmented';
import { cn } from '@/lib/utils';
import type { ScopeChoice } from '../model/today';

/** What the header can start (S11 decision 8). */
export type TodayAction = 'lesson' | 'payment' | 'sale' | 'student';

/**
 * The page head (S11 decision 8): the date, the greeting, the «Мої ·
 * Студія» switch where the owner teaches with colleagues, and the actions —
 * outline «Записати оплату», «Створити ▾» with the sale and the new student,
 * primary «Додати заняття»; on phones one «+» opening the «Створити» sheet.
 */
export function TodayHeader({
  date,
  greeting,
  subtitle,
  scope,
  onAction,
}: {
  date: string;
  greeting: string;
  /** «Tutorio готовий до роботи» on the first run. */
  subtitle?: string;
  /** The switch, where the owner teaches with colleagues. */
  scope?: { value: ScopeChoice; onChange: (value: ScopeChoice) => void };
  onAction: (action: TodayAction) => void;
}) {
  const t = useTranslations('today.header');
  const [sheet, setSheet] = useState(false);

  return (
    // The actions wrap under the title where both do not fit (a tablet).
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-4 md:items-end">
      <div className="flex min-w-0 flex-1 basis-60 flex-col gap-2">
        <span className="text-[15px] leading-5 text-muted-foreground">{date}</span>
        <h1 className={PAGE_TITLE_CLASS.lg}>{greeting}</h1>
        {subtitle ? <p className="text-[15px] leading-5">{subtitle}</p> : null}
        {scope ? (
          <Segmented
            label={t('scope')}
            value={scope.value}
            onValueChange={scope.onChange}
            className="w-fit"
            items={[
              { value: 'mine', label: t('mine') },
              { value: 'studio', label: t('studio') },
            ]}
          />
        ) : null}
      </div>

      <div className="hidden flex-wrap items-center gap-2.5 md:flex">
        <Button type="button" variant="outline" onClick={() => onAction('payment')}>
          <BanknoteIcon data-icon="inline-start" />
          {t('payment')}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline">
              {t('create')}
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-68">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => onAction('sale')}>
                <PackageIcon />
                <MenuText title={t('sale')} text={t('saleHint')} />
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAction('student')}>
                <UsersIcon />
                <MenuText title={t('student')} text={t('studentHint')} />
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button type="button" onClick={() => onAction('lesson')}>
          <PlusIcon data-icon="inline-start" />
          {t('lesson')}
        </Button>
      </div>

      <Button
        type="button"
        size="icon"
        aria-label={t('create')}
        className="shrink-0 rounded-tile md:hidden"
        onClick={() => setSheet(true)}
      >
        <PlusIcon />
      </Button>

      <Drawer open={sheet} onOpenChange={setSheet}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>{t('create')}</DrawerTitle>
            <DrawerDescription className="sr-only">{t('sheetDescription')}</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col px-3 pb-[max(env(safe-area-inset-bottom),16px)]">
            {(
              [
                ['lesson', <PlusIcon key="i" />, 'lesson', 'lessonHint'],
                ['payment', <BanknoteIcon key="i" />, 'payment', 'paymentHint'],
                ['sale', <PackageIcon key="i" />, 'sale', 'saleHint'],
                ['student', <UserRoundIcon key="i" />, 'student', 'studentHint'],
              ] as const
            ).map(([action, icon, title, text], index) => (
              <SheetRow
                key={action}
                icon={icon}
                primary={index === 0}
                title={t(title)}
                text={t(text)}
                onSelect={() => {
                  setSheet(false);
                  onAction(action);
                }}
              />
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function MenuText({ title, text }: { title: string; text: string }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span>{title}</span>
      <span className="text-xs text-muted-foreground">{text}</span>
    </span>
  );
}

function SheetRow({
  icon,
  title,
  text,
  primary,
  onSelect,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  primary: boolean;
  onSelect: () => void;
}) {
  return (
    <Item
      asChild
      className="rounded-none border-0 px-1.5 py-3 not-last:border-b not-last:border-border"
    >
      <button type="button" onClick={onSelect} className="text-left">
        <ItemMedia
          className={cn(
            'size-12 rounded-tile [&_svg]:size-5',
            primary ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
          )}
        >
          {icon}
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="text-base">{title}</ItemTitle>
          <ItemDescription>{text}</ItemDescription>
        </ItemContent>
      </button>
    </Item>
  );
}
