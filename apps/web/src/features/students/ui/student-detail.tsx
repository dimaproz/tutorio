'use client';

import { useMemo, useRef, useState } from 'react';
import { ArchiveIcon, PauseIcon, PlayIcon, RotateCcwIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useNow, useTranslations } from 'next-intl';
import type { StudentDetail } from '@tutorio/validation';
import { DetailFrame } from '@/components/shared/detail-frame';
import { LoadingPanel } from '@/components/shared/loading';
import { Notice } from '@/components/shared/notice';
import { useSetPageCrumb } from '@/components/shared/page-crumb';
import { QueryErrorAlert } from '@/components/shared/page-shell';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  LessonCreateDialog,
  LessonPanel,
  useLessonPanel,
  type LessonPanelLinks,
} from '@/features/lessons';
import { StudentLessonsCard, studentLessonsRange } from './student-lessons-card';
import { studentLifecyclePolicy } from '@/features/students/model/lifecycle';
import { deriveStudentProfileMetrics } from '@/features/students/model/profile-metrics';
import {
  studentPackagesFilters,
  visibleStudentPackages,
} from '@/features/students/model/student-packages';
import { usePackagesQuery, usePrefetchPackagesQuery } from '@/lib/api/packages';
import { useLessonsQuery, usePrefetchLessonsQuery } from '@/lib/api/scheduling';
import { useStudentQuery } from '@/lib/api/students';
import { StudentInformationCard } from './student-information-card';
import { StudentNextLesson } from './student-next-lesson';
import { StudentNotesCard } from './student-notes-card';
import { StudentParentsCard } from './student-parents-card';
import { StudentProfileHero } from './student-profile-hero';
import { StudentProfileMetrics } from './student-profile-metrics';
import { StudentSectionsCard } from './student-sections-card';
import { StudentSetupCard } from './student-setup-card';
import { useStudentStatusActions } from './student-status-control';
import { PauseBanner } from './learning/pause-banner';
import { StudentLearningBlock } from './learning/student-learning-block';
import { StudentPackagesTab } from './learning/student-packages-tab';
import { StudentPaymentsTab } from './learning/student-payments-tab';
import { useLearningActions } from './learning/use-learning-actions';
import { useProfileBilling } from './learning/use-profile-billing';

/** Where the lesson panel links a student and a group. */
const LESSON_LINKS: LessonPanelLinks = {
  studentHref: (id) => `/app/students/${id}`,
  groupHref: (id) => `/app/groups/${id}`,
};

export function StudentDetailView({ studentId }: { studentId: string }) {
  const t = useTranslations('students');
  // One pinned clock for the whole profile, so the window started here is the
  // one the profile reads.
  const clock = useNow();
  const [now] = useState(() => clock.getTime());
  const student = useStudentQuery(studentId);
  // The lessons and packages need only the id, so they start with the record
  // instead of after it. The keys are the ones the blocks below read.
  usePrefetchLessonsQuery({ ...studentLessonsRange(now), studentId });
  usePrefetchPackagesQuery(studentPackagesFilters(studentId));
  if (student.isPending) return <DetailFrame ratio="wide" loading={<LoadingPanel size="lg" />} />;
  // A failed background refresh keeps the profile on screen; only a first
  // load that never produced data is an error page.
  if (!student.data)
    return (
      <DetailFrame
        ratio="wide"
        error={
          <QueryErrorAlert
            error={student.error}
            title={t('error.detailTitle')}
            onRetry={() => void student.refetch()}
          />
        }
      />
    );
  return <StudentProfileContent student={student.data} nowMs={now} />;
}

/**
 * The student profile. Order is fixed by the design: the status banner is
 * always first, then identity with the next lesson, the metric band, the
 * set-up checklist for a fresh record, the lesson sections and the aside.
 */
