'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  AuthMe,
  LessonResponse,
  PackageResponse,
  ParentDetail,
  ParentListItem,
  StudentDetail,
  StudentListItem,
} from '@tutorio/validation';
import { paginationQuerySchema } from '@tutorio/validation';
import { SessionProvider } from '@/components/app/session-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SESSION_QUERY_KEY } from '@/lib/auth/client';
import { createCalendarRoutes, type CalendarStoryOptions } from './calendar-story-backend';
import { createGroupRoutes, type GroupStoryOptions } from './group-story-backend';
import {
  createLessonCreateRoutes,
  type LessonCreateStoryOptions,
} from './lesson-create-story-backend';
import { createLessonListRoutes, type LessonListStoryOptions } from './lesson-list-story-backend';
import { createLessonRoutes, type LessonStoryOptions } from './lesson-story-backend';

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
    timezone: 'Europe/Kyiv',
    scheduleHorizonWeeks: 4,
    lowCreditThreshold: 2,
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

type SampleParent = Omit<ParentDetail, 'workspaceId' | 'students'>;

const parentId = (n: number) => `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`;

const sampleParent = (
  n: number,
  fields: Partial<SampleParent> & Pick<SampleParent, 'fullName'>,
): SampleParent => ({
  id: parentId(n),
  email: null,
  phone: null,
  telegramUsername: null,
  avatarKey: null,
  notes: null,
  createdAt: '2026-08-12T09:00:00.000Z',
  updatedAt: '2026-09-09T09:00:00.000Z',
  deletedAt: null,
  ...fields,
});

/** The parents of the design boards; their links to students are below. */
export const SAMPLE_PARENTS: SampleParent[] = [
  sampleParent(1, {
    fullName: 'Iryna Shevchenko',
    phone: '+380 50 111 22 33',
    telegramUsername: 'iryna_s',
    email: 'iryna.sh@example.test',
    avatarKey: 'user-9',
    notes: 'Payment questions by Telegram only, calls after 6 pm.',
  }),
  sampleParent(2, {
    fullName: 'Oleh Lysenko',
    phone: '+380 63 900 11 22',
    avatarKey: 'user-8',
    createdAt: '2026-08-20T09:00:00.000Z',
  }),
  sampleParent(3, {
    fullName: 'Nataliia Melnyk',
    phone: '+380 97 145 62 30',
    telegramUsername: 'nat_m',
    createdAt: '2026-08-25T09:00:00.000Z',
  }),
  sampleParent(4, {
    fullName: 'Tetiana Shevchuk',
    phone: '+380 50 332 90 14',
    avatarKey: 'user-10',
    createdAt: '2026-08-28T09:00:00.000Z',
  }),
  sampleParent(5, {
    fullName: 'Andrii Bondar',
    phone: '+380 67 800 22 41',
    telegramUsername: 'a_bondar',
    createdAt: '2026-09-01T09:00:00.000Z',
  }),
  sampleParent(6, {
    fullName: 'Mariia Koval',
    telegramUsername: 'm_koval',
    createdAt: '2026-09-05T09:00:00.000Z',
  }),
];

export type ParentLink = { parentId: string; studentId: string };

export const SAMPLE_PARENT_LINKS: ParentLink[] = [
  { parentId: parentId(1), studentId: id(1) },
  { parentId: parentId(1), studentId: id(3) },
  { parentId: parentId(1), studentId: id(8) },
  { parentId: parentId(2), studentId: id(5) },
  { parentId: parentId(3), studentId: id(2) },
  { parentId: parentId(4), studentId: id(4) },
  { parentId: parentId(5), studentId: id(6) },
];

