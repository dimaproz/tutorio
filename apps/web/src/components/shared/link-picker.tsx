'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CheckIcon, PlusIcon, SearchIcon, UsersIcon, XIcon } from 'lucide-react';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { FormSectionHeader, type FormSectionTag } from '@/components/shared/form-section';
import { IconButton } from '@/components/shared/icon-button';
import { TextField } from '@/components/shared/text-field';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type LinkPickerItem = {
  id: string;
  name: string;
  /** Second line: level, phone, relationship. */
  meta?: string;
  avatarKey?: string | null;
};

export type LinkPickerProps = {
  /** Section header; omit the whole header with `framed={false}`. */
  title?: ReactNode;
  description?: ReactNode;
  tag?: FormSectionTag;
  icon?: ReactNode;
  framed?: boolean;

  /** The already-linked set, each with an ✕. */
  linked?: LinkPickerItem[];
  showLinked?: boolean;
  /** Label above the linked rows, e.g. "Linked · 2". */
  linkedLabel?: string;
  /** Shown instead of the linked rows when nothing is linked. */
  emptyText?: ReactNode;
  onUnlink?: (id: string) => void;
  unlinkLabel?: (name: string) => string;

  /** Visible label of the search field; empty renders the field unlabelled. */
  fieldLabel?: string;
  /** Accessible name of the search field when it has no visible label. */
  searchLabel: string;
  placeholder?: string;
  search: string;
  onSearchChange: (value: string) => void;
  /** Whether the results are visible. */
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Search results. Already-linked records are filtered out by the caller. */
  results: LinkPickerItem[];
  selected: string[];
  onToggle: (id: string) => void;
  /** Results float over the page (true) or sit in the flow (false). */
  popover?: boolean;
  /** Replaces the results with placeholders while a search runs. */
  loading?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;

  /** Accessible name of the result list. */
  listLabel: string;
  /** Heading of the no-results state. */
  emptyTitle?: ReactNode;
  /** Line under the no-results heading. */
  emptyHint?: ReactNode;
  /** Footer hint while nothing is picked. */
  chooseText?: ReactNode;
  /** Footer hint once something is picked. */
  selectedText?: (count: number) => ReactNode;
  /** Shows the footer with the keyboard hint; off on phones. */
  hint?: boolean;

  /** The "+ Create…" row at the end of the results; omit to hide it. */
  createLabel?: string;
  onCreate?: () => void;
  className?: string;
};

const CREATE = '__create';

/**
 * Search plus multi-select over one entity type, with the already-linked set
 * above it and an optional "create a new one" row. It is the one control
 * behind every "link these records together" flow and knows no entity: every
 * word it shows is the caller's.
 *
 * The results are a `listbox` of `option`s driven from the search field, so
 * focus never leaves the input: ↑ ↓ move, Enter toggles, Esc closes.
 */
