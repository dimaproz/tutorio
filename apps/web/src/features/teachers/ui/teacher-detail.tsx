'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArchiveIcon, UserRoundXIcon } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import type {
  GroupListItem,
  LessonResponse,
  ScheduleResponse,
  TeacherResponse,
  TeacherStudent,
  TeacherSummary,
} from '@tutorio/validation';
import { useSession } from '@/components/app/session-provider';
import { DetailFrame } from '@/components/shared/detail-frame';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingPanel } from '@/components/shared/loading';
import { Notice } from '@/components/shared/notice';
import { useSetPageCrumb } from '@/components/shared/page-crumb';
import { QueryErrorAlert } from '@/components/shared/page-shell';
import { Button } from '@/components/ui/button';
import {
  LessonCreateDialog,
  LessonPanel,
  ScheduleChangeDialog,
  ScheduleCreateDialog,
  ScheduleStopDialog,
  useLessonPanel,
  useSchedulesQuery,
  type LessonPanelLinks,
} from '@/features/lessons';
import { useGroupsQuery } from '@/lib/api/groups';
import { useLessonsQuery } from '@/lib/api/scheduling';
import {
  useTeacherQuery,
  useTeacherStudentsQuery,
  useTeacherSummaryQuery,
  useTeachersQuery,
} from '@/lib/api/teachers';
import { addCalendarDays, dayStartIso } from '@/lib/datetime';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { currentMonday, teacherColor, teacherWeek } from '../model/presentation';
import { TeacherNotesCard, TeacherStudentsCard, TeacherTeachingCard } from './teacher-aside';
import { TeacherHeader } from './teacher-header';
import { TeacherMetrics } from './teacher-metrics';
import { TeacherWeek } from './teacher-week';
import { TeacherWorkCard, type WorkList } from './teacher-work-card';
import { useTeacherActions } from './use-teacher-actions';

/** Where the lesson panel links a student and a group. */
const LESSON_LINKS: LessonPanelLinks = {
  studentHref: (id) => `/app/students/${id}`,
  groupHref: (id) => `/app/groups/${id}`,
};
/** The first rows of the students and the schedules, and each «Показати ще». */
const FIRST_STUDENTS = 8;
const FIRST_SCHEDULES = 6;
const MORE = 6;

/** The last page read, kept on screen while a longer one loads. */
function useKept<T>(value: T | undefined): T | undefined {
  const [kept, setKept] = useState(value);
  if (value !== undefined && value !== kept) setKept(value);
  return value ?? kept;
}

/**
 * The teacher's profile (S09 board 02). Every read starts together, keyed by
 * the id in the URL: the teacher, the metrics, the week, the groups, the
 * schedules and the students.
 */
export function TeacherDetailView({ teacherId }: { teacherId: string }) {
  const t = useTranslations('teachers.profile');
  const clock = useNow();
  const [now] = useState(() => clock.getTime());
  const timeZone = useStudioTimeZone();
  const [monday, setMonday] = useState(() => currentMonday(now, timeZone));
  const [studentRows, setStudentRows] = useState(FIRST_STUDENTS);
  const [scheduleRows, setScheduleRows] = useState(FIRST_SCHEDULES);

  const teacher = useTeacherQuery(teacherId);
  const summary = useTeacherSummaryQuery(teacherId);
  const range = useMemo(
    () => ({
      from: dayStartIso(monday, timeZone),
      to: dayStartIso(addCalendarDays(monday, 7), timeZone),
    }),
    [monday, timeZone],
  );
  const lessons = useLessonsQuery({ ...range, teacherId });
  const groups = useGroupsQuery({ page: 1, pageSize: 50, teacherId, state: 'active' });
  const schedules = useSchedulesQuery({ teacherId, pageSize: scheduleRows, sort: 'next' });
  const students = useTeacherStudentsQuery(teacherId, studentRows);
  const scheduleData = useKept(schedules.data);

  if (teacher.isPending) return <DetailFrame loading={<LoadingPanel size="lg" />} />;
  if (!teacher.data) {
    return (
      <DetailFrame
        error={
          teacher.error?.status === 404 ? (
            <EmptyState
              framed
              icon={<UserRoundXIcon />}
              title={t('error.notFoundTitle')}
              text={t('error.notFoundText')}
              action={
                <Button asChild variant="outline">
                  <Link href="/app/teachers">{t('error.back')}</Link>
                </Button>
              }
            />
          ) : (
            <QueryErrorAlert
              error={teacher.error}
              title={t('error.title')}
              onRetry={() => void teacher.refetch()}
            />
          )
        }
      />
    );
  }

  return (
    <TeacherProfileContent
      teacher={teacher.data}
      now={now}
      summary={summary.data}
      week={{
        monday,
        lessons: lessons.data?.items ?? [],
        loading: lessons.isPending || lessons.isPlaceholderData,
        onStep: (days) => setMonday((current) => addCalendarDays(current, days)),
      }}
      groups={{
        items: groups.data?.items ?? [],
        total: groups.data?.total ?? 0,
        loading: groups.isPending,
      }}
      schedules={{
        items: scheduleData?.items ?? [],
        total: scheduleData?.total ?? 0,
        loading: !scheduleData,
      }}
      onMoreSchedules={() => setScheduleRows((rows) => rows + MORE)}
      students={{
        items: students.data?.items ?? [],
        total: students.data?.total ?? 0,
        loading: students.isPending,
      }}
      onMoreStudents={() => setStudentRows((rows) => rows + MORE)}
    />
  );
}

