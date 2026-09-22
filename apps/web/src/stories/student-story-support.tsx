'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AuthMe, EnrollmentResponse, PackageResponse, ParentListItem, StudentDetail } from '@tutorio/validation';
import { SessionProvider } from '@/components/app/session-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { queryKeys } from '@/lib/api/keys';
import { GatewayError, SESSION_QUERY_KEY } from '@/lib/auth/client';

export const STORY_NOW = new Date('2026-09-09T12:00:00.000Z').getTime();
export const STORY_STUDENT_ID = 'd6bf671d-7a0f-4cf3-8a67-c7a46a2bf4e9';

export const storyStudent: StudentDetail = {
  id: STORY_STUDENT_ID,
  workspaceId: '11111111-1111-4111-8111-111111111111',
  fullName: 'Anna Shevchenko',
  email: 'anna@example.test',
  phone: '+380501112233',
  timezone: 'Europe/Kyiv',
  telegramUsername: 'anna_s',
  hourlyRateMinor: 50000,
  currency: 'UAH',
  status: 'ACTIVE',
  languageLevel: 'B2',
  knowledgeLevel: 'INTERMEDIATE',
  age: 15,
  grade: 10,
  avatarKey: 'user-1',
  parents: [{
    id: '33333333-3333-4333-8333-333333333333',
    fullName: 'Iryna Shevchenko',
    avatarKey: null,
    phone: '+380501234567',
    telegramUsername: null,
  }],
  enrollments: [{
    id: '44444444-4444-4444-8444-444444444444',
    status: 'ACTIVE',
    billingType: 'PACKAGE',
    priceMinor: 50000,
    currency: 'UAH',
    cancellationDeadlineHours: null,
    effectiveCancellationDeadlineHours: 12,
    group: null,
    teacher: { id: '55555555-5555-4555-8555-555555555555', name: 'Dmytro Tutor', color: null },
  }],
  notes: 'Preparing for the B2 exam.',
  createdAt: '2026-08-20T09:00:00.000Z',
  updatedAt: '2026-09-09T09:00:00.000Z',
  deletedAt: null,
};

export const storyEnrollment: EnrollmentResponse = {
  id: storyStudent.enrollments[0].id,
  workspaceId: storyStudent.workspaceId,
  studentId: storyStudent.id,
  groupId: null,
  teacherId: storyStudent.enrollments[0].teacher.id,
  student: { id: storyStudent.id, fullName: storyStudent.fullName },
  group: null,
  teacher: storyStudent.enrollments[0].teacher,
  status: storyStudent.enrollments[0].status,
  billingType: storyStudent.enrollments[0].billingType,
  priceMinor: storyStudent.enrollments[0].priceMinor,
  currency: 'UAH',
  cancellationDeadlineHours: null,
  effectiveCancellationDeadlineHours: 12,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  deletedAt: null,
};

const session: AuthMe = {
  user: { id: '66666666-6666-4666-8666-666666666666', email: 'owner@example.test', name: 'Owner' },
  workspace: {
    id: storyStudent.workspaceId,
    name: 'Tutorio Storybook',
    plan: 'PRO',
    mode: 'SCHOOL',
    defaultCurrency: 'UAH',
    cancellationDeadlineHours: 12,
  },
  role: 'OWNER',
};