export function StudentProfileContent({
  student,
  nowMs,
}: {
  student: StudentDetail;
  nowMs?: number;
}) {
  const t = useTranslations('students');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lessonPanel = useLessonPanel();
  const [creating, setCreating] = useState(false);
  const policy = studentLifecyclePolicy(student.status);
  const archived = policy.readOnly;
  useSetPageCrumb(t('detail.pageLabel'));
  const setupVisible = searchParams.get('setup') === '1' && !archived;
  // One pinned window shared with the lessons panel, so both read one query.
  const clock = useNow();
  const [now] = useState(() => nowMs ?? clock.getTime());
  const money = useProfileBilling(student.id, now);
  const learning = useLearningActions({
    student,
    directions: money.directions,
    studioDeadlineHours: money.billing.data?.cancellationDeadlineHours ?? 0,
  });
  const statusActions = useStudentStatusActions(student, {
    pause: () => learning.pause(),
    returnNow: () => {
      if (!money.running) return false;
      learning.endPause(money.running);
      return true;
    },
  });
  const parentsSectionRef = useRef<HTMLDivElement>(null);
  const firstName = student.fullName.split(/\s+/)[0] || student.fullName;

  const lessons = useLessonsQuery({ ...studentLessonsRange(now), studentId: student.id });
  const packages = usePackagesQuery(studentPackagesFilters(student.id));
  // A failed or partial read is reported as unknown, never as an empty record:
  // "0 credits" and "no payments" would be claims the page cannot back.
  const packagesUnavailable =
    packages.isError || Boolean(packages.data && packages.data.items.length < packages.data.total);
  const packageItems = useMemo(
    () => visibleStudentPackages(packages.data?.items ?? [], archived),
    [packages.data, archived],
  );
  const metrics = useMemo(
    () =>
      (lessons.data || lessons.isError) && (packages.data || packages.isError)
        ? deriveStudentProfileMetrics({
            packages: packagesUnavailable ? [] : packageItems,
            lessons: lessons.data?.items ?? [],
            now,
            packagesUnavailable,
            lessonsUnavailable: lessons.isError,
          })
        : undefined,
    [
      lessons.data,
      lessons.isError,
      packages.data,
      packages.isError,
      packageItems,
      packagesUnavailable,
      now,
    ],
  );

  const dismissSetup = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('setup');
    router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
  };
  // The banner, the hero and the status pill restore through one mutation,
  // so none of them can fire a second restore while the first is running.
  const restore = () => statusActions.choose('ACTIVE');
  const restoring = archived && statusActions.pending;
  const focusParents = () => {
    parentsSectionRef.current?.scrollIntoView({ block: 'center' });
    parentsSectionRef.current?.querySelector<HTMLButtonElement>('#student-link-parent')?.focus();
  };

  // A pause banner leads (decision 9): a running whole-student pause, else
  // the next one that has not begun; a legacy hold with no pause behind it
  // keeps the plain banner.
  const pauseBanner = money.running ?? money.scheduled;
  const banner = archived ? (
    <Notice
      tone="warning"
      icon={<ArchiveIcon />}
      title={t('detail.archivedTitle')}
      text={t('detail.archivedDescription')}
      action={
        <Button type="button" variant="white" size="xs" disabled={restoring} onClick={restore}>
          {restoring ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RotateCcwIcon data-icon="inline-start" />
          )}
          {t('detail.restore')}
        </Button>
      }
    />
  ) : pauseBanner ? (
    <PauseBanner
      pause={pauseBanner}
      firstName={firstName}
      billing={money.billing.data}
      actions={learning}
    />
  ) : student.status === 'ON_HOLD' ? (
    <Notice
      tone="info"
      icon={<PauseIcon />}
      title={t('banner.holdTitle')}
      text={t('banner.holdText')}
      action={
        <Button
          type="button"
          variant="white"
          size="xs"
          disabled={statusActions.pending}
          onClick={() => statusActions.choose('ACTIVE')}
        >
          {statusActions.pending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <PlayIcon data-icon="inline-start" />
          )}
          {t('banner.holdAction')}
        </Button>
      }
    />
  ) : null;

  const identity = (
    <div className="flex flex-col gap-4">
      {banner}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
        <StudentProfileHero
          student={student}
          statusActions={statusActions}
          onRestore={restore}
          restoring={restoring}
        />
        <StudentNextLesson
          status={student.status}
          lesson={metrics?.next ?? null}
          loading={!metrics && !lessons.isError}
          unavailable={lessons.isError}
          onOpenLesson={lessonPanel.open}
          onMarkAttendance={(id) => lessonPanel.open(id, 'markAttendance')}
          onReschedule={archived ? undefined : (id) => lessonPanel.open(id, 'move')}
        />
      </div>
    </div>
  );

  const main = (
    <>
      {setupVisible ? (
        <StudentSetupCard
          onDismiss={dismissSetup}
          onAction={(action) => {
            if (action === 'parent') focusParents();
            if (action === 'profile') router.push(`/app/students/${student.id}/edit`);
          }}
        />
      ) : null}
      <StudentSectionsCard
        historyOnly={archived}
        onAddLesson={archived ? undefined : () => setCreating(true)}
        lessons={
          <StudentLessonsCard
            studentId={student.id}
            readOnly={archived}
            historyOnly={archived}
            nowMs={now}
            onSelect={lessonPanel.open}
          />
        }
        packages={
          <StudentPackagesTab
            packages={packageItems}
            loading={packages.isPending}
            error={packages.isError ? packages.error : undefined}
            onRetry={() => void packages.refetch()}
            nowMs={now}
          />
        }
        payments={
          <StudentPaymentsTab
            payments={money.payments.data?.items ?? []}
            packages={packageItems}
            directionNames={money.directionNames}
            loading={money.payments.isPending}
            error={money.payments.isError ? money.payments.error : undefined}
            onRetry={() => void money.payments.refetch()}
          />
        }
        onRecordPayment={
          archived || !money.payTarget
            ? undefined
            : () => learning.pay(money.payTarget!.enrollmentId)
        }
      />
    </>
  );

  const aside = (
    <>
      <StudentNotesCard student={student} readOnly={archived} />
      <StudentParentsCard student={student} readOnly={archived} sectionRef={parentsSectionRef} />
      <StudentInformationCard student={student} readOnly={archived} />
    </>
  );

  return (
    <>
      <DetailFrame
        ratio="wide"
        identity={identity}
        // An archived profile is history: the live metrics would only mislead.
        metrics={
          <>
            {archived ? undefined : (
              <StudentProfileMetrics
                student={student}
                metrics={metrics}
                money={money.money}
                balance={money.balance}
              />
            )}
            {/* History stays readable: an archived profile shows its directions
                without the commands that would change them. */}
            <StudentLearningBlock
              billing={money.billing.data}
              pauses={money.pauseItems}
              schedules={money.schedules}
              actions={learning}
              error={money.billing.isError ? money.billing.error : undefined}
              onRetry={() => void money.billing.refetch()}
              readOnly={archived}
            />
          </>
        }
        main={main}
        aside={aside}
      />
      {statusActions.dialogs}
      {learning.dialogs}
      <LessonCreateDialog
        open={creating}
        onOpenChange={setCreating}
        initial={{ studentId: student.id }}
      />
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