export const storyParentId = (index: number) => SAMPLE_PARENTS[index].id;

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
    enrollmentId: `66666666-6666-4666-8666-${String(n).padStart(12, '0')}`,
    studentId,
    groupId: null,
    name,
    sizingMode: 'FIXED_COUNT',
    lessonsTotal: total,
    lessonsPerWeek: null,
    validFrom: null,
    transferredFromPackageId: null,
    endDate: null,
    pricePerLessonMinorSnapshot: 50000,
    totalPriceMinorSnapshot: total * 50000,
    remainingCredits: left,
    consumedCredits: total - left,
    paidMinor: paid,
    refundedMinor: 0,
    currency: 'UAH',
    paymentStatus: paid >= total * 50000 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING',
    purchasedAt: '2026-09-01T10:00:00.000Z',
    expiresAt: null,
    notes: null,
    student: { id: studentId, fullName: '' },
    group: null,
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
    teacherId: teacher.id,
    startsAtUtc,
    durationMin,
    priceMinor: 50000,
    currency: 'UAH',
    status,
    isDetached: false,
    rescheduledCount: 0,
    kind: 'REGULAR',
    originalLessonId: null,
    makeupLessonId: null,
    topic: null,
    rescheduledAt: null,
    cancelledBy: status.startsWith('CANCELLED') ? 'STUDENT' : null,
    cancelledReason: null,
    cancelledAt: null,
    completedAt: status === 'COMPLETED' ? startsAtUtc : null,
    paidAt: null,
    notes: null,
    cancellationDeadlineHours: 12,
    attendance: null,
    charges: [],
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
  // Under way at the story clock, 65 of 90 minutes in: the ticket follows it
  // and it leads the upcoming rows as "In progress".
  lesson(11, anna, at(0, 13, 55), 'SCHEDULED', TEACHER_B, 90, { id: 'g1', name: 'B1 English' }),
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

export type StoryBackendOptions = GroupStoryOptions &
  CalendarStoryOptions &
  LessonListStoryOptions &
  LessonStoryOptions &
  LessonCreateStoryOptions & {
    students?: SampleStudent[];
    packages?: PackageResponse[];
    lessons?: LessonResponse[];
    /** Holds the student detail request open, or fails it. */
    detail?: 'ready' | 'pending' | 'error';
    /** Holds the student list request open, or fails it. */
    list?: 'ready' | 'pending' | 'error';
    /** Makes student create and update requests fail. */
    saveFails?: boolean;
    parents?: SampleParent[];
    parentLinks?: ParentLink[];
    /** Holds the parent list request open, or fails it. */
    parentList?: 'ready' | 'pending' | 'error';
    /** Holds the parent detail request open, or fails it. */
    parentDetail?: 'ready' | 'pending' | 'error';
    /** Makes parent create, update and link requests fail. */
    parentSaveFails?: boolean;
    /** Delays every save, so a story can act while one is in flight. */
    saveDelayMs?: number;
    /** The signed-in role; delete is owner-only. */
    role?: AuthMe['role'];
    /** The studio's mode; a solo studio hides every teacher control. */
    mode?: AuthMe['workspace']['mode'];
  };

/** The signed-in session of a story: its role and the studio's mode. */
function sessionFor(options: StoryBackendOptions): AuthMe {
  return {
    ...storySession,
    role: options.role ?? storySession.role,
    workspace: { ...storySession.workspace, mode: options.mode ?? storySession.workspace.mode },
  };
}

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

