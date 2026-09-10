'use client';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toneTextClass, type StatusIcon, type StatusTone } from './status-meta';
import { cn } from '@/lib/utils';

export type { StatusTone };

export interface StatusOption {
  value: string;
  label: string;
  tone: StatusTone;
  icon: StatusIcon;
}
/** Icon + label line shared by the status picker and the list status filter. */
export function StatusRow({
  icon: Icon,
  tone,
  label,
}: {
  icon: StatusIcon;
  tone: StatusTone;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <Icon className={cn('shrink-0', toneTextClass[tone])} aria-hidden="true" />
      {label}
    </span>
  );
}
// Domain layers map their own DTO values and localized copy into this neutral contract.
export function StatusSelect({
  id,
  value,
  onValueChange,
  options,
  className,
  invalid,
  'aria-label': ariaLabel,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: StatusOption[];
  className?: string;
  invalid?: boolean;
  'aria-label'?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        id={id}
        className={cn('w-full', className)}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <StatusRow icon={option.icon} tone={option.tone} label={option.label} />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
