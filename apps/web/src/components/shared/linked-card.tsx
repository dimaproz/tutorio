import type { ReactNode } from 'react';
import Link from 'next/link';
import { PlusIcon, type LucideIcon } from 'lucide-react';
import { EntityAvatar, type EntityAvatarTint } from '@/components/shared/entity-avatar';
import { PersonItem } from '@/components/shared/person-item';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type LinkedCardItem = {
  id: string;
  name: string;
  meta?: string;
  avatarKey?: string | null;
  /** The whole row links here. */
  href: string;
  /** Accessible name of the row link, e.g. "Open profile · Anna". */
  hrefLabel?: string;
  /** The row's `…` menu; the actions differ by side, so it is the caller's. */
  menu?: ReactNode;
};

export type LinkedCardAction = {
  label: string;
  icon?: LucideIcon;
  variant?: 'outline' | 'ghost';
  onClick: () => void;
  disabled?: boolean;
};

/**
 * The records linked to a profile: a heading with the count, an optional
 * "+ Link" command, one `PersonItem` per record, and an empty state with up to
 * two actions. It is the same card on both sides of a relationship — a
 * student's parents and a parent's students — so the two never drift apart.
 * Omitting `addLabel` renders the read-only card.
 */
export function LinkedCard({
  title,
  items,
  addLabel,
  addHref,
  onAdd,
  addDisabled = false,
  addId,
  emptyText,
  actions = [],
  size = 'md',
  avatarTint = 'indigo',
  children,
  className,
}: {
  /** Heading; the count is appended as " · N". */
  title: string;
  items: LinkedCardItem[];
  addLabel?: string;
  addHref?: string;
  onAdd?: () => void;
  addDisabled?: boolean;
  /** Id of the add command, so another control can move focus to it. */
  addId?: string;
  emptyText?: ReactNode;
  /** Up to two commands shown with the empty text. */
  actions?: LinkedCardAction[];
  /** `sm` is the phone density. */
  size?: 'md' | 'sm';
  avatarTint?: EntityAvatarTint;
  /** Feedback above the rows, such as a failed save with its retry. */
  children?: ReactNode;
  className?: string;
}) {
  const sm = size === 'sm';
  const heading = items.length > 0 ? `${title} · ${items.length}` : title;
  const add = addLabel ? (
    <Button
      asChild={Boolean(addHref) && !addDisabled}
      id={addId}
      type="button"
      variant="link"
      size="xs"
      className="px-0 font-semibold"
      disabled={addDisabled}
      onClick={addHref ? undefined : onAdd}
    >
      {addHref && !addDisabled ? (
        <Link href={addHref}>
          <PlusIcon data-icon="inline-start" />
          {addLabel}
        </Link>
      ) : (
        <>
          <PlusIcon data-icon="inline-start" />
          {addLabel}
        </>
      )}
    </Button>
  ) : null;

  return (
    <Card
      data-slot="linked-card"
      className={cn(
        sm ? 'gap-2.5 p-4' : 'gap-3 px-6 py-5.5',
        // The row hover reaches past the padding, so the card never clips it.
        'overflow-visible',
        className,
      )}
    >
      <div className={cn('flex items-center justify-between gap-3', sm ? 'min-h-7' : 'min-h-8')}>
        <h2 className={cn('font-semibold', sm ? 'text-[15px]' : 'text-base')}>{heading}</h2>
        {add}
      </div>

      {children}

      {items.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id} className="flex">
              <PersonItem
                href={item.href}
                hrefLabel={item.hrefLabel}
                media={
                  <EntityAvatar
                    avatarKey={item.avatarKey}
                    fullName={item.name}
                    tint={avatarTint}
                    className="size-10"
                  />
                }
                name={item.name}
                subtitle={item.meta}
                menu={item.menu}
                className="grow"
              />
            </li>
          ))}
        </ul>
      ) : (
        <>
          {emptyText ? (
            <p className="text-sm leading-5 text-muted-foreground">{emptyText}</p>
          ) : null}
          {actions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {actions.slice(0, 2).map((action) => (
                <Button
                  key={action.label}
                  type="button"
                  variant={action.variant ?? 'outline'}
                  size="xs"
                  disabled={action.disabled}
                  onClick={action.onClick}
                >
                  {action.icon ? <action.icon data-icon="inline-start" /> : null}
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
