'use client';

import { useState, type ComponentType } from 'react';
import Link from 'next/link';
import {
  BanknoteIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  ClipboardCheckIcon,
  HourglassIcon,
  LayersIcon,
  PackageIcon,
  PauseIcon,
  ReceiptTextIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  AttentionCategory,
  AttentionItem,
  DashboardAttentionResponse,
} from '@tutorio/validation';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { PersonItem } from '@/components/shared/person-item';
import { cn } from '@/lib/utils';
import { categoryHref, firstOpen } from '../model/today';
import { BlockError } from './block-error';
import { useAttentionLine } from './use-attention-line';

type Kind = AttentionCategory['kind'];

/** Each category's icon tile and count colour: lessons indigo, money danger, packages warning. */
const CATEGORY: Record<Kind, { icon: ComponentType; tile: string; count: string }> = {
  attendance: {
    icon: ClipboardCheckIcon,
    tile: 'bg-tile-indigo text-tile-indigo-foreground',
    count: 'text-tile-indigo-foreground',
  },
  makeups: {
    icon: RotateCcwIcon,
    tile: 'bg-tint-warning text-tint-warning-foreground',
    count: 'text-tint-warning-foreground',
  },
  debtors: {
    icon: BanknoteIcon,
    tile: 'bg-tint-danger text-tint-danger-foreground',
    count: 'text-tint-danger-foreground',
  },
  unpaidPackages: {
    icon: ReceiptTextIcon,
    tile: 'bg-tint-warning text-tint-warning-foreground',
    count: 'text-tint-warning-foreground',
  },
  endingPackages: {
    icon: PackageIcon,
    tile: 'bg-tint-warning text-tint-warning-foreground',
    count: 'text-tint-warning-foreground',
  },
  expiringPackages: {
    icon: HourglassIcon,
    tile: 'bg-tint-warning text-tint-warning-foreground',
    count: 'text-tint-warning-foreground',
  },
  pauses: {
    icon: PauseIcon,
    tile: 'bg-secondary text-muted-foreground',
    count: 'text-muted-foreground',
  },
};

export type AttentionAction = { kind: Kind; item: AttentionItem };

function ItemMedia({ item }: { item: AttentionItem }) {
  if (item.student) {
    return (
      <EntityAvatar
        avatarKey={item.student.avatarKey}
        fullName={item.student.fullName}
        size="xs"
        tint="indigo"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-tile-indigo text-tile-indigo-foreground [&_svg]:size-4"
    >
      <LayersIcon />
    </span>
  );
}

/**
 * «Потребує уваги» (S11 decision 5): one card, one row per category in the
 * fixed order — a tinted tile, the title, the count and a chevron, and a
 * two-name summary while closed. The first category with something in it is
 * open; opening another closes it, and a click on the open one closes it.
 * An open category lists up to three `PersonItem`s with one action each and
 * «Усі N →» under them. With nothing anywhere: «Усе під контролем».
 */
export function AttentionCard({
  data,
  loading,
  error,
  onRetry,
  teacherId,
  onAction,
}: {
  data?: DashboardAttentionResponse;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  /** «Мої»: the lists «Усі N →» opens keep the same teacher. */
  teacherId: string | null;
  onAction: (action: AttentionAction) => void;
}) {
  const t = useTranslations('today.attention');

  let body;
  if (error) {
    body = (
      <Card className="px-5 py-5">
        <BlockError onRetry={onRetry} />
      </Card>
    );
  } else if (loading || !data) {
    body = (
      <Card aria-busy="true" className="gap-0 px-4.5 py-1">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex items-center gap-3 border-border py-3 not-last:border-b">
            <Skeleton className="size-8.5 rounded-control" />
            <div className="flex grow flex-col gap-2">
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-2.5 w-2/5" />
            </div>
            <Skeleton className="size-3 rounded-full" />
          </div>
        ))}
      </Card>
    );
  } else if (data.total === 0) {
    body = (
      <Card className="flex-row items-center gap-3.5 px-5 py-5">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-success text-success-foreground [&_svg]:size-5"
        >
          <CircleCheckIcon />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] leading-5 font-semibold">{t('calmTitle')}</span>
          <span className="text-[13px] leading-[18px] text-muted-foreground">{t('calmText')}</span>
        </div>
      </Card>
    );
  } else {
    body = (
      <Categories
        // A new scope starts from its own first category.
        key={teacherId ?? 'studio'}
        categories={data.categories.filter((category) => category.count > 0)}
        teacherId={teacherId}
        onAction={onAction}
      />
    );
  }

  return (
    <section aria-labelledby="attention-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 id="attention-title" className="text-lg leading-6 font-semibold">
          {t('title')}
        </h2>
        {data && data.total > 0 && !error ? (
          <span className="text-[13px] text-muted-foreground">
            {t('total', { count: data.total })}
          </span>
        ) : null}
      </div>
      {body}
    </section>
  );
}

