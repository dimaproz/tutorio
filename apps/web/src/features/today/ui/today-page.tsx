'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNow, useTranslations } from 'next-intl';
import { useSession } from '@/components/app/session-provider';
import {
  LessonCreateDialog,
  LessonPanel,
  useLessonPanel,
  type LessonPanelLinks,
} from '@/features/lessons';
import { PackageOperationDialog, PackageSaleDialog } from '@/features/packages';
import { StudentPauseEndDialog, StudentPaymentDialog } from '@/features/students';
import { useIsMobile } from '@/hooks/use-mobile';
import { zonedDate } from '@/lib/datetime';
import { useLocalFormatter } from '@/lib/i18n/local-formatter';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { useDashboardFollowsMutations } from '../api';
import { partOfDay } from '../model/today';
import { AttentionCard, type AttentionAction } from './attention-card';
import { MoneyCard } from './money-card';
import { NowTicketSkeleton } from './now-ticket';
import { SetupBlock, type SetupStep } from './setup-block';
import { FreeDay, TodayDayList, TodayTicket, TodayTomorrow, type RowContext } from './today-day';
import { TodayHeader, type TodayAction } from './today-header';
import { useToday } from './use-today';

const LESSON_LINKS: LessonPanelLinks = {
  studentHref: (id) => `/app/students/${id}`,
  groupHref: (id) => `/app/groups/${id}`,
};

type Payment = { studentId?: string; enrollmentId?: string };
type Sale = { studentId?: string; enrollmentId?: string };

/**
 * The owner's Today page (S11, `/app`): the header with the scope switch and
 * the actions; the «Зараз» ticket, the day as one timeline and «Завтра» on
 * the left; «Гроші за місяць» and «Потребує уваги» on the right. On phones
 * and tablets one column: the ticket, the exceptions, the day, tomorrow, the
 * money. A new studio sees the checklist, with the day under it once
 * lessons are booked. Every block loads and fails on its own.
 */
