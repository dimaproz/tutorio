'use client';

import { useMemo, useRef, useState } from 'react';
import { PlayIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useNow, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { StudentDetail } from '@tutorio/validation';
import { PackageFormDialog } from '@/components/packages/package-form-dialog';
import { LessonFormDialog } from '@/components/scheduling/lesson-form-dialog';
import {
  StudentLessonsCard,
  studentLessonsRange,
} from '@/components/scheduling/student-lessons-card';
import { DetailFrame } from '@/components/shared/detail-frame';
import { LoadingPanel } from '@/components/shared/loading';
import { Notice } from '@/components/shared/notice';
import { useSetPageCrumb } from '@/components/shared/page-crumb';
import { QueryErrorAlert } from '@/components/shared/page-shell';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { studentLifecyclePolicy } from '@/features/students/model/lifecycle';
import { deriveStudentProfileMetrics } from '@/features/students/model/profile-metrics';
import { errorMessageKey } from '@/lib/api/error-message';
import { usePackagesQuery } from '@/lib/api/packages';
import { useLessonsQuery } from '@/lib/api/scheduling';
import { useRestoreStudentMutation, useStudentQuery } from '@/lib/api/students';
import { StudentInformationCard } from './student-information-card';
import { StudentLearningCard } from './student-learning-card';
import { StudentNextLesson } from './student-next-lesson';
import { StudentNotesCard } from './student-notes-card';
import { StudentPackagesCard } from './student-packages-card';
import { StudentParentsCard } from './student-parents-card';
import { StudentProfileHero } from './student-profile-hero';
import { StudentProfileMetrics } from './student-profile-metrics';
import { StudentSectionsCard } from './student-sections-card';
import { StudentSetupCard } from './student-setup-card';
import { useStudentStatusActions } from './student-status-control';

export function StudentDetailView({ studentId }: { studentId: string }) {
  const t = useTranslations('students');
  const student = useStudentQuery(studentId);
  if (student.isPending) return <DetailFrame ratio="wide" loading={<LoadingPanel size="lg" />} />;
  if (student.isError)
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
  return <StudentProfileContent student={student.data} />;
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
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const policy = studentLifecyclePolicy(student.status);
  const archived = policy.readOnly;
  useSetPageCrumb(t('detail.pageLabel'));
  const setupVisible = searchParams.get('setup') === '1' && !archived;
  const statusActions = useStudentStatusActions(student);
  const restoreStudent = useRestoreStudentMutation();
  const [lessonOpen, setLessonOpen] = useState(false);
  const [packageOpen, setPackageOpen] = useState(false);
  const [learningOpen, setLearningOpen] = useState(false);
  const [parentOpen, setParentOpen] = useState(false);
  const parentsSectionRef = useRef<HTMLDivElement>(null);

  // One pinned window shared with the lessons panel, so both read one query.
  const clock = useNow();
  const [now] = useState(() => nowMs ?? clock.getTime());
  const lessons = useLessonsQuery({ ...studentLessonsRange(now), studentId: student.id });
  const packages = usePackagesQuery({
    page: 1,
    pageSize: 100,
    studentId: student.id,
    state: archived ? 'all' : 'active',
  });
  // A failed or partial read is reported as unknown, never as an empty record:
  // "0 credits" and "no payments" would be claims the page cannot back.
  const packagesUnavailable =
    packages.isError ||
    Boolean(packages.data && packages.data.items.length < packages.data.total);
  const metrics = useMemo(
    () =>
      (lessons.data || lessons.isError) && (packages.data || packages.isError)
        ? deriveStudentProfileMetrics({
            packages: packagesUnavailable ? [] : (packages.data?.items ?? []),
            lessons: lessons.data?.items ?? [],
            now,
            packagesUnavailable,
            lessonsUnavailable: lessons.isError,
          })
        : undefined,
    [lessons.data, lessons.isError, packages.data, packages.isError, packagesUnavailable, now],
  );

  const dismissSetup = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('setup');
    router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
  };
  const restore = () =>
    restoreStudent.mutate(student.id, {
      onSuccess: () => toast.success(t('toasts.restored')),
      onError: (error) => toast.error(tErrors(errorMessageKey(error))),
    });
  const focusParents = () => {
    parentsSectionRef.current?.scrollIntoView({ block: 'center' });
    parentsSectionRef.current?.querySelector<HTMLButtonElement>('#student-link-parent')?.focus();
  };
  const schedule = () => setLessonOpen(true);

  const banner =
    student.status === 'ON_HOLD' ? (
      <Notice
        tone="info"
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
    ) : archived ? (
      <Notice
        tone="warning"
        title={t('detail.archivedTitle')}
        text={t('detail.archivedDescription')}
        action={
          <Button
            type="button"
            variant="white"
            size="xs"
            disabled={restoreStudent.isPending}
            onClick={restore}
          >
            {restoreStudent.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RotateCcwIcon data-icon="inline-start" />
            )}
            {t('detail.restore')}
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
          onSchedule={schedule}
          onRestore={restore}
          restoring={restoreStudent.isPending}
        />
        <StudentNextLesson
          status={student.status}
          lesson={metrics?.next ?? null}
          loading={!metrics && !lessons.isError}
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
            if (action === 'lesson') setLessonOpen(true);
            if (action === 'package') setPackageOpen(true);
            if (action === 'learning') setLearningOpen(true);
            if (action === 'parent') focusParents();
            if (action === 'profile') router.push(`/app/students/${student.id}/edit`);
          }}
        />
      ) : null}
      <StudentSectionsCard
        historyOnly={archived}
        onAddLesson={archived ? undefined : schedule}
        onAddPackage={archived ? undefined : () => setPackageOpen(true)}
        lessons={
          <StudentLessonsCard
            studentId={student.id}
            readOnly={archived}
            historyOnly={archived}
            nowMs={now}
            emptyAction={
              !archived ? (
                <Button type="button" leading={<PlusIcon />} onClick={schedule}>
                  {t('detail.scheduleLesson')}
                </Button>
              ) : undefined
            }
          />
        }
        packages={
          <StudentPackagesCard
            bare
            studentId={student.id}
            createOpen={packageOpen}
            onCreateOpenChange={setPackageOpen}
            readOnly={archived}
          />
        }
      />
      {archived ? null : (
        <StudentLearningCard
          student={student}
          createOpen={learningOpen}
          onCreateOpenChange={setLearningOpen}
          readOnly={archived}
        />
      )}
    </>
  );

  const aside = (
    <>
      <StudentNotesCard student={student} readOnly={archived} />
      <StudentParentsCard
        student={student}
        createOpen={parentOpen}
        onCreateOpenChange={setParentOpen}
        readOnly={archived}
        sectionRef={parentsSectionRef}
      />
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
          archived ? undefined : (
            <StudentProfileMetrics
              student={student}
              metrics={metrics}
              onAddPackage={() => setPackageOpen(true)}
            />
          )
        }
        main={main}
        aside={aside}
      />
      {statusActions.dialogs}
      {!archived ? (
        <LessonFormDialog
          open={lessonOpen}
          onOpenChange={setLessonOpen}
          lockedStudentId={student.id}
        />
      ) : null}
      {!archived ? (
        <PackageFormDialog
          open={packageOpen}
          onOpenChange={setPackageOpen}
          lockedStudentId={student.id}
        />
      ) : null}
    </>
  );
}