export function LinkPicker({
  title,
  description,
  tag,
  icon,
  framed = true,
  linked = [],
  showLinked = true,
  linkedLabel,
  emptyText,
  onUnlink,
  unlinkLabel,
  fieldLabel = '',
  searchLabel,
  placeholder,
  search,
  onSearchChange,
  open,
  onOpenChange,
  results,
  selected,
  onToggle,
  popover = true,
  loading = false,
  disabled = false,
  autoFocus = false,
  listLabel,
  emptyTitle,
  emptyHint,
  chooseText,
  selectedText,
  hint = true,
  createLabel,
  onCreate,
  className,
}: LinkPickerProps) {
  const listId = useId();
  const optionId = (key: string) => `${listId}-${key}`;
  const anchorRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const keys = [...results.map((item) => item.id), ...(createLabel && onCreate ? [CREATE] : [])];
  const activeIndex = Math.min(active, Math.max(keys.length - 1, 0));
  const activeKey = open && !loading ? keys[activeIndex] : undefined;

  const choose = (key: string) => {
    if (disabled) return;
    if (key === CREATE) onCreate?.();
    else onToggle(key);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        onOpenChange?.(true);
        return;
      }
      if (keys.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((activeIndex + step + keys.length) % keys.length);
    } else if (event.key === 'Enter') {
      // Enter never submits the surrounding form from the search field.
      event.preventDefault();
      if (activeKey) choose(activeKey);
    } else if (event.key === 'Escape' && open && popover) {
      // Inline results belong to their dialog, which Esc closes instead.
      event.preventDefault();
      event.stopPropagation();
      onOpenChange?.(false);
    }
  };

  const field = (
    <TextField
      label={fieldLabel || undefined}
      aria-label={fieldLabel ? undefined : searchLabel}
      icon={<SearchIcon />}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      autoFocus={autoFocus}
      disabled={disabled}
      value={search}
      role="combobox"
      aria-expanded={open}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={activeKey ? optionId(activeKey) : undefined}
      onChange={(event) => {
        setActive(0);
        onSearchChange(event.currentTarget.value);
        if (!open) onOpenChange?.(true);
      }}
      onFocus={() => onOpenChange?.(true)}
      onKeyDown={onKeyDown}
    />
  );

  const count = selected.length;
  const list = (
    <div className="flex flex-col gap-0.5">
      {loading
        ? Array.from({ length: 3 }, (_, index) => (
            <div key={index} aria-hidden="true" className="flex items-center gap-3 px-3 py-2">
              <Skeleton className="size-5 rounded-[7px]" />
              <Skeleton className="size-8.5 rounded-pill" />
              <div className="flex grow flex-col gap-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))
        : null}
      {!loading && results.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-5.5 text-center">
          {emptyTitle ? <span className="text-sm font-semibold">{emptyTitle}</span> : null}
          {emptyHint ? (
            <span className="text-[13px] text-muted-foreground">{emptyHint}</span>
          ) : null}
        </div>
      ) : null}
      <div
        id={listId}
        role="listbox"
        aria-label={listLabel}
        aria-multiselectable="true"
        aria-busy={loading || undefined}
        className="flex flex-col gap-0.5"
      >
        {loading
          ? null
          : results.map((item) => {
              const checked = selected.includes(item.id);
              return (
                <div
                  key={item.id}
                  id={optionId(item.id)}
                  role="option"
                  aria-selected={checked}
                  aria-disabled={disabled || undefined}
                  data-active={activeKey === item.id || undefined}
                  // The field keeps focus; a click only toggles the option.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseMove={() => setActive(keys.indexOf(item.id))}
                  onClick={() => choose(item.id)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-tile px-3 py-2 transition-colors duration-150 aria-disabled:cursor-not-allowed aria-disabled:opacity-55',
                    (checked || activeKey === item.id) && 'bg-surface-hover',
                    activeKey === item.id && 'ring-1 ring-border',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-[7px] border [&_svg]:size-3.5 [&_svg]:stroke-3',
                      checked
                        ? 'border-brand bg-brand text-brand-foreground'
                        : 'border-line-hover bg-card',
                    )}
                  >
                    {checked ? <CheckIcon /> : null}
                  </span>
                  <EntityAvatar
                    avatarKey={item.avatarKey}
                    fullName={item.name}
                    tint="indigo"
                    className="size-8.5"
                  />
                  <span className="flex min-w-0 grow flex-col">
                    <span className="truncate text-sm leading-[18px] font-medium">{item.name}</span>
                    {item.meta ? (
                      <span className="truncate text-xs leading-4 text-muted-foreground">
                        {item.meta}
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })}

        {createLabel && onCreate ? (
          <>
            <Separator decorative className="mx-1.5 mt-1 mb-0.5 w-auto" />
            <div
              id={optionId(CREATE)}
              role="option"
              aria-selected={false}
              aria-disabled={disabled || undefined}
              data-active={activeKey === CREATE || undefined}
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => setActive(keys.indexOf(CREATE))}
              onClick={() => choose(CREATE)}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-item px-3 py-2.5 text-sm leading-[18px] font-semibold text-brand transition-colors duration-150 hover:bg-surface-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-55 [&_svg]:size-4',
                activeKey === CREATE && 'bg-surface-hover',
              )}
            >
              <PlusIcon aria-hidden="true" />
              {createLabel}
            </div>
          </>
        ) : null}
      </div>

      {hint ? (
        <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1 text-xs text-muted-foreground">
          <span aria-live="polite">
            {count > 0 && selectedText ? selectedText(count) : chooseText}
          </span>
          <span aria-hidden="true" className="font-mono">
            ↑ ↓ · Enter
          </span>
        </div>
      ) : null}
    </div>
  );

  return (
    <section
      data-slot="link-picker"
      aria-label={framed ? undefined : searchLabel}
      className={cn('flex w-full flex-col gap-3.5', className)}
    >
      {framed && title ? (
        <>
          <FormSectionHeader
            icon={icon ?? <UsersIcon />}
            title={title}
            description={description}
            tag={tag}
          />
          <Separator />
        </>
      ) : null}

      {showLinked && linked.length > 0 ? (
        <div className="flex flex-col gap-2">
          {linkedLabel ? (
            <span className="text-xs leading-4 font-semibold tracking-[0.04em] text-muted-foreground uppercase">
              {linkedLabel}
            </span>
          ) : null}
          <ul className="flex flex-col gap-2">
            {linked.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-tile bg-surface-hover p-2"
              >
                <EntityAvatar avatarKey={item.avatarKey} fullName={item.name} tint="indigo" />
                <span className="flex min-w-0 grow flex-col">
                  <span className="truncate text-sm leading-[19px] font-semibold">{item.name}</span>
                  {item.meta ? (
                    <span className="truncate text-xs leading-4 text-muted-foreground">
                      {item.meta}
                    </span>
                  ) : null}
                </span>
                {onUnlink ? (
                  <IconButton
                    size={32}
                    tone="ghost"
                    icon={<XIcon />}
                    label={unlinkLabel?.(item.name) ?? item.name}
                    disabled={disabled}
                    onClick={() => onUnlink(item.id)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showLinked && linked.length === 0 && emptyText ? (
        <div className="flex items-center gap-2.5 rounded-tile border border-dashed border-border px-4 py-3.5 text-[13px] leading-[18px] text-muted-foreground [&_svg]:size-4.5">
          <UsersIcon aria-hidden="true" />
          {emptyText}
        </div>
      ) : null}

      {popover ? (
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverAnchor asChild>
            <div ref={anchorRef}>{field}</div>
          </PopoverAnchor>
          <PopoverContent
            align="start"
            sideOffset={6}
            // The search field keeps focus while the results are open, and a
            // click back into it must not count as a click outside.
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => {
              if (anchorRef.current?.contains(event.target as Node)) event.preventDefault();
            }}
            aria-label={listLabel}
            className="w-(--radix-popover-trigger-width) gap-0 p-1.5"
          >
            {list}
          </PopoverContent>
        </Popover>
      ) : (
        <>
          {field}
          {open ? list : null}
        </>
      )}
    </section>
  );
}
