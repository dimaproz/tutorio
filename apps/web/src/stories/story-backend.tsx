'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  AuthMe,
  LessonResponse,
  PackageResponse,
  StudentDetail,
  StudentListItem,
} from '@tutorio/validation';
import { SessionProvider } from '@/components/app/session-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SESSION_QUERY_KEY } from '@/lib/auth/client';

/**
 * A deterministic, in-memory backend for screen stories. It answers the same
 * `/api/backend/*` requests the app makes, so a story renders the real
 * feature component — queries, rollups and all — against design sample data
 * instead of a mocked component tree. Sample data lives only in Storybook.
 */

export const STORY_CLOCK = Date.parse('2026-09-09T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const at = (days: number, hour: number, minute = 0) =>
  new Date(
    Date.UTC(2026, 8, 9) + days * DAY + ((hour - 3) * 60 + minute) * 60 * 1000,
  ).toISOString();

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const TEACHER_A = { id: '55555555-5555-4555-8555-555555555555', name: 'Dmytro Tutor', color: null };
const TEACHER_B = { id: '55555555-5555-4555-8555-555555555556', name: 'Iryna Bondar', color: null };

export const storySession: AuthMe = {
  user: {
    id: '66666666-6666-4666-8666-666666666666',
    email: 'olena@example.test',
    name: 'Olena Kovalenko',
  },
  workspace: {
    id: WORKSPACE,
    name: 'Kyiv English Studio',
    plan: 'PRO',
    mode: 'SCHOOL',
    defaultCurrency: 'UAH',
    cancellationDeadlineHours: 12,
  },
  role: 'OWNER',
};

type SampleStudent = Omit<
  StudentDetail,
  'workspaceId' | 'enrollments' | 'parents' | 'updatedAt'
> & {
  groupNames: string[];
};

const id = (n: number) => `d6bf671d-7a0f-4cf3-8a67-${String(n).padStart(12, '0')}`;

const student = (
  n: number,
  fields: Partial<SampleStudent> & Pick<SampleStudent, 'fullName'>,
): SampleStudent => ({
  id: id(n),
  email: null,
  phone: null,
  timezone: 'Europe/Kyiv',
  telegramUsername: null,
  hourlyRateMinor: 50000,
  currency: 'UAH',
  status: 'ACTIVE',
  languageLevel: null,
  knowledgeLevel: null,
  age: null,
  grade: null,
  avatarKey: null,
  notes: null,
  createdAt: '2026-08-20T09:00:00.000Z',
  deletedAt: null,
  groupNames: [],
  ...fields,
});

export const SAMPLE_STUDENTS: SampleStudent[] = [
  student(1, {
    fullName: 'Anna Shevchenko',
    telegramUsername: 'anna_s',
    email: 'anna@example.test',
    phone: '+380501112233',
    avatarKey: 'user-1',
    languageLevel: 'B2',
    knowledgeLevel: 'INTERMEDIATE',
    age: 15,
    grade: 10,
    notes: 'Preparing for the B2 exam. Strong reading; practise free speaking and past tenses.',
  }),
  student(2, {
    fullName: 'Sofiia Melnyk',
    telegramUsername: 'sofi_m',
    avatarKey: 'user-4',
    languageLevel: 'B1',
  }),
  student(3, {
    fullName: 'Maksym Tkachenko',
    email: 'maksym.t@example.test',
    avatarKey: 'user-2',
    groupNames: ['B1 English'],
  }),
  student(4, { fullName: 'Daryna Kravets', phone: '+380507710312', avatarKey: 'user-6' }),
  student(5, { fullName: 'Artem Lysenko', telegramUsername: 'artem_lys', avatarKey: 'user-3' }),
  student(6, {
    fullName: 'Viktoriia Hnatiuk',
    email: 'vika.h@example.test',
    avatarKey: 'user-9',
    groupNames: ['B1 English'],
  }),
  student(7, {
    fullName: 'Oleksii Koval',
    phone: '+380672041855',
    status: 'ON_HOLD',
    groupNames: ['B1 English'],
    languageLevel: 'B2',
    age: 15,
    grade: 10,
  }),
  student(8, {
    fullName: 'Kateryna Bondarenko',
    phone: '+380501112233',
    status: 'ARCHIVED',
    deletedAt: '2026-09-01T10:00:00.000Z',
    languageLevel: 'A2',
    age: 14,
  }),
];

/** A student who was just created: nothing booked, bought or recorded yet. */
export const FRESH_STUDENT = student(9, {
  fullName: 'Sofiia Melnyk',
  phone: '+380672041855',
  telegramUsername: 'sofi_m',
  createdAt: '2026-09-09T10:00:00.000Z',
});

function pkg(
  n: number,
  studentId: string,
  name: string,
  total: number,
  left: number,
  paid: number,
): PackageResponse {
  return {
    id: `77777777-7777-4777-8777-${String(n).padStart(12, '0')}`,
    workspaceId: WORKSPACE,
    studentId,
    groupId: null,
    name,
    sizingMode: 'FIXED_COUNT',
    lessonsTotal: total,
    endDate: null,
    pricePerLessonMinorSnapshot: 50000,
    totalPriceMinorSnapshot: total * 50000,
    effectiveTotalMinor: total * 50000,
    remainingCredits: left,
    consumedCredits: total - left,
    paidMinor: paid,
    currency: 'UAH',
    paymentStatus: paid >= total * 50000 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING',
    purchasedAt: '2026-09-01T10:00:00.000Z',
    expiresAt: null,
    notes: null,
    student: null,
    group: null,
    shares: [],
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    deletedAt: null,
  } as PackageResponse;
}

export const SAMPLE_PACKAGES: PackageResponse[] = [
  pkg(1, id(1), 'B2 preparation', 8, 6, 400000),
  pkg(2, id(2), 'Speaking', 8, 1, 160000),
  pkg(3, id(3), 'B1 group', 10, 6, 500000),
  pkg(4, id(4), 'Individual', 8, 4, 200000),
  pkg(5, id(5), 'IELTS', 8, 0, 0),
  pkg(6, id(6), 'B1 group', 10, 8, 500000),
  pkg(7, id(7), 'B1 group', 8, 2, 400000),
];

function lesson(
  n: number,
  who: SampleStudent,
  startsAtUtc: string,
  status: LessonResponse['status'],
  teacher = TEACHER_A,
  durationMin = 60,
  group: { id: string; name: string } | null = null,
): LessonResponse {
  return {
    id: `88888888-8888-4888-8888-${String(n).padStart(12, '0')}`,
    workspaceId: WORKSPACE,
    enrollmentId: null,
    groupId: group?.id ?? null,
    seriesId: null,
    packageId: SAMPLE_PACKAGES.find((item) => item.studentId === who.id)?.id ?? null,
    teacherId: teacher.id,
    startsAtUtc,
    durationMin,
    priceMinor: 50000,
    currency: 'UAH',
    status,
    isDetached: false,
    rescheduledCount: 0,
    rescheduledAt: null,
    cancelledBy: status.startsWith('CANCELLED') ? 'STUDENT' : null,
    cancelledReason: null,
    cancelledAt: null,
    completedAt: status === 'COMPLETED' ? startsAtUtc : null,
    paidAt: null,
    notes: null,
    cancellationDeadlineHours: 12,
    student: group ? null : { id: who.id, fullName: who.fullName },
    group,
    teacher,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    deletedAt: null,
  } as LessonResponse;
}

const [anna, sofiia, maksym, daryna, artem, vika] = SAMPLE_STUDENTS;
export const SAMPLE_LESSONS: LessonResponse[] = [
  lesson(1, anna, at(2, 17), 'SCHEDULED'),
  lesson(2, anna, at(7, 17), 'SCHEDULED'),
  lesson(3, anna, at(-1, 17), 'COMPLETED'),
  lesson(4, anna, at(-5, 17), 'CANCELLED_CHARGED'),
  ...Array.from({ length: 10 }, (_, index) =>
    lesson(40 + index, anna, at(-8 - index * 3, 17), 'COMPLETED'),
  ),
  lesson(5, sofiia, at(0, 15, 30), 'SCHEDULED', TEACHER_B, 45),
  lesson(6, maksym, at(7, 18), 'SCHEDULED', TEACHER_A, 90),
  lesson(7, daryna, at(3, 10), 'SCHEDULED', TEACHER_B),
  lesson(8, artem, at(6, 19), 'SCHEDULED'),
  lesson(9, vika, at(7, 18), 'SCHEDULED', TEACHER_B, 90),
  lesson(10, anna, at(1, 18), 'SCHEDULED', TEACHER_B, 90, { id: 'g1', name: 'B1 English' }),
];

export type StoryBackendOptions = {
  students?: SampleStudent[];
  packages?: PackageResponse[];
  lessons?: LessonResponse[];
  /** Holds the student detail request open, or fails it. */
  detail?: 'ready' | 'pending' | 'error';
  /** Holds the student list request open, or fails it. */
  list?: 'ready' | 'pending' | 'error';
  /** Makes student create and update requests fail. */
  saveFails?: boolean;
};

const page = <T,>(items: T[], pageSize = 20) => ({
  items: items.slice(0, pageSize),
  page: 1,
  pageSize,
  total: items.length,
  totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
});

function toListItem(item: SampleStudent): StudentListItem {
  return {
    id: item.id,
    fullName: item.fullName,
    email: item.email,
    phone: item.phone,
    telegramUsername: item.telegramUsername,
    timezone: item.timezone,
    status: item.status,
    hourlyRateMinor: item.hourlyRateMinor,
    currency: item.currency,
    avatarKey: item.avatarKey,
    createdAt: item.createdAt,
    deletedAt: item.deletedAt,
    activeEnrollmentCount: item.status === 'ARCHIVED' ? 0 : 1,
    groupNames: item.groupNames,
  };
}

function toDetail(item: SampleStudent): StudentDetail {
  const { groupNames: _groups, ...rest } = item;
  void _groups;
  return {
    ...rest,
    workspaceId: WORKSPACE,
    updatedAt: '2026-09-09T09:00:00.000Z',
    parents:
      item.id === id(1) || item.id === id(8)
        ? [
            {
              id: '33333333-3333-4333-8333-333333333333',
              fullName: 'Iryna Shevchenko',
              avatarKey: null,
              phone: '+380501234567',
              telegramUsername: null,
            },
          ]
        : [],
    enrollments: [],
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function createHandler(options: StoryBackendOptions) {
  const students = [...(options.students ?? SAMPLE_STUDENTS)];
  const packages = options.packages ?? SAMPLE_PACKAGES;
  const lessons = options.lessons ?? SAMPLE_LESSONS;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input.toString(), 'http://story.local');
    const path = url.pathname.replace(/^\/api\/backend/, '');
    const method = (init?.method ?? 'GET').toUpperCase();
    const query = url.searchParams;
    const never = () => new Promise<Response>(() => undefined);

    if (path === '/auth/me') return json(storySession);

    const detailMatch = path.match(/^\/students\/([^/]+)(\/restore)?$/);
    if (detailMatch) {
      const found = students.find((item) => item.id === detailMatch[1]);
      if (method === 'GET') {
        if (options.detail === 'pending') return never();
        if (options.detail === 'error' || !found) return json({ code: 'UNEXPECTED' }, 500);
        return json(toDetail(found));
      }
      if (options.saveFails) return json({ code: 'UNEXPECTED' }, 500);
      if (found && method === 'PATCH') Object.assign(found, JSON.parse(String(init?.body ?? '{}')));
      if (found && method === 'DELETE')
        Object.assign(found, {
          status: 'ARCHIVED',
          deletedAt: new Date(STORY_CLOCK).toISOString(),
        });
      if (found && detailMatch[2]) Object.assign(found, { status: 'ACTIVE', deletedAt: null });
      return method === 'DELETE'
        ? new Response(null, { status: 204 })
        : json(found ? toDetail(found) : {});
    }

    if (path === '/students') {
      if (method === 'POST') {
        if (options.saveFails) return json({ code: 'UNEXPECTED' }, 500);
        return json({ ...toDetail(FRESH_STUDENT), ...JSON.parse(String(init?.body ?? '{}')) });
      }
      const pageSize = Number(query.get('pageSize') ?? 20);
      if (options.list === 'pending' && pageSize > 1) return never();
      if (options.list === 'error' && pageSize > 1) return json({ code: 'UNEXPECTED' }, 500);
      const status = query.get('status');
      const state = query.get('state') ?? 'active';
      const search = query.get('search')?.toLowerCase();
      const rows = students.filter(
        (item) =>
          (status
            ? item.status === status
            : state === 'deleted'
              ? item.status === 'ARCHIVED'
              : item.status !== 'ARCHIVED') &&
          (!search || item.fullName.toLowerCase().includes(search)),
      );
      return json(page(rows.map(toListItem), pageSize));
    }

    if (path === '/lessons') {
      if (method !== 'GET') return json({});
      const from = Date.parse(query.get('from') ?? '');
      const to = Date.parse(query.get('to') ?? '');
      const rows = lessons.filter((item) => {
        const start = Date.parse(item.startsAtUtc);
        const studentId = query.get('studentId');
        const belongs =
          !studentId ||
          item.student?.id === studentId ||
          (item.groupId !== null && studentId === id(1));
        return (
          start >= from &&
          start <= to &&
          belongs &&
          (!query.get('status') || item.status === query.get('status'))
        );
      });
      return json({ items: rows.sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc)) });
    }

    if (path === '/packages') {
      const studentId = query.get('studentId');
      const rows = studentId ? packages.filter((item) => item.studentId === studentId) : packages;
      return json(page(rows, Number(query.get('pageSize') ?? 20)));
    }

    // Everything else the screens touch (groups, parents, teachers,
    // enrollments, series) is an empty collection in these stories.
    return json(page([]));
  };
}

/**
 * Wraps a screen story: installs the in-memory backend before the first
 * request, supplies the session and a fresh query cache, and restores the
 * real `fetch` when the story unmounts.
 */
export function StoryBackend({
  children,
  ...options
}: StoryBackendOptions & { children: ReactNode }) {
  const [client] = useState(() => {
    const original = window.fetch;
    (window as { __storyFetch?: typeof fetch }).__storyFetch ??= original;
    window.fetch = createHandler(options) as typeof fetch;
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData(SESSION_QUERY_KEY, storySession);
    return queryClient;
  });

  useEffect(
    () => () => {
      const original = (window as { __storyFetch?: typeof fetch }).__storyFetch;
      if (original) window.fetch = original;
    },
    [],
  );

  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <SessionProvider>{children}</SessionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export const storyStudentId = (index: number) => SAMPLE_STUDENTS[index].id;
export const FRESH_STUDENT_ID = FRESH_STUDENT.id;
