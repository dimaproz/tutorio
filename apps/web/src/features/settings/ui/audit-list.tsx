'use client';

import { Fragment, type ReactNode } from 'react';
import {
  BanknoteIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CompassIcon,
  GraduationCapIcon,
  HeartIcon,
  LayersIcon,
  PackageIcon,
  PauseIcon,
  RepeatIcon,
  SettingsIcon,
  SparklesIcon,
  UsersIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AuditActionDto, AuditEntityDto, AuditLogListItem } from '@tutorio/validation';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { SectionDivider } from '@/components/shared/section-divider';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { visibleFields, type AuditDay } from '../model/audit';
import { AuditDiff } from './audit-diff';
import type { useAuditFormat } from './use-audit-format';

type Format = ReturnType<typeof useAuditFormat>;

const ENTITY_ICON: Record<AuditEntityDto, ReactNode> = {
  WORKSPACE: <SettingsIcon />,
  STUDENT: <UsersIcon />,
  PARENT: <HeartIcon />,
  GROUP: <LayersIcon />,
  TEACHER: <GraduationCapIcon />,
  ENROLLMENT: <CompassIcon />,
  LESSON: <CalendarDaysIcon />,
  LESSON_SERIES: <RepeatIcon />,
  SCHEDULE: <RepeatIcon />,
  PAUSE: <PauseIcon />,
  LESSON_PACKAGE: <PackageIcon />,
  PAYMENT: <BanknoteIcon />,
};

/** «Створено · success, Змінено · info, Архівовано · warning, Відновлено · neutral». */
const ACTION_BADGE = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'warning',
  RESTORE: 'neutral',
} as const satisfies Record<AuditActionDto, string>;

/** The grid of a desktop row: 64 / 1.25fr / 120 / 2fr / 190 / 24 (S10 board 04). */
const ROW_GRID =
  'grid grid-cols-[64px_minmax(0,1.25fr)_120px_minmax(0,2fr)_190px_24px] items-center gap-x-4';

export type AuditActor = { name: string; avatarKey: string | null };

function EntityTile({ entity }: { entity: AuditEntityDto }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center rounded-control bg-tile-indigo text-tile-indigo-foreground [&_svg]:size-4.5"
    >
      {ENTITY_ICON[entity]}
    </span>
  );
}

function ActionBadge({ action }: { action: AuditActionDto }) {
  const t = useTranslations('settings.audit.action');
  return <Badge variant={ACTION_BADGE[action]}>{t(action)}</Badge>;
}

