'use client';

import { useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArchiveIcon,
  CalendarPlusIcon,
  EllipsisIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { StudentDetail } from '@tutorio/validation';
import { PackageFormDialog } from '@/components/packages/package-form-dialog';
import { LessonFormDialog } from '@/components/scheduling/lesson-form-dialog';
import { StudentLessonsCard } from '@/components/scheduling/student-lessons-card';
import { DetailFrame } from '@/components/shared/detail-frame';
import { NextLessonCard } from '@/components/shared/next-lesson-card';
import { QueryErrorAlert } from '@/components/shared/page-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { StudentArchiveDialog } from '@/features/students/ui/student-archive-dialog';
import { StudentEditDialog } from '@/features/students/ui/student-edit-dialog';
import { StudentInformationCard } from '@/features/students/ui/student-information-card';
import { StudentLearningCard } from '@/features/students/ui/student-learning-card';
import { StudentPackagesCard } from '@/features/students/ui/student-packages-card';
import { StudentParentsCard } from '@/features/students/ui/student-parents-card';
import { StudentProfileHero } from '@/features/students/ui/student-profile-hero';
import { StudentProfileMetrics } from '@/features/students/ui/student-profile-metrics';
import { StudentSectionsCard } from '@/features/students/ui/student-sections-card';
import { StudentSetupCard } from '@/features/students/ui/student-setup-card';
import { studentLifecyclePolicy } from '@/features/students/model/lifecycle';
import { errorMessageKey } from '@/lib/api/error-message';
import {
  useRestoreStudentMutation,
  useStudentQuery,
  useUpdateStudentMutation,
} from '@/lib/api/students';
import { useDateFormatters } from '@/lib/i18n/format';
import { LoadingPanel } from '@/components/shared/loading';
import { StudentStatusBadge } from '@/features/students/ui/student-status';

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

export function StudentProfileContent({
  student,
  nowMs,
}: {
  student: StudentDetail;
  nowMs?: number;
}) {
  const t = useTranslations('students');
  const tCommon = useTranslations('common');
  const tLanguage = useTranslations('languageLevel');
  const tKnowledge = useTranslations('knowledgeLevel');
  const tErrors = useTranslations('errors');
  const format = useDateFormatters();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const setupVisible = searchParams.get('setup') === '1' && student.status !== 'ARCHIVED';
  const policy = studentLifecyclePolicy(student.status);
  const updateStudent = useUpdateStudentMutation(student.id);
  const restoreStudent = useRestoreStudentMutation();
  const [lessonOpen, setLessonOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [packageOpen, setPackageOpen] = useState(false);
  const [learningOpen, setLearningOpen] = useState(false);
  const [parentOpen, setParentOpen] = useState(false);
  const parentsSectionRef = useRef<HTMLDivElement>(null);

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
  const toggleHold = () =>
    updateStudent.mutate(
      { status: student.status === 'ON_HOLD' ? 'ACTIVE' : 'ON_HOLD' },
      {
        onSuccess: () =>
          toast.success(
            student.status === 'ON_HOLD' ? t('toasts.reactivated') : t('toasts.onHold'),
          ),
        onError: (error) => toast.error(tErrors(errorMessageKey(error))),
      },
    );
  const focusParents = () => {
    parentsSectionRef.current?.scrollIntoView({ block: 'center' });
    parentsSectionRef.current?.querySelector<HTMLButtonElement>('#student-link-parent')?.focus();
  };

  const heroMeta = [
    student.languageLevel ? tLanguage(student.languageLevel) : null,
    student.knowledgeLevel ? tKnowledge(student.knowledgeLevel) : null,
    student.age != null ? t('detail.ageYears', { age: student.age }) : null,
    student.grade != null ? t('detail.gradeShort', { grade: student.grade }) : null,
    student.timezone,
  ].filter((value): value is string => Boolean(value));

  const heroActions = (
    <>
      {policy.primary === 'restore' ? (
        <Button type="button" onClick={restore} disabled={restoreStudent.isPending}>
          {restoreStudent.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RotateCcwIcon data-icon="inline-start" />
          )}
          {tCommon('restore')}
        </Button>
      ) : (
        <Button type="button" leading={<CalendarPlusIcon />} onClick={() => setLessonOpen(true)}>
          {t('detail.scheduleLesson')}
        </Button>
      )}
      {policy.secondary.includes('edit') ? (
        <Button type="button" variant="white" onClick={() => setEditOpen(true)}>
          <PencilIcon data-icon="inline-start" />
          {t('detail.editProfile')}
        </Button>
      ) : null}
      {policy.overflow.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="white"
              size="icon"
              aria-label={t('detail.moreActions')}
            >
              <EllipsisIcon data-icon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={toggleHold}>
                {student.status === 'ON_HOLD' ? <PlayIcon data-icon /> : <PauseIcon data-icon />}
                {student.status === 'ON_HOLD' ? t('reactivate') : t('putOnHold')}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setArchiveOpen(true)}>
                <ArchiveIcon data-icon />
                {t('archive')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  );

  const identity = (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
        <StudentProfileHero
          student={student}
          statusBadge={<StudentStatusBadge status={student.status} onTint />}
          since={t('detail.addedOn', { date: format.longDate(student.createdAt) })}
          meta={heroMeta}
          actions={heroActions}
        />
        {/* The next lesson needs a schedule rollup the student endpoint does not
            return, so the ticket shows its empty state. It deliberately carries
            no call to action: the hero's primary button beside it already books
            a lesson, and two identical buttons on one screen help nobody. */}
        <NextLessonCard
          heading={t('detail.nextLesson')}
          emptyTitle={t('detail.nothingPlanned')}
          emptyDescription={t('detail.nothingPlannedDescription')}
        />
      </div>
      {policy.readOnly ? (
        <Alert>
          <ArchiveIcon />
          <AlertTitle>{t('detail.archivedTitle')}</AlertTitle>
          <AlertDescription>{t('detail.archivedDescription')}</AlertDescription>
        </Alert>
      ) : null}
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
            if (action === 'profile') setEditOpen(true);
          }}
        />
      ) : null}
      <StudentSectionsCard
        onAddLesson={policy.readOnly ? undefined : () => setLessonOpen(true)}
        lessons={
          <StudentLessonsCard
            studentId={student.id}
            readOnly={policy.readOnly}
            nowMs={nowMs}
          />
        }
        packages={
          <StudentPackagesCard
            bare
            studentId={student.id}
            createOpen={packageOpen}
            onCreateOpenChange={setPackageOpen}
            readOnly={policy.readOnly}
          />
        }
      />
      <StudentLearningCard
        student={student}
        createOpen={learningOpen}
        onCreateOpenChange={setLearningOpen}
        readOnly={policy.readOnly}
      />
    </>
  );

  const aside = (
    <>
      <StudentParentsCard
        student={student}
        createOpen={parentOpen}
        onCreateOpenChange={setParentOpen}
        readOnly={policy.readOnly}
        sectionRef={parentsSectionRef}
      />
      <StudentInformationCard student={student} />
      {student.notes ? (
        <Card tone="warning" className="gap-3 p-5">
          <h2 className="text-base font-semibold">{t('detail.notesTitle')}</h2>
          <p className="text-sm whitespace-pre-wrap">{student.notes}</p>
        </Card>
      ) : null}
    </>
  );

  return (
    <>
      <DetailFrame
        ratio="wide"
        identity={identity}
        metrics={<StudentProfileMetrics student={student} />}
        main={main}
        aside={aside}
      />
      {!policy.readOnly ? (
        <>
          <LessonFormDialog
            open={lessonOpen}
            onOpenChange={setLessonOpen}
            lockedStudentId={student.id}
          />
          <PackageFormDialog
            open={packageOpen}
            onOpenChange={setPackageOpen}
            lockedStudentId={student.id}
          />
          <StudentEditDialog open={editOpen} onOpenChange={setEditOpen} studentId={student.id} />
          <StudentArchiveDialog
            open={archiveOpen}
            onOpenChange={setArchiveOpen}
            student={student}
          />
        </>
      ) : null}
    </>
  );
}