function toDetail(
  item: SampleStudent,
  parents: SampleParent[],
  links: ParentLink[],
): StudentDetail {
  const { groupNames: _groups, ...rest } = item;
  void _groups;
  return {
    ...rest,
    workspaceId: WORKSPACE,
    updatedAt: '2026-09-09T09:00:00.000Z',
    parents: parents
      .filter((parent) =>
        links.some((link) => link.parentId === parent.id && link.studentId === item.id),
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((parent) => ({
        id: parent.id,
        fullName: parent.fullName,
        avatarKey: parent.avatarKey,
        phone: parent.phone,
        telegramUsername: parent.telegramUsername,
      })),
    enrollments: [],
  };
}

/** A parent's roster, as the API builds it: live linked students by name. */
function rosterOf(parent: SampleParent, students: SampleStudent[], links: ParentLink[]) {
  return students
    .filter(
      (item) =>
        item.deletedAt === null &&
        links.some((link) => link.parentId === parent.id && link.studentId === item.id),
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((item) => ({
      id: item.id,
      fullName: item.fullName,
      avatarKey: item.avatarKey,
      status: item.status,
      languageLevel: item.languageLevel,
    }));
}

function toParentListItem(
  parent: SampleParent,
  students: SampleStudent[],
  links: ParentLink[],
): ParentListItem {
  return {
    id: parent.id,
    fullName: parent.fullName,
    email: parent.email,
    phone: parent.phone,
    telegramUsername: parent.telegramUsername,
    avatarKey: parent.avatarKey,
    deletedAt: parent.deletedAt,
    students: rosterOf(parent, students, links),
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function createHandler(options: StoryBackendOptions) {
  const students = [...(options.students ?? SAMPLE_STUDENTS)];
  const packages = options.packages ?? SAMPLE_PACKAGES;
  const lessons = options.lessons ?? SAMPLE_LESSONS;
  const parents = (options.parents ?? SAMPLE_PARENTS).map((parent) => ({ ...parent }));
  let links = [...(options.parentLinks ?? SAMPLE_PARENT_LINKS)];
  const detailOf = (item: SampleStudent) => toDetail(item, parents, links);
  const groupRoutes = createGroupRoutes(options);
  const calendarRoutes = createCalendarRoutes(options);
  const lessonListRoutes = createLessonListRoutes(options);
  const lessonRoutes = createLessonRoutes(options);
  const lessonCreateRoutes = createLessonCreateRoutes(options);
  const settle = () =>
    options.saveDelayMs
      ? new Promise((resolve) => setTimeout(resolve, options.saveDelayMs))
      : Promise.resolve();

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input.toString(), 'http://story.local');
    const path = url.pathname.replace(/^\/api\/backend/, '');
    const method = (init?.method ?? 'GET').toUpperCase();
    const query = url.searchParams;
    const never = () => new Promise<Response>(() => undefined);

    if (path === '/auth/me') return json(sessionFor(options));

    // The API validates every list query; so does the story backend, or a
    // screen that asks for more than the API allows looks fine only here.
    if (method === 'GET' && query.has('pageSize')) {
      const paging = paginationQuerySchema.safeParse({
        page: query.get('page') ?? undefined,
        pageSize: query.get('pageSize') ?? undefined,
      });
      if (!paging.success) return json({ code: 'VALIDATION_FAILED' }, 400);
    }

    const readBody = () => JSON.parse(String(init?.body ?? '{}'));
    const lessonListResponse = await lessonListRoutes(path, method, query, readBody);
    if (lessonListResponse) return lessonListResponse;
    const calendarResponse = await calendarRoutes(path, method, query, readBody);
    if (calendarResponse) return calendarResponse;
    const lessonCreateResponse = await lessonCreateRoutes(path, method, query);
    if (lessonCreateResponse) return lessonCreateResponse;
    const lessonResponse = await lessonRoutes(path, method, query, readBody);
    if (lessonResponse) return lessonResponse;
    const groupResponse = await groupRoutes(path, method, query, readBody);
    if (groupResponse) return groupResponse;

    // Any sample lesson opens in the lesson panel, with nothing linked to it.
    const lessonMatch = method === 'GET' ? path.match(/^\/lessons\/([^/]+)$/) : null;
    const listed = lessonMatch ? lessons.find((item) => item.id === lessonMatch[1]) : undefined;
    if (listed) {
      return json({ ...listed, original: null, makeup: null, schedule: null, history: [] });
    }

    // Before the detail route: "summary" is not a student id.
    if (path === '/students/summary') {
      const count = (status: SampleStudent['status']) =>
        students.filter((item) => item.status === status).length;
      return json({
        all: count('ACTIVE') + count('ON_HOLD'),
        ACTIVE: count('ACTIVE'),
        ON_HOLD: count('ON_HOLD'),
        ARCHIVED: count('ARCHIVED'),
      });
    }

    const detailMatch = path.match(/^\/students\/([^/]+)(\/restore)?$/);
    if (detailMatch) {
      const found = students.find((item) => item.id === detailMatch[1]);
      if (method === 'GET') {
        if (options.detail === 'pending') return never();
        if (options.detail === 'error' || !found) return json({ code: 'UNEXPECTED' }, 500);
        return json(detailOf(found));
      }
      await settle();
      if (options.saveFails) return json({ code: 'UNEXPECTED' }, 500);
      if (found && method === 'PATCH') {
        const { parentIds, ...fields } = JSON.parse(String(init?.body ?? '{}')) as Partial<
          SampleStudent & { parentIds: string[] }
        >;
        Object.assign(found, fields);
        if (parentIds) {
          links = [
            ...links.filter((link) => link.studentId !== found.id),
            ...parentIds.map((linked) => ({ parentId: linked, studentId: found.id })),
          ];
        }
      }
      // Like the API: archiving changes the status and never sets deletedAt.
      if (found && method === 'DELETE') Object.assign(found, { status: 'ARCHIVED' });
      if (found && detailMatch[2]) Object.assign(found, { status: 'ACTIVE' });
      return method === 'DELETE'
        ? new Response(null, { status: 204 })
        : json(found ? detailOf(found) : {});
    }

    if (path === '/students') {
      if (method === 'POST') {
        if (options.saveFails) return json({ code: 'UNEXPECTED' }, 500);
        return json({
          ...toDetail(FRESH_STUDENT, parents, links),
          ...JSON.parse(String(init?.body ?? '{}')),
        });
      }
      const pageSize = Number(query.get('pageSize') ?? 20);
      if (options.list === 'pending' && pageSize > 1) return never();
      if (options.list === 'error' && pageSize > 1) return json({ code: 'UNEXPECTED' }, 500);
      // The API's student semantics: `state` selects by status (archived
      // students are never soft-deleted) and an explicit `status` wins.
      const status = query.get('status');
      const state = query.get('state') ?? 'active';
      const search = query.get('search')?.toLowerCase();
      const rows = students.filter(
        (item) =>
          (status
            ? item.status === status
            : state === 'deleted'
              ? item.status === 'ARCHIVED'
              : state === 'all' || item.status !== 'ARCHIVED') &&
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

    const parentMatch = path.match(/^\/parents\/([^/]+)$/);
    if (parentMatch) {
      const found = parents.find((item) => item.id === parentMatch[1]);
      if (method === 'GET') {
        if (options.parentDetail === 'pending') return never();
        if (!found) return json({ code: 'PARENT_NOT_FOUND' }, 404);
        if (options.parentDetail === 'error') return json({ code: 'UNEXPECTED' }, 500);
        return json({
          ...found,
          workspaceId: WORKSPACE,
          students: rosterOf(found, students, links),
        } satisfies ParentDetail);
      }
      await settle();
      if (options.parentSaveFails) return json({ code: 'UNEXPECTED' }, 500);
      if (!found) return json({ code: 'PARENT_NOT_FOUND' }, 404);
      if (method === 'DELETE') {
        parents.splice(parents.indexOf(found), 1);
        links = links.filter((link) => link.parentId !== found.id);
        return new Response(null, { status: 204 });
      }
      const { studentIds, ...fields } = JSON.parse(String(init?.body ?? '{}')) as Partial<
        SampleParent & { studentIds: string[] }
      >;
      Object.assign(found, fields);
      if (studentIds) {
        links = [
          ...links.filter((link) => link.parentId !== found.id),
          ...studentIds.map((studentId) => ({ parentId: found.id, studentId })),
        ];
      }
      return json({ ...found, workspaceId: WORKSPACE });
    }

    if (path === '/parents') {
      if (method === 'POST') {
        await settle();
        if (options.parentSaveFails) return json({ code: 'UNEXPECTED' }, 500);
        const { studentIds = [], ...fields } = JSON.parse(String(init?.body ?? '{}')) as Partial<
          SampleParent & { studentIds: string[] }
        > & { fullName: string };
        const created = sampleParent(90 + parents.length, {
          ...fields,
          createdAt: new Date(STORY_CLOCK).toISOString(),
        });
        parents.push(created);
        links = [...links, ...studentIds.map((studentId) => ({ parentId: created.id, studentId }))];
        return json({ ...created, workspaceId: WORKSPACE }, 201);
      }
      const pageSize = Number(query.get('pageSize') ?? 20);
      const pageNumber = Number(query.get('page') ?? 1);
      if (options.parentList === 'pending' && pageSize > 1) return never();
      if (options.parentList === 'error' && pageSize > 1) return json({ code: 'UNEXPECTED' }, 500);
      const search = query.get('search')?.toLowerCase();
      const studentId = query.get('studentId');
      const unlinked = query.get('linked') === 'none';
      const createdAt = (row: ParentListItem) =>
        parents.find((parent) => parent.id === row.id)?.createdAt ?? '';
      const rows = parents
        .map((parent) => toParentListItem(parent, students, links))
        .filter(
          (item) =>
            (!search ||
              [item.fullName, item.phone, item.telegramUsername, item.email].some((value) =>
                value?.toLowerCase().includes(search),
              )) &&
            (!studentId || item.students.some((child) => child.id === studentId)) &&
            (!unlinked || item.students.length === 0),
        )
        .sort((a, b) =>
          query.get('sort') === 'createdAt'
            ? createdAt(b).localeCompare(createdAt(a))
            : a.fullName.localeCompare(b.fullName),
        );
      const start = (pageNumber - 1) * pageSize;
      return json({
        items: rows.slice(start, start + pageSize),
        page: pageNumber,
        pageSize,
        total: rows.length,
        totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
      });
    }

    // Everything else the screens touch (groups, teachers, enrollments,
    // series) is an empty collection in these stories.
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
    queryClient.setQueryData(SESSION_QUERY_KEY, sessionFor(options));
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
