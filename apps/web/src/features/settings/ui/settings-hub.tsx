'use client';

import { Fragment, useState, type ReactNode } from 'react';
import {
  Building2Icon,
  CalendarClockIcon,
  ChevronRightIcon,
  HistoryIcon,
  LayoutGridIcon,
  ReceiptIcon,
  SendIcon,
  WalletIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useNow, useTranslations } from 'next-intl';
import { useSession } from '@/components/app/session-provider';
import { PageHeader } from '@/components/shared/page-shell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item';
import { useAuditLogsQuery } from '@/lib/api/audit';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { formatMoneyCompact } from '@/lib/money';
import { cn } from '@/lib/utils';
import { weekTotalQuery } from '../model/audit';

type Area = {
  key: 'general' | 'lessons' | 'requisites' | 'payments' | 'telegram' | 'integrations' | 'audit';
  icon: ReactNode;
  /** A ready area opens its page; a later one is inert and marked «Незабаром». */
  href?: string;
  /** The current values, as chips on a card and one line on a phone row. */
  values?: string[];
};

type Group = { key: 'studio' | 'money' | 'connections' | 'control'; areas: Area[] };

/** The tile of an area: indigo when it opens, paper when it comes later. */
function AreaTile({
  icon,
  ready,
  className,
}: {
  icon: ReactNode;
  ready: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-control [&_svg]:size-5',
        ready
          ? 'bg-tile-indigo text-tile-indigo-foreground'
          : 'bg-background text-muted-foreground',
        className,
      )}
    >
      {icon}
    </span>
  );
}

/** A desktop card: tile, title, description and the values; a later area is muted. */
function AreaCard({ area }: { area: Area }) {
  const t = useTranslations('settings.hub');
  const ready = Boolean(area.href);
  const body = (
    <Card
      className={cn(
        'h-full gap-4 rounded-card p-5 transition-shadow duration-150',
        ready ? 'group-hover:shadow-raise' : 'opacity-78',
      )}
    >
      <div className="flex items-start justify-between">
        <AreaTile icon={area.icon} ready={ready} />
        {ready ? (
          <ChevronRightIcon aria-hidden="true" className="size-4.5 text-muted-foreground" />
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-[17px] leading-6 font-semibold">{t(`cards.${area.key}.title`)}</h3>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          {t(`cards.${area.key}.description`)}
        </p>
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        {ready ? (
          area.values?.map((value) => (
            <Badge key={value} variant="neutral" size="md" className="font-medium text-foreground">
              {value}
            </Badge>
          ))
        ) : (
          <Badge variant="neutral" size="md">
            {t('soon')}
          </Badge>
        )}
      </div>
    </Card>
  );
  return ready ? (
    <Link
      href={area.href!}
      className="group rounded-card outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {body}
    </Link>
  ) : (
    <div aria-disabled="true">{body}</div>
  );
}

/** A phone row: tile, title, the values or the description, and a chevron or «Скоро». */
function AreaRow({ area }: { area: Area }) {
  const t = useTranslations('settings.hub');
  const ready = Boolean(area.href);
  const content = (
    <>
      <ItemMedia>
        <AreaTile icon={area.icon} ready={ready} />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-0.5">
        <ItemTitle className={cn('text-[17px] font-bold', !ready && 'text-muted-foreground')}>
          {t(`cards.${area.key}.title`)}
        </ItemTitle>
        <ItemDescription className="text-sm">
          {ready && area.values ? area.values.join(' · ') : t(`cards.${area.key}.description`)}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {ready ? (
          <ChevronRightIcon aria-hidden="true" className="size-5 text-muted-foreground" />
        ) : (
          <Badge variant="neutral" size="md">
            {t('soonShort')}
          </Badge>
        )}
      </ItemActions>
    </>
  );
  return ready ? (
    <Item asChild className="min-h-16 rounded-none">
      <Link href={area.href!}>{content}</Link>
    </Item>
  ) : (
    <Item className="min-h-16" aria-disabled="true">
      {content}
    </Item>
  );
}

/**
 * The settings overview (`/app/settings`, S10 board 01): the areas by group
 * with their current values. Ready areas open their own page; requisites,
 * payments, the Telegram bot and integrations are inert «Незабаром» cards.
 * Phones list each group's areas in one card.
 */
export function SettingsHubPage() {
  const t = useTranslations('settings');
  const tUnits = useTranslations('settings.units');
  const tMode = useTranslations('settings.mode');
  const workspace = useSession().workspace;
  const timeZone = useStudioTimeZone();
  const clock = useNow();
  const [now] = useState(() => clock.getTime());
  const week = useAuditLogsQuery(weekTotalQuery(now, timeZone));

  const groups: Group[] = [
    {
      key: 'studio',
      areas: [
        {
          key: 'general',
          icon: <Building2Icon />,
          href: '/app/settings/general',
          values: [
            workspace.name,
            `${formatMoneyCompact(0, workspace.defaultCurrency, 'en').symbol} ${workspace.defaultCurrency}`,
            tMode(workspace.mode),
          ],
        },
        {
          key: 'lessons',
          icon: <CalendarClockIcon />,
          href: '/app/settings/lessons',
          values: [
            tUnits('hours', { count: workspace.cancellationDeadlineHours }),
            tUnits('weeks', { count: workspace.scheduleHorizonWeeks }),
            workspace.lowCreditThreshold === 0
              ? tUnits('noWarnings')
              : tUnits('lessons', { count: workspace.lowCreditThreshold }),
          ],
        },
      ],
    },
    {
      key: 'money',
      areas: [
        { key: 'requisites', icon: <ReceiptIcon /> },
        { key: 'payments', icon: <WalletIcon /> },
      ],
    },
    {
      key: 'connections',
      areas: [
        { key: 'telegram', icon: <SendIcon /> },
        { key: 'integrations', icon: <LayoutGridIcon /> },
      ],
    },
    {
      key: 'control',
      areas: [
        {
          key: 'audit',
          icon: <HistoryIcon />,
          href: '/app/settings/audit',
          values: [
            week.data ? t('hub.auditWeek', { count: week.data.total }) : t('hub.auditWeekLoading'),
          ],
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PageHeader size="xl" title={t('title')} description={t('subtitle')} />
      {groups.map((group) => (
        <section
          key={group.key}
          aria-labelledby={`settings-group-${group.key}`}
          className="flex flex-col gap-3 md:gap-4"
        >
          <h2
            id={`settings-group-${group.key}`}
            className="px-1 text-[13px] leading-4 font-semibold tracking-[0.06em] text-muted-foreground uppercase"
          >
            {t(`hub.groups.${group.key}`)}
          </h2>
          <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
            {group.areas.map((area) => (
              <AreaCard key={area.key} area={area} />
            ))}
          </div>
          <Card className="gap-0 py-0 md:hidden">
            {group.areas.map((area, index) => (
              <Fragment key={area.key}>
                {index > 0 ? <ItemSeparator className="my-0" /> : null}
                <AreaRow area={area} />
              </Fragment>
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}