export function StudentStoryProviders({
  children,
  student = storyStudent,
  cacheStudent = true,
  studentQueryState,
  packageQueryState,
  parentQueryState,
  enrollmentQueryState,
  packages = [],
  parents = [],
}: {
  children: ReactNode;
  student?: StudentDetail;
  cacheStudent?: boolean;
  studentQueryState?: 'pending' | 'error';
  packageQueryState?: 'pending' | 'error';
  parentQueryState?: 'pending' | 'error';
  enrollmentQueryState?: 'pending' | 'error' | 'missing';
  packages?: PackageResponse[];
  parents?: ParentListItem[];
}) {
  const [client] = useState(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
    queryClient.setQueryData(SESSION_QUERY_KEY, session);
    if (cacheStudent) queryClient.setQueryData(queryKeys.students.detail(student.id), student);
    if (!cacheStudent && studentQueryState === 'pending') {
      void queryClient.fetchQuery({ queryKey: queryKeys.students.detail(student.id), queryFn: () => new Promise(() => undefined) });
    }
    if (!cacheStudent && studentQueryState === 'error') {
      void queryClient.fetchQuery({ queryKey: queryKeys.students.detail(student.id), queryFn: async () => { throw new GatewayError(500, 'UNEXPECTED'); } }).catch(() => undefined);
    }
    const parentKey = queryKeys.parents.lists({ page: 1, pageSize: 100 });
    const activePackageKey = queryKeys.packages.lists({ page: 1, pageSize: 100, studentId: student.id, state: 'active' });
    const allPackageKey = queryKeys.packages.lists({ page: 1, pageSize: 100, studentId: student.id, state: 'all' });
    if (!parentQueryState) queryClient.setQueryData(parentKey, { items: parents, page: 1, pageSize: 100, total: parents.length, totalPages: 1 });
    if (parentQueryState === 'pending') void queryClient.fetchQuery({ queryKey: parentKey, queryFn: () => new Promise(() => undefined) });
    if (parentQueryState === 'error') void queryClient.fetchQuery({ queryKey: parentKey, queryFn: async () => { throw new GatewayError(500, 'UNEXPECTED'); } }).catch(() => undefined);
    if (!packageQueryState) {
      const activePackages = packages.filter((item) => item.deletedAt === null);
      queryClient.setQueryData(activePackageKey, { items: activePackages, page: 1, pageSize: 100, total: activePackages.length, totalPages: 1 });
      queryClient.setQueryData(allPackageKey, { items: packages, page: 1, pageSize: 100, total: packages.length, totalPages: 1 });
    }
    if (packageQueryState === 'pending') {
      void queryClient.fetchQuery({ queryKey: activePackageKey, queryFn: () => new Promise(() => undefined) });
      void queryClient.fetchQuery({ queryKey: allPackageKey, queryFn: () => new Promise(() => undefined) });
    }
    if (packageQueryState === 'error') {
      void queryClient.fetchQuery({ queryKey: activePackageKey, queryFn: async () => { throw new GatewayError(500, 'UNEXPECTED'); } }).catch(() => undefined);
      void queryClient.fetchQuery({ queryKey: allPackageKey, queryFn: async () => { throw new GatewayError(500, 'UNEXPECTED'); } }).catch(() => undefined);
    }
    const enrollmentKey = queryKeys.enrollments.detail(storyEnrollment.id);
    if (!enrollmentQueryState) queryClient.setQueryData(enrollmentKey, storyEnrollment);
    if (enrollmentQueryState === 'pending') void queryClient.fetchQuery({ queryKey: enrollmentKey, queryFn: () => new Promise(() => undefined) });
    if (enrollmentQueryState === 'error') void queryClient.fetchQuery({ queryKey: enrollmentKey, queryFn: async () => { throw new GatewayError(500, 'UNEXPECTED'); } }).catch(() => undefined);
    if (enrollmentQueryState === 'missing') void queryClient.fetchQuery({ queryKey: enrollmentKey, queryFn: async () => { throw new GatewayError(404, 'ENROLLMENT_NOT_FOUND'); } }).catch(() => undefined);
    queryClient.setQueryData(queryKeys.enrollments.lists({ page: 1, studentId: student.id }), { items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 });
    queryClient.setQueryData(queryKeys.students.lists({ page: 1, pageSize: 100 }), { items: [], page: 1, pageSize: 100, total: 0, totalPages: 1 });
    queryClient.setQueryData(queryKeys.groups.lists({ page: 1, pageSize: 100 }), { items: [], page: 1, pageSize: 100, total: 0, totalPages: 1 });
    queryClient.setQueryData(queryKeys.teachers.lists({ page: 1, pageSize: 100 }), { items: [], page: 1, pageSize: 100, total: 0, totalPages: 1 });
    const dayMs = 24 * 60 * 60 * 1000;
    queryClient.setQueryData(queryKeys.lessons.lists({
      from: new Date(STORY_NOW - 120 * dayMs).toISOString(),
      to: new Date(STORY_NOW + 120 * dayMs).toISOString(),
      studentId: student.id,
    }), { items: [] });
    return queryClient;
  });
  return <QueryClientProvider client={client}><TooltipProvider><SessionProvider>{children}</SessionProvider></TooltipProvider></QueryClientProvider>;
}