/**
 * The page itself: the header in the teacher's colour, the four metrics, the
 * week, then the groups and schedules on the left and the students, the
 * owner's «Викладання» and the notes on the right; one column below a
 * desktop. An archived teacher reads the same with a banner, a grey header
 * with «Відновити» and no week.
 */
export function TeacherProfileContent({
  teacher,
  now,
  summary,
  week,
  groups,
  schedules,
  onMoreSchedules,
  students,
  onMoreStudents,
}: {
  teacher: TeacherResponse;
  now: number;
  summary: TeacherSummary | undefined;
  week: {
    monday: string;
    lessons: LessonResponse[];
    loading: boolean;
    onStep: (days: number) => void;
  };
  groups: WorkList<GroupListItem>;
  schedules: WorkList<ScheduleResponse>;
  onMoreSchedules: () => void;
  students: WorkList<TeacherStudent>;
  onMoreStudents: () => void;
}) {
  const t = useTranslations('teachers.profile');
  const format = useFormatter();
  const timeZone = useStudioTimeZone();
  const session = useSession();
  const studio = session.workspace.mode === 'SCHOOL';
  useSetPageCrumb(t('crumb'));
  const lessonPanel = useLessonPanel();
  const [creatingLesson, setCreatingLesson] = useState(false);
  const [creatingSchedule, setCreatingSchedule] = useState(false);
  const [changing, setChanging] = useState<ScheduleResponse | null>(null);
  const [stopping, setStopping] = useState<ScheduleResponse | null>(null);

  const teachers = useTeachersQuery({ page: 1, pageSize: 1, status: 'ACTIVE' }, teacher.isMe);
  const activeCount = teachers.data?.counts.active ?? 0;
  const actions = useTeacherActions({
    otherActiveTeachers: activeCount - (teacher.status === 'ACTIVE' ? 1 : 0),
  });
  const commands = studio ? actions.commands : { ...actions.commands, onSwitchToSolo: undefined };
  const archived = teacher.status === 'ARCHIVED' && !teacher.isMe;
  const teaching = teacher.status === 'ACTIVE';
  const color = teacherColor(teacher);
  const calendarHref = `/app/calendar?teacher=${teacher.id}&date=${week.monday}`;
  const weekData = teacherWeek(week.lessons, week.monday, now, timeZone);

  const identity = (
    <div className="flex flex-col gap-4">
      {archived && teacher.archivedAt ? (
        <Notice
          tone="warning"
          icon={<ArchiveIcon />}
          title={t('archivedNotice.title', {
            date: format.dateTime(new Date(teacher.archivedAt), { day: 'numeric', month: 'long' }),
          })}
          text={t('archivedNotice.text')}
        />
      ) : null}
      <TeacherHeader
        teacher={teacher}
        commands={commands}
        restoring={actions.busyId === teacher.id}
      />
    </div>
  );

  return (
    <>
      <DetailFrame
        ratio="wide"
        identity={identity}
        metrics={
          <div className="flex flex-col gap-4 md:gap-6">
            <TeacherMetrics teacher={teacher} summary={summary} />
            {archived ? null : (
              <TeacherWeek
                week={weekData}
                color={color}
                loading={week.loading}
                onPrevious={() => week.onStep(-7)}
                onNext={() => week.onStep(7)}
                onOpenLesson={lessonPanel.open}
                onNewLesson={teaching ? () => setCreatingLesson(true) : undefined}
                calendarHref={calendarHref}
              />
            )}
          </div>
        }
        main={
          <TeacherWorkCard
            teacherId={teacher.id}
            groups={groups}
            schedules={schedules}
            now={now}
            moreStep={MORE}
            onMoreSchedules={onMoreSchedules}
            onNewSchedule={teaching ? () => setCreatingSchedule(true) : undefined}
            onChangeSchedule={archived ? undefined : setChanging}
            onStopSchedule={archived ? undefined : setStopping}
          />
        }
        aside={
          <>
            <TeacherStudentsCard
              students={students.items}
              total={students.total}
              loading={students.loading}
              moreStep={MORE}
              onMore={onMoreStudents}
            />
            {teacher.isMe && studio ? (
              <TeacherTeachingCard
                teaching={teaching}
                busy={actions.busyId === teacher.id}
                onChange={(next) =>
                  next ? commands.onRestore(teacher) : commands.onStopTeaching(teacher)
                }
              />
            ) : null}
            <TeacherNotesCard teacher={teacher} readOnly={false} />
          </>
        }
      />
      {actions.dialogs}
      <LessonCreateDialog
        open={creatingLesson}
        onOpenChange={setCreatingLesson}
        initial={{ teacherId: teacher.id }}
      />
      <ScheduleCreateDialog
        open={creatingSchedule}
        onOpenChange={setCreatingSchedule}
        initial={{ teacherId: teacher.id }}
      />
      {changing ? (
        <ScheduleChangeDialog
          open
          onOpenChange={(open) => !open && setChanging(null)}
          schedule={changing}
        />
      ) : null}
      {stopping ? (
        <ScheduleStopDialog
          open
          onOpenChange={(open) => !open && setStopping(null)}
          schedule={stopping}
        />
      ) : null}
      <LessonPanel
        lessonId={lessonPanel.lessonId}
        intent={lessonPanel.intent}
        onClose={lessonPanel.close}
        onOpenLesson={lessonPanel.open}
        linkTo={lessonPanel.linkTo}
        links={LESSON_LINKS}
      />
    </>
  );
}
