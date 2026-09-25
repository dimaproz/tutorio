// Stable query key factories. Every hook builds its key here so mutations can
// invalidate precisely instead of nuking the cache.

export interface StudentListFilters {
  page: number;
  search?: string;
  state?: 'active' | 'deleted' | 'all';
  status?: string;
  groupId?: string;
  /** Server-side column sorting; both fall back to the API defaults. */
  sort?: string;
  order?: 'asc' | 'desc';
  /** Pickers need a longer page than the 20-row list default. */
  pageSize?: number;
}

export interface GroupListFilters {
  page: number;
  search?: string;
  state?: 'active' | 'deleted' | 'all';
  status?: string;
  studentId?: string;
  teacherId?: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekday?: number;
  payment?: 'unpaid';
  sort?: string;
  order?: 'asc' | 'desc';
  pageSize?: number;
}

export interface ParentListFilters {
  page: number;
  search?: string;
  state?: 'active' | 'deleted' | 'all';
  studentId?: string;
  /** `none` keeps only parents with no linked student. */
  linked?: 'any' | 'none';
  sort?: 'fullName' | 'createdAt';
  order?: 'asc' | 'desc';
  pageSize?: number;
}

export interface EnrollmentListFilters {
  studentId?: string;
  groupId?: string;
  teacherId?: string;
  status?: string;
  page?: number;
}

export interface AuditListFilters {
  page: number;
  entity?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
}

export interface TeacherListFilters {
  page: number;
  search?: string;
  state?: 'active' | 'deleted' | 'all';
  status?: string;
  pageSize?: number;
}

export interface LessonListFilters {
  from: string;
  to: string;
  teacherId?: string;
  enrollmentId?: string;
  studentId?: string;
  groupId?: string;
  status?: string;
}

export interface PackageListFilters {
  page: number;
  pageSize?: number;
  studentId?: string;
  groupId?: string;
  paymentStatus?: string;
  state?: 'active' | 'deleted' | 'all';
}

export interface PaymentListFilters {
  page: number;
  pageSize?: number;
  enrollmentId?: string;
  packageId?: string;
  studentId?: string;
}

export interface SeriesListFilters {
  page: number;
  enrollmentId?: string;
  groupId?: string;
  teacherId?: string;
  pageSize?: number;
}

export const queryKeys = {
  students: {
    all: ['students'] as const,
    lists: (filters: StudentListFilters) => ['students', 'list', filters] as const,
    detail: (studentId: string) => ['students', 'detail', studentId] as const,
    /** A student's directions with how each is paid (S06). */
    billing: (studentId: string) => ['students', 'billing', studentId] as const,
  },
  groups: {
    all: ['groups'] as const,
    lists: (filters: GroupListFilters) => ['groups', 'list', filters] as const,
    listsAll: ['groups', 'list'] as const,
    summary: ['groups', 'summary'] as const,
    options: ['groups', 'options'] as const,
    detail: (groupId: string) => ['groups', 'detail', groupId] as const,
    attendanceAll: ['groups', 'attendance'] as const,
    attendance: (groupId: string, window: number) =>
      ['groups', 'attendance', groupId, window] as const,
  },
  parents: {
    all: ['parents'] as const,
    lists: (filters: ParentListFilters) => ['parents', 'list', filters] as const,
    detail: (parentId: string) => ['parents', 'detail', parentId] as const,
  },
  enrollments: {
    all: ['enrollments'] as const,
    lists: (filters: EnrollmentListFilters) => ['enrollments', 'list', filters] as const,
    detail: (enrollmentId: string) => ['enrollments', 'detail', enrollmentId] as const,
    billing: (enrollmentId: string) => ['enrollments', 'billing', enrollmentId] as const,
  },
  audit: {
    all: ['audit'] as const,
    lists: (filters: AuditListFilters) => ['audit', 'list', filters] as const,
  },
  teachers: {
    all: ['teachers'] as const,
    lists: (filters: TeacherListFilters) => ['teachers', 'list', filters] as const,
    detail: (teacherId: string) => ['teachers', 'detail', teacherId] as const,
  },
  lessons: {
    all: ['lessons'] as const,
    listsAll: ['lessons', 'list'] as const,
    lists: (filters: LessonListFilters) => ['lessons', 'list', filters] as const,
    attendance: (lessonId: string) => ['lessons', 'attendance', lessonId] as const,
    detail: (lessonId: string) => ['lessons', 'detail', lessonId] as const,
  },
  schedules: {
    all: ['schedules'] as const,
    detail: (scheduleId: string) => ['schedules', 'detail', scheduleId] as const,
    preview: (scheduleId: string, change: unknown) =>
      ['schedules', 'preview', scheduleId, change] as const,
  },
  series: {
    all: ['series'] as const,
    lists: (filters: SeriesListFilters) => ['series', 'list', filters] as const,
    detail: (seriesId: string) => ['series', 'detail', seriesId] as const,
  },
  packages: {
    all: ['packages'] as const,
    lists: (filters: PackageListFilters) => ['packages', 'list', filters] as const,
    everything: (filters: Omit<PackageListFilters, 'page' | 'pageSize'>) =>
      ['packages', 'list', 'everything', filters] as const,
    detail: (packageId: string) => ['packages', 'detail', packageId] as const,
    ledger: (packageId: string) => ['packages', 'ledger', packageId] as const,
  },
  payments: {
    all: ['payments'] as const,
    lists: (filters: PaymentListFilters) => ['payments', 'list', filters] as const,
  },
  workspace: {
    current: ['workspace', 'current'] as const,
    members: ['workspace', 'members'] as const,
  },
} as const;