export function TodayPage({ nowMs }: { nowMs?: number } = {}) {
  const t = useTranslations('today');
  const clock = useNow({ updateInterval: 60_000 });
  const now = nowMs ?? clock.getTime();
  const session = useSession();
  const router = useRouter();
  const format = useLocalFormatter();
  const timeZone = useStudioTimeZone();
  const mobile = useIsMobile();
  const panel = useLessonPanel();
  const data = useToday(now);
  useDashboardFollowsMutations();

  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<Payment | null>(null);
  const [selling, setSelling] = useState<Sale | null>(null);
  const [packageOp, setPackageOp] = useState<{ id: string; op: 'pay' | 'extend' } | null>(null);
  const [returning, setReturning] = useState<{
    student: { id: string; fullName: string };
    pauseId: string;
  } | null>(null);

  const firstName = session.user.name.split(/\s+/)[0] ?? session.user.name;
  const greeting = data.firstRun
    ? t('greeting.welcome', { name: firstName })
    : t('greeting.hello', { part: partOfDay(now, timeZone), name: firstName });
  const context: RowContext = {
    now,
    dense: mobile,
    showTeacher: data.scope.showTeacher,
    packages: data.packages,
    lowCreditThreshold: session.workspace.lowCreditThreshold,
    onOpen: (id, intent) => panel.open(id, intent ?? null),
  };

  const onAction = (action: TodayAction) => {
    if (action === 'lesson') setCreating(true);
    if (action === 'payment') setPaying({});
    if (action === 'sale') setSelling({});
    if (action === 'student') router.push('/app/students/new');
  };
  const onStep = (step: SetupStep) => {
    if (step === 'teacher') router.push('/app/teachers/new');
    if (step === 'student') router.push('/app/students/new');
    if (step === 'schedule') router.push('/app/schedules');
    if (step === 'sale') setSelling({});
  };
  const onAttention = ({ kind, item }: AttentionAction) => {
    const student = item.student;
    if (kind === 'attendance' && item.lesson) panel.open(item.lesson.id, 'markAttendance');
    if (kind === 'makeups' && item.lesson) panel.open(item.lesson.id, 'makeup');
    if (kind === 'debtors' && student) {
      setPaying({ studentId: student.id, enrollmentId: item.enrollmentId ?? undefined });
    }
    if (kind === 'unpaidPackages' && item.package) setPackageOp({ id: item.package.id, op: 'pay' });
    if (kind === 'expiringPackages' && item.package) {
      setPackageOp({ id: item.package.id, op: 'extend' });
    }
    if (kind === 'endingPackages' && student) {
      setSelling({ studentId: student.id, enrollmentId: item.enrollmentId ?? undefined });
    }
    if (kind === 'pauses' && student && item.pause) {
      setReturning({
        student: { id: student.id, fullName: student.fullName },
        pauseId: item.pause.id,
      });
    }
  };

  const { overview } = data;
  const dayReady = !data.dayLoading && !data.day.isError;
  const free = dayReady && overview.lessons.length === 0;
  const following = data.ahead.data?.items[0] ?? null;
  // A free day's strip already names the next lessons (S11 board 08).
  const tomorrowShown = !free;

  const money = (
    <MoneyCard
      data={data.money.data}
      loading={data.money.isPending}
      error={data.money.isError}
      onRetry={() => void data.money.refetch()}
      month={{
        number: Number(zonedDate(new Date(now), timeZone).slice(5, 7)),
        name: format.dateTime(new Date(now), { month: 'long' }),
      }}
    />
  );
  const attention = (
    <AttentionCard
      data={data.attention.data}
      loading={data.attentionLoading}
      error={data.attention.isError}
      onRetry={() => void data.attention.refetch()}
      teacherId={data.scope.teacherId}
      onAction={onAttention}
    />
  );
  const day = (
    <TodayDayList
      overview={overview}
      today={data.days.today}
      loading={data.dayLoading}
      error={data.day.isError}
      onRetry={() => void data.day.refetch()}
      context={context}
    />
  );

  return (
    <div className="flex flex-col gap-5.5">
      <TodayHeader
        date={format.dateTime(new Date(now), { weekday: 'long', day: 'numeric', month: 'long' })}
        greeting={greeting}
        subtitle={
          data.firstRun && data.setup.data && !anyDone(data.setup.data) ? t('ready') : undefined
        }
        scope={
          data.mode === 'switch' && !data.firstRun
            ? { value: data.choice, onChange: data.setChoice }
            : undefined
        }
        onAction={onAction}
      />

      {data.firstRun && data.setup.data ? (
        <div className="flex max-w-225 flex-col gap-4">
          <SetupBlock setup={data.setup.data} onStep={onStep} />
          {overview.lessons.length > 0 ? day : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:items-start xl:gap-5">
          <div className="contents xl:flex xl:flex-col xl:gap-3.5">
            <div className="order-1 xl:order-none">
              {data.dayLoading ? (
                <NowTicketSkeleton />
              ) : free ? (
                <FreeDay nearest={data.nearest} tomorrow={data.days.tomorrow} context={context} />
              ) : dayReady ? (
                <TodayTicket overview={overview} following={following} context={context} />
              ) : null}
            </div>
            {free ? null : <div className="order-3 xl:order-none">{day}</div>}
            {tomorrowShown && !data.aheadLoading && !data.ahead.isError ? (
              <div className="order-4 xl:order-none">
                <TodayTomorrow
                  lessons={data.tomorrow}
                  date={data.days.tomorrow}
                  open={overview.over}
                  context={context}
                />
              </div>
            ) : null}
          </div>
          <div className="contents xl:flex xl:flex-col xl:gap-4.5">
            <div className="order-5 xl:order-none">{money}</div>
            <div className="order-2 xl:order-none">{attention}</div>
          </div>
        </div>
      )}

      <LessonCreateDialog
        open={creating}
        onOpenChange={setCreating}
        nowMs={nowMs}
        initial={{ date: data.days.today }}
      />
      <StudentPaymentDialog
        open={paying !== null}
        onOpenChange={(open) => (open ? undefined : setPaying(null))}
        studentId={paying?.studentId}
        enrollmentId={paying?.enrollmentId}
      />
      <PackageSaleDialog
        open={selling !== null}
        onOpenChange={(open) => (open ? undefined : setSelling(null))}
        studentId={selling?.studentId}
        enrollmentId={selling?.enrollmentId}
        nowMs={nowMs}
      />
      {packageOp ? (
        <PackageOperationDialog
          packageId={packageOp.id}
          operation={packageOp.op}
          onClose={() => setPackageOp(null)}
        />
      ) : null}
      {returning ? (
        <StudentPauseEndDialog
          student={returning.student}
          pauseId={returning.pauseId}
          onClose={() => setReturning(null)}
        />
      ) : null}
      <LessonPanel
        lessonId={panel.lessonId}
        intent={panel.intent}
        onClose={panel.close}
        onOpenLesson={panel.open}
        linkTo={panel.linkTo}
        links={LESSON_LINKS}
        nowMs={nowMs}
      />
    </div>
  );
}

function anyDone(setup: {
  teacher: boolean | null;
  student: boolean;
  schedule: boolean;
  sale: boolean;
}) {
  return Boolean(setup.teacher) || setup.student || setup.schedule || setup.sale;
}
