// Stable query key factories. Every hook builds its key here so mutations can
// invalidate precisely instead of nuking the cache.

export interface StudentListFilters {
  page: number;
  search?: string;
  state?: 'active' | 'deleted' | 'all';
  /** Pickers need a longer page than the 20-row list default. */
  pageSize?: number;
}

export interface GroupListFilters {
  page: number;
  search?: string;
  state?: 'active' | 'deleted' | 'all';
  pageSize?: number;
}

export interface ParentListFilters {
  page: number;
  search?: string;
  state?: 'active' | 'deleted' | 'all';
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

export const queryKeys = {
  students: {
    all: ['students'] as const,
    lists: (filters: StudentListFilters) => ['students', 'list', filters] as const,
    detail: (studentId: string) => ['students', 'detail', studentId] as const,
  },
  groups: {
    all: ['groups'] as const,
    lists: (filters: GroupListFilters) => ['groups', 'list', filters] as const,
    detail: (groupId: string) => ['groups', 'detail', groupId] as const,
  },
  parents: {
    all: ['parents'] as const,
    lists: (filters: ParentListFilters) => ['parents', 'list', filters] as const,
    detail: (parentId: string) => ['parents', 'detail', parentId] as const,
  },
  enrollments: {
    all: ['enrollments'] as const,
    lists: (filters: EnrollmentListFilters) => ['enrollments', 'list', filters] as const,
  },
  audit: {
    all: ['audit'] as const,
    lists: (filters: AuditListFilters) => ['audit', 'list', filters] as const,
  },
  workspace: {
    current: ['workspace', 'current'] as const,
    members: ['workspace', 'members'] as const,
  },
} as const;
