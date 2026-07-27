'use client';

import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ENROLLMENT_STATUS_META,
  LESSON_STATUS_META,
  STUDENT_STATUS_META,
  toneTextClass,
  type StatusIcon,
  type StatusTone,
} from '@/components/app/status-meta';
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
      <Icon className={cn('size-4 shrink-0', toneTextClass[tone])} />
      {label}
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
      <SelectTrigger
        id={id}
        className={cn('w-full', className)}
        aria-invalid={invalid || undefined}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="focus:text-primary">
              <StatusRow icon={option.icon} tone={option.tone} label={option.label} />
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
    { value: 'ACTIVE', label: t('ACTIVE'), ...STUDENT_STATUS_META.ACTIVE },
    { value: 'ON_HOLD', label: t('ON_HOLD'), ...STUDENT_STATUS_META.ON_HOLD },
    { value: 'ARCHIVED', label: t('ARCHIVED'), ...STUDENT_STATUS_META.ARCHIVED },
  ];
}

export function useLessonStatusOptions(): StatusOption[] {
  const t = useTranslations('scheduling.status');
  return [
    { value: 'SCHEDULED', label: t('SCHEDULED'), ...LESSON_STATUS_META.SCHEDULED },
    { value: 'COMPLETED', label: t('COMPLETED'), ...LESSON_STATUS_META.COMPLETED },
    {
      value: 'CANCELLED_UNCHARGED',
      label: t('CANCELLED_UNCHARGED'),
      ...LESSON_STATUS_META.CANCELLED_UNCHARGED,
    },
    {
      value: 'CANCELLED_CHARGED',
      label: t('CANCELLED_CHARGED'),
      ...LESSON_STATUS_META.CANCELLED_CHARGED,
    },
  ];
}

export function useEnrollmentStatusOptions(): StatusOption[] {
  const t = useTranslations('enrollmentStatus');
  return [
    { value: 'ACTIVE', label: t('ACTIVE'), ...ENROLLMENT_STATUS_META.ACTIVE },
    { value: 'PAUSED', label: t('PAUSED'), ...ENROLLMENT_STATUS_META.PAUSED },
    { value: 'ARCHIVED', label: t('ARCHIVED'), ...ENROLLMENT_STATUS_META.ARCHIVED },
  ];
}
