'use client';

import { useState } from 'react';
import { LayersIcon, PencilIcon, SlidersHorizontalIcon, UserRoundIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AuditActionDto, AuditEntityDto } from '@tutorio/validation';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { FilterPill } from '@/components/shared/filter-pill';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
  filterCount,
  filtersActive,
  type AuditFilters,
  type AuditPeriod,
} from '../model/audit';
import { AuditFilterSheet } from './audit-filter-sheet';
import { AuditPeriodMenu } from './audit-period-menu';

export type AuditMember = { userId: string; name: string; avatarKey: string | null };

export type AuditToolbarActions = {
  onEntity: (entity: AuditEntityDto | null) => void;
  onAction: (action: AuditActionDto | null) => void;
  onActor: (actorId: string | null) => void;
  onPeriod: (period: AuditPeriod, range?: { from: string; to: string }) => void;
  onApply: (filters: Pick<AuditFilters, 'entity' | 'action' | 'actorId'>) => void;
  onReset: () => void;
};

const ALL = '__all';

/**
 * The log's filters (S10 board 04): «Що змінили», «Дія», «Хто» and the
 * period, then the ghost «Скинути» once one is set. Phones fold the first
 * three into «Фільтри» with their count and a sheet.
 */
export function AuditToolbar({
  filters,
  members,
  now,
  compact,
  actions,
}: {
  filters: AuditFilters;
  members: readonly AuditMember[];
  now: number;
  compact: boolean;
  actions: AuditToolbarActions;
}) {
  const t = useTranslations('settings.audit');
  const [sheet, setSheet] = useState(false);
  const actor = members.find((member) => member.userId === filters.actorId) ?? null;
  const reset = filtersActive(filters) ? (
    <Button type="button" variant="ghost" onClick={actions.onReset}>
      <XIcon data-icon="inline-start" />
      {t('filters.reset')}
    </Button>
  ) : null;
  const period = (
    <AuditPeriodMenu filters={filters} now={now} short={compact} onPeriod={actions.onPeriod} />
  );

  if (compact) {
    const count = filterCount(filters);
    return (
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          icon={<SlidersHorizontalIcon />}
          label={t('filters.sheet')}
          count={count > 0 ? count : undefined}
          pressed={count > 0}
          onClick={() => setSheet(true)}
        />
        {period}
        {reset}
        <AuditFilterSheet
          open={sheet}
          onOpenChange={setSheet}
          filters={filters}
          members={members}
          onApply={actions.onApply}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <FilterPill
            menu
            icon={<LayersIcon />}
            pressed={Boolean(filters.entity)}
            count={filters.entity ? 1 : undefined}
            label={filters.entity ? t(`entity.${filters.entity}`) : t('filters.entity')}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-96">
          <DropdownMenuRadioGroup
            value={filters.entity ?? ALL}
            onValueChange={(next) =>
              actions.onEntity(next === ALL ? null : (next as AuditEntityDto))
            }
          >
            <DropdownMenuRadioItem value={ALL}>{t('filters.allEntities')}</DropdownMenuRadioItem>
            <DropdownMenuSeparator />
            {AUDIT_ENTITIES.map((entity) => (
              <DropdownMenuRadioItem key={entity} value={entity}>
                {t(`entity.${entity}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <FilterPill
            menu
            icon={<PencilIcon />}
            pressed={Boolean(filters.action)}
            count={filters.action ? 1 : undefined}
            label={filters.action ? t(`action.${filters.action}`) : t('filters.action')}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup
            value={filters.action ?? ALL}
            onValueChange={(next) =>
              actions.onAction(next === ALL ? null : (next as AuditActionDto))
            }
          >
            <DropdownMenuRadioItem value={ALL}>{t('filters.allActions')}</DropdownMenuRadioItem>
            <DropdownMenuSeparator />
            {AUDIT_ACTIONS.map((action) => (
              <DropdownMenuRadioItem key={action} value={action}>
                {t(`action.${action}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <FilterPill
            menu
            icon={<UserRoundIcon />}
            pressed={Boolean(filters.actorId)}
            count={filters.actorId ? 1 : undefined}
            label={actor?.name ?? t('filters.actor')}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-96">
          <DropdownMenuRadioGroup
            value={filters.actorId ?? ALL}
            onValueChange={(next) => actions.onActor(next === ALL ? null : next)}
          >
            <DropdownMenuRadioItem value={ALL}>{t('filters.allPeople')}</DropdownMenuRadioItem>
            <DropdownMenuSeparator />
            {members.map((member) => (
              <DropdownMenuRadioItem key={member.userId} value={member.userId}>
                <EntityAvatar avatarKey={member.avatarKey} fullName={member.name} size="xs" />
                {member.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {period}
      {reset}
    </div>
  );
}
