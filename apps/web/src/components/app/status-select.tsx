'use client';

import type { ComponentType, CSSProperties } from 'react';
import { ArchiveIcon, CircleCheckIcon, CirclePauseIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Lifecycle colours share the semantic --status-* tokens the badges use, so a
// status looks the same as a pill and as a select row.
export type StatusTone = 'active' | 'paused' | 'archived' | 'overdue' | 'paid' | 'neutral';
type IconType = ComponentType<{ className?: string; style?: CSSProperties }>;

export interface StatusOption {
  value: string;
  label: string;
  tone: StatusTone;
  icon: IconType;
}

function toneStyle(tone: StatusTone): CSSProperties | undefined {
  return tone === 'neutral' ? undefined : { color: `var(--status-${tone})` };
}

function StatusRow({ option }: { option: StatusOption }) {
  const Icon = option.icon;
  return (
    <span className="flex items-center gap-2">
      <Icon className="size-4 shrink-0" style={toneStyle(option.tone)} />
      {option.label}
    </span>
  );
}

// The single status picker — icon + colour per option — reused by every form
// that edits a lifecycle status. Pass the options from one of the builder
// hooks below (or a custom list of the same shape).
export function StatusSelect({
  id,
  value,
  onValueChange,
  options,
  className,
  invalid,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: StatusOption[];
  className?: string;
  invalid?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} className={cn('w-full', className)} aria-invalid={invalid || undefined}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <StatusRow option={option} />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function useStudentStatusOptions(): StatusOption[] {
  const t = useTranslations('studentStatus');
  return [
    { value: 'ACTIVE', label: t('ACTIVE'), tone: 'active', icon: CircleCheckIcon },
    { value: 'ON_HOLD', label: t('ON_HOLD'), tone: 'paused', icon: CirclePauseIcon },
    { value: 'ARCHIVED', label: t('ARCHIVED'), tone: 'archived', icon: ArchiveIcon },
  ];
}

export function useEnrollmentStatusOptions(): StatusOption[] {
  const t = useTranslations('enrollmentStatus');
  return [
    { value: 'ACTIVE', label: t('ACTIVE'), tone: 'active', icon: CircleCheckIcon },
    { value: 'PAUSED', label: t('PAUSED'), tone: 'paused', icon: CirclePauseIcon },
    { value: 'ARCHIVED', label: t('ARCHIVED'), tone: 'archived', icon: ArchiveIcon },
  ];
}