function Categories({
  categories,
  teacherId,
  onAction,
}: {
  categories: AttentionCategory[];
  teacherId: string | null;
  onAction: (action: AttentionAction) => void;
}) {
  const t = useTranslations('today.attention');
  const line = useAttentionLine();
  const [open, setOpen] = useState(() => firstOpen(categories));

  return (
    <Card className="gap-0 px-4.5 py-1">
      <Accordion
        type="single"
        collapsible
        value={open}
        onValueChange={setOpen}
        className="rounded-none border-0"
      >
        {categories.map((category) => {
          const look = CATEGORY[category.kind];
          const Icon = look.icon;
          const expanded = open === category.kind;
          const more = category.count - category.names.length;
          const href = categoryHref(category.kind, teacherId);
          return (
            <AccordionItem
              key={category.kind}
              value={category.kind}
              className="border-border data-open:bg-transparent"
            >
              <AccordionTrigger className="items-center gap-3 rounded-none px-0 py-3 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-8.5 shrink-0 items-center justify-center rounded-control [&_svg]:size-4',
                    look.tile,
                  )}
                >
                  <Icon />
                </span>
                <span className="flex min-w-0 grow flex-col">
                  <span className="text-sm leading-5 font-semibold">
                    {t(`kind.${category.kind}`)}
                  </span>
                  {expanded ? null : (
                    <span className="truncate text-xs leading-4 font-normal text-muted-foreground">
                      {more > 0
                        ? t('summaryMore', { names: category.names.join(', '), count: more })
                        : category.names.join(', ')}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'text-sm font-semibold tracking-[-0.01em] tabular-nums',
                    look.count,
                  )}
                >
                  {category.count}
                </span>
              </AccordionTrigger>
              <AccordionContent className="-mx-4 flex flex-col gap-1.5 pb-3.5 [&_a]:no-underline">
                {category.items.map((item) => (
                  <PersonItem
                    key={item.id}
                    tone="soft"
                    size="sm"
                    media={<ItemMedia item={item} />}
                    name={item.student?.fullName ?? item.group?.name ?? ''}
                    subtitle={line(category.kind, item)}
                    href={
                      item.student
                        ? `/app/students/${item.student.id}`
                        : item.group
                          ? `/app/groups/${item.group.id}`
                          : undefined
                    }
                    action={
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        className="shrink-0 bg-card"
                        onClick={() => onAction({ kind: category.kind, item })}
                      >
                        {t(`action.${category.kind}`)}
                      </Button>
                    }
                  />
                ))}
                {category.count > category.items.length && href ? (
                  <Link
                    href={href}
                    className="inline-flex w-fit items-center gap-1 pt-1 text-sm font-semibold text-brand no-underline outline-none hover:underline focus-visible:outline-2 focus-visible:outline-ring [&_svg]:size-4"
                  >
                    {t('all', { count: category.count })}
                    <ChevronRightIcon aria-hidden="true" />
                  </Link>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </Card>
  );
}
