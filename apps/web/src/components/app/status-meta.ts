import type { ComponentType } from 'react';
import {
  ArchiveIcon,
  CalendarClockIcon,
  CircleCheckIcon,
  CircleSlashIcon,
  CircleXIcon,
  TreePalmIcon,
  UsersRoundIcon,
} from 'lucide-react';
import type {
  EnrollmentStatusDto,
  GroupStatusDto,
  LessonStatusDto,
  StudentStatusDto,
  TeacherStatusDto,
} from '@tutorio/validation';

// One registry for every lifecycle status: the badge, the picker and the list
// filter all read it, so a status looks the same everywhere it appears.
// Lifecycle names map to configurable semantic theme roles, never to a colour.
export type StatusTone =
  'primary' | 'warning' | 'secondary' | 'destructive' | 'success' | 'neutral';

export type StatusIcon = ComponentType<{ className?: string }>;

export interface StatusMeta {
  tone: StatusTone;
  icon: StatusIcon;
}

export const toneTextClass: Record<StatusTone, string> = {
  primary: 'text-primary',
  warning: 'text-warning',
  secondary: 'text-secondary-foreground',
  destructive: 'text-destructive',
  success: 'text-success',
  neutral: 'text-muted-foreground',
};

/** `neutral` has no pill of its own; it reads as the muted secondary badge. */
export function badgeVariantForTone(
  tone: StatusTone,
): 'primary' | 'warning' | 'secondary' | 'destructive' | 'success' {
  return tone === 'neutral' ? 'secondary' : tone;
}

// A paused student is on holiday, not stopped — hence the palm, not a pause.
export const STUDENT_STATUS_META: Record<StudentStatusDto, StatusMeta> = {
  ACTIVE: { tone: 'primary', icon: CircleCheckIcon },
  ON_HOLD: { tone: 'warning', icon: TreePalmIcon },
  ARCHIVED: { tone: 'secondary', icon: ArchiveIcon },
};

export const ENROLLMENT_STATUS_META: Record<EnrollmentStatusDto, StatusMeta> = {
  ACTIVE: { tone: 'primary', icon: CircleCheckIcon },
  PAUSED: { tone: 'warning', icon: TreePalmIcon },
  ARCHIVED: { tone: 'secondary', icon: ArchiveIcon },
};

export const GROUP_STATUS_META: Record<GroupStatusDto, StatusMeta> = {
  ACTIVE: { tone: 'primary', icon: CircleCheckIcon },
  EMPTY: { tone: 'warning', icon: UsersRoundIcon },
};

// A charged cancellation still costs the student a lesson, so it reads as a
// loss (destructive); an uncharged one is merely a gap in the schedule.
export const LESSON_STATUS_META: Record<LessonStatusDto, StatusMeta> = {
  SCHEDULED: { tone: 'primary', icon: CalendarClockIcon },
  COMPLETED: { tone: 'success', icon: CircleCheckIcon },
  CANCELLED_CHARGED: { tone: 'destructive', icon: CircleXIcon },
  CANCELLED_UNCHARGED: { tone: 'warning', icon: CircleSlashIcon },
};

export const TEACHER_STATUS_META: Record<TeacherStatusDto, StatusMeta> = {
  ACTIVE: { tone: 'primary', icon: CircleCheckIcon },
  ARCHIVED: { tone: 'secondary', icon: ArchiveIcon },
};