/** Who: the person with their avatar, or Tutorio when nobody did it (L-50). */
function Who({ actor }: { actor: AuditActor | null }) {
  const t = useTranslations('settings.audit');
  if (!actor) {
    return (
      <span className="flex min-w-0 items-center gap-2.5 text-sm text-muted-foreground">
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-pill bg-background [&_svg]:size-3.5"
        >
          <SparklesIcon />
        </span>
        <span className="truncate">{t('system')}</span>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-2.5 text-sm">
      <EntityAvatar avatarKey={actor.avatarKey} fullName={actor.name} size="xs" />
      <span className="truncate">{actor.name}</span>
    </span>
  );
}

type RowProps = {
  item: AuditLogListItem;
  actor: AuditActor | null;
  format: Format;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** A desktop row: time, record, action, summary, who; it opens into its diff. */
function AuditRow({ item, actor, format, open, onOpenChange }: RowProps) {
  const t = useTranslations('settings.audit');
  const expandable = visibleFields(item).length > 0;
  const cells = (
    <>
      <span className="tabular-nums text-sm text-muted-foreground">
        {format.time(item.createdAt)}
      </span>
      <span className="flex min-w-0 items-center gap-3">
        <EntityTile entity={item.entity} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm leading-5 font-semibold">
            {format.recordTitle(item)}
          </span>
          <span className="truncate text-xs leading-4 text-muted-foreground">
            {format.entity(item.entity)}
          </span>
        </span>
      </span>
      <span>
        <ActionBadge action={item.action} />
      </span>
      <span className="truncate text-sm text-muted-foreground">{format.summary(item)}</span>
      <Who actor={actor} />
      <span className="flex justify-end text-muted-foreground">
        {expandable ? (
          open ? (
            <ChevronDownIcon aria-hidden="true" className="size-4.5" />
          ) : (
            <ChevronRightIcon aria-hidden="true" className="size-4.5" />
          )
        ) : null}
      </span>
    </>
  );

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className={cn(
        'rounded-row transition-colors',
        open ? 'bg-primary/4 ring-1 ring-primary/25' : 'border-b border-border last:border-b-0',
      )}
    >
      {expandable ? (
        <CollapsibleTrigger
          aria-label={`${format.recordTitle(item)} · ${t('open')}`}
          className={cn(
            ROW_GRID,
            'min-h-16 w-full rounded-row px-5 py-2.5 text-left outline-none hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            open && 'hover:bg-transparent',
          )}
        >
          {cells}
        </CollapsibleTrigger>
      ) : (
        <div className={cn(ROW_GRID, 'min-h-16 px-5 py-2.5')}>{cells}</div>
      )}
      <CollapsibleContent className="px-5 pb-4 pl-[100px]">
        <AuditDiff item={item} format={format} compact={false} />
      </CollapsibleContent>
    </Collapsible>
  );
}

/** A phone card: tile, name, «entity · time», the badge, the summary and who. */
function AuditCard({ item, actor, format, open, onOpenChange }: RowProps) {
  const t = useTranslations('settings.audit');
  const expandable = visibleFields(item).length > 0;
  const head = (
    <span className="flex items-start gap-3">
      <EntityTile entity={item.entity} />
      <span className="flex min-w-0 grow flex-col">
        <span className="text-[15px] leading-5 font-bold break-words">
          {format.recordTitle(item)}
        </span>
        <span className="text-xs leading-5 text-muted-foreground">
          {format.entity(item.entity)} · {format.time(item.createdAt)}
        </span>
      </span>
      <ActionBadge action={item.action} />
    </span>
  );
  const foot = (
    <span className="flex items-center justify-between gap-3">
      <Who actor={actor} />
      {expandable ? (
        open ? (
          <ChevronDownIcon aria-hidden="true" className="size-4.5 text-muted-foreground" />
        ) : (
          <ChevronRightIcon aria-hidden="true" className="size-4.5 text-muted-foreground" />
        )
      ) : null}
    </span>
  );

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} asChild>
      <Card className={cn('gap-3 px-4 py-4', open && 'ring-1 ring-primary/25')}>
        {expandable ? (
          <CollapsibleTrigger
            aria-label={`${format.recordTitle(item)} · ${t('open')}`}
            className="-m-1 flex flex-col gap-3 rounded-tile p-1 text-left outline-none focus-visible:outline-2 focus-visible:outline-ring"
          >
            {head}
            {open ? null : (
              <span className="text-sm leading-5 text-muted-foreground">
                {format.summary(item)}
              </span>
            )}
            {open ? null : foot}
          </CollapsibleTrigger>
        ) : (
          <>
            {head}
            <span className="text-sm leading-5 text-muted-foreground">{format.summary(item)}</span>
            {foot}
          </>
        )}
        <CollapsibleContent className="flex flex-col gap-3">
          <AuditDiff item={item} format={format} compact />
          <CollapsibleTrigger
            aria-label={`${format.recordTitle(item)} · ${t('open')}`}
            className="rounded-tile text-left outline-none focus-visible:outline-2 focus-visible:outline-ring"
          >
            {foot}
          </CollapsibleTrigger>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/**
 * The log (S10 board 04): a card with the column captions and a divider per
 * day on desktop; cards on phones. One row opens at a time.
 */
export function AuditList({
  days,
  actorOf,
  format,
  openId,
  onOpen,
  compact,
}: {
  days: AuditDay<AuditLogListItem>[];
  actorOf: (item: AuditLogListItem) => AuditActor | null;
  format: Format;
  openId: string | null;
  onOpen: (id: string | null) => void;
  compact: boolean;
}) {
  const t = useTranslations('settings.audit');
  const rowProps = (item: AuditLogListItem) => ({
    item,
    actor: actorOf(item),
    format,
    open: openId === item.id,
    onOpenChange: (open: boolean) => onOpen(open ? item.id : null),
  });

  if (compact) {
    return (
      <section aria-label={t('listLabel')} className="flex flex-col gap-3">
        {days.map((day) => (
          <Fragment key={day.day}>
            <SectionDivider label={format.dayLabel(day.day)} className="pt-1" />
            {day.items.map((item) => (
              <AuditCard key={item.id} {...rowProps(item)} />
            ))}
          </Fragment>
        ))}
      </section>
    );
  }

  return (
    <Card className="gap-0 px-3 py-4" aria-label={t('listLabel')} role="region">
      <div
        aria-hidden="true"
        className={cn(
          ROW_GRID,
          'px-5 pb-3 text-xs leading-4 font-bold tracking-[0.06em] text-muted-foreground uppercase',
        )}
      >
        <span>{t('columns.time')}</span>
        <span>{t('columns.record')}</span>
        <span>{t('columns.action')}</span>
        <span>{t('columns.changes')}</span>
        <span>{t('columns.who')}</span>
        <span />
      </div>
      {days.map((day) => (
        <section key={day.day} aria-label={format.dayLabel(day.day)} className="flex flex-col">
          <SectionDivider label={format.dayLabel(day.day)} className="px-2 pt-2 pb-1" />
          {day.items.map((item) => (
            <AuditRow key={item.id} {...rowProps(item)} />
          ))}
        </section>
      ))}
    </Card>
  );
}
