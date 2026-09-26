'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { AuditActionDto, AuditEntityDto } from '@tutorio/validation';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditFilters } from '../model/audit';
import type { AuditMember } from './audit-toolbar';

type Draft = Pick<AuditFilters, 'entity' | 'action' | 'actorId'>;

const ALL = '__all';
const EMPTY: Draft = { entity: null, action: null, actorId: null };

function SheetHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="pt-3 pb-1 text-xs leading-4 font-semibold tracking-[0.06em] text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

/** One radio list of the sheet: «all» first, then the options. */
function Choice({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  options: { value: string; label: string; media?: ReactNode }[];
  onChange: (value: string | null) => void;
}) {
  return (
    <RadioGroup
      aria-label={label}
      value={value ?? ALL}
      onValueChange={(next) => onChange(next === ALL ? null : next)}
      className="gap-0"
    >
      {options.map((option) => (
        <div key={option.value} className="flex min-h-12 items-center gap-3">
          <RadioGroupItem id={`${id}-${option.value}`} value={option.value} />
          {option.media}
          <Label
            htmlFor={`${id}-${option.value}`}
            className="grow text-[15px] leading-5 font-normal"
          >
            {option.label}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}

/**
 * The phone's «Фільтри» (S10 phone board 04): what changed, the action and
 * who as radio lists; «Скинути» clears the draft and «Показати» applies it.
 */
export function AuditFilterSheet({
  open,
  onOpenChange,
  filters,
  members,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AuditFilters;
  members: readonly AuditMember[];
  onApply: (draft: Draft) => void;
}) {
  const t = useTranslations('settings.audit');
  const [draft, setDraft] = useState<Draft>(filters);
  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(filters);
        onOpenChange(next);
      }}
    >
      <DrawerContent>
        <DrawerHeader className="flex-row items-center justify-between px-5 pt-5 pb-0">
          <DrawerTitle className="text-xl leading-7 font-semibold">
            {t('filters.sheet')}
          </DrawerTitle>
          <DrawerDescription className="sr-only">{t('filters.sheetDescription')}</DrawerDescription>
          <Button type="button" variant="ghost" onClick={() => setDraft(EMPTY)}>
            {t('filters.reset')}
          </Button>
        </DrawerHeader>
        <div className="scrollbar-thin flex min-h-0 flex-col gap-1 overflow-y-auto px-5 pt-2">
          <SheetHeading>{t('filters.entity')}</SheetHeading>
          <Choice
            id="audit-sheet-entity"
            label={t('filters.entity')}
            value={draft.entity}
            onChange={(entity) => update({ entity: entity as AuditEntityDto | null })}
            options={[
              { value: ALL, label: t('filters.allEntities') },
              ...AUDIT_ENTITIES.map((entity) => ({ value: entity, label: t(`entity.${entity}`) })),
            ]}
          />
          <SheetHeading>{t('filters.action')}</SheetHeading>
          <Choice
            id="audit-sheet-action"
            label={t('filters.action')}
            value={draft.action}
            onChange={(action) => update({ action: action as AuditActionDto | null })}
            options={[
              { value: ALL, label: t('filters.allActions') },
              ...AUDIT_ACTIONS.map((action) => ({ value: action, label: t(`action.${action}`) })),
            ]}
          />
          <SheetHeading>{t('filters.actor')}</SheetHeading>
          <Choice
            id="audit-sheet-actor"
            label={t('filters.actor')}
            value={draft.actorId}
            onChange={(actorId) => update({ actorId })}
            options={[
              { value: ALL, label: t('filters.allPeople') },
              ...members.map((member) => ({
                value: member.userId,
                label: member.name,
                media: (
                  <EntityAvatar avatarKey={member.avatarKey} fullName={member.name} size="xs" />
                ),
              })),
            ]}
          />
        </div>
        <DrawerFooter className="px-5 pt-4">
          <Button
            type="button"
            size="xl"
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            {t('filters.apply')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
