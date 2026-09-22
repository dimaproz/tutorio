'use client';

import type { ReactNode } from 'react';
import { CheckIcon, ClockIcon, XIcon } from 'lucide-react';
import {
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { IconButton } from '@/components/shared/icon-button';
import { STATUS_TONE, type LifecycleTone } from '@/components/shared/status-trigger';
import { cn } from '@/lib/utils';

export type StatusOption<T extends string> = {
  value: T;
  label: ReactNode;
  description: ReactNode;
  icon: ReactNode;
  tone: LifecycleTone;
  /** A status that cannot be reached from the current one. */
  disabled?: boolean;
};

function OptionBody<T extends string>({ option }: { option: StatusOption<T> }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-control [&_svg]:size-4.5',
          STATUS_TONE[option.tone].tile,
        )}
      >
        {option.icon}
      </span>
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="text-sm leading-5 font-semibold">{option.label}</span>
        <span className="text-[13px] leading-[18px] font-normal text-muted-foreground">
          {option.description}
        </span>
      </span>
    </>
  );
}

/**
 * The desktop status menu: an uppercase heading, one radio row per status with
 * its description, and an optional note. Render it inside a `DropdownMenu`
 * whose trigger is a `StatusTrigger`.
 */
export function StatusMenuContent<T extends string>({
  heading,
  value,
  options,
  onSelect,
  note,
  label,
  align = 'start',
}: {
  heading: ReactNode;
  value: T;
  options: StatusOption<T>[];
  onSelect: (value: T) => void;
  note?: ReactNode;
  /** Accessible name of the menu. */
  label: string;
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <DropdownMenuContent
      align={align}
      sideOffset={8}
      aria-label={label}
      className="flex w-95 max-w-[calc(100vw-32px)] flex-col gap-0.5 rounded-[22px] p-2 shadow-menu"
    >
      <DropdownMenuLabel className="px-3 pt-2 pb-1.5 text-xs leading-4 font-medium tracking-[0.04em] text-muted-foreground uppercase">
        {heading}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={value}
        onValueChange={(next) => {
          if (next !== value) onSelect(next as T);
        }}
      >
        {options.map((option) => (
          <DropdownMenuRadioItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className="items-start gap-3 rounded-field px-3 py-2.5 pr-10 data-[state=checked]:cursor-default data-[state=checked]:bg-surface-hover [&>[data-slot=dropdown-menu-radio-item-indicator]]:top-3 [&>[data-slot=dropdown-menu-radio-item-indicator]]:right-3 [&>[data-slot=dropdown-menu-radio-item-indicator]_svg]:size-4.5 [&>[data-slot=dropdown-menu-radio-item-indicator]_svg]:stroke-[2.5] [&>[data-slot=dropdown-menu-radio-item-indicator]_svg]:text-tint-indigo-foreground"
          >
            <OptionBody option={option} />
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      {note ? <StatusNote>{note}</StatusNote> : null}
    </DropdownMenuContent>
  );
}

function StatusNote({ children }: { children: ReactNode }) {
  return (
    <div className="mx-1 mt-1.5 mb-0.5 flex gap-2 rounded-item bg-background px-3 py-2.5 text-xs leading-[17px] text-muted-foreground">
      <ClockIcon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/**
 * The same status choice as a mobile bottom sheet: drag handle, title, close
 * control and one radio row per status. Selecting a row reports it; whether
 * the sheet closes is the caller's decision, since some changes confirm first.
 */
export function StatusSheet<T extends string>({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  value,
  options,
  onSelect,
  note,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Visually hidden sheet description for assistive technology. */
  description?: ReactNode;
  closeLabel: string;
  value: T;
  options: StatusOption<T>[];
  onSelect: (value: T) => void;
  note?: ReactNode;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="flex-row items-center justify-between gap-3 px-5 pt-5 pb-3 text-left">
          <DrawerTitle className="text-lg leading-6 font-semibold">{title}</DrawerTitle>
          {description ? (
            <DrawerDescription className="sr-only">{description}</DrawerDescription>
          ) : null}
          <DrawerClose asChild>
            <IconButton size={32} tone="ghost" icon={<XIcon />} label={closeLabel} />
          </DrawerClose>
        </DrawerHeader>
        <div role="radiogroup" className="flex flex-col gap-0.5 px-3 pb-4">
          {options.map((option) => {
            const checked = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={checked}
                disabled={option.disabled}
                onClick={() => (checked ? undefined : onSelect(option.value))}
                className={cn(
                  'flex w-full items-start gap-3 rounded-field px-3 py-3 text-left text-foreground transition-colors duration-150 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50',
                  checked ? 'bg-surface-hover' : 'not-disabled:hover:bg-surface-hover',
                )}
              >
                <OptionBody option={option} />
                {checked ? (
                  <CheckIcon
                    aria-hidden="true"
                    strokeWidth={2.5}
                    className="mt-0.5 size-4.5 shrink-0 text-tint-indigo-foreground"
                  />
                ) : null}
              </button>
            );
          })}
          {note ? <StatusNote>{note}</StatusNote> : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
