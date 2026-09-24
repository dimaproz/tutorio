'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RotateCcwIcon } from 'lucide-react';
import { useNow, useTranslations } from 'next-intl';
import type {
  GroupAttendanceResponse,
  GroupDetail,
  LessonResponse,
  PackageResponse,
} from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { DetailFrame } from '@/components/shared/detail-frame';
import { LoadingPanel } from '@/components/shared/loading';
import { Notice } from '@/components/shared/notice';
import { useSetPageCrumb } from '@/components/shared/page-crumb';
import { QueryErrorAlert } from '@/components/shared/page-shell';
import { memberPackages } from '@/features/groups/model/presentation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGroupAttendanceQuery, useGroupQuery } from '@/lib/api/groups';
import { usePackagesQuery } from '@/lib/api/packages';
import { useLessonsQuery } from '@/lib/api/scheduling';
import { AttendanceDialog } from './attendance-dialog';
import { useGroupArchive } from './group-archive';
import { GroupAttendanceCard } from './group-attendance-card';
import { GroupHero } from './group-hero';
import { GroupLessonsCard } from './group-lessons-card';
import { GroupNotesCard } from './group-notes-card';
import { GroupPackageCard } from './group-package-card';
import { GroupPageMetrics } from './group-page-metrics';
import { GroupRosterCard } from './group-roster-card';
import { GroupScheduleCard } from './group-schedule-card';

const DAY_MS = 24 * 60 * 60 * 1000;
/** The attendance window: the last eight held lessons. */
const ATTENDANCE_WINDOW = 8;

/**
 * The lessons the page reads: a year back, and past the 12-week horizon the
 * schedule is generated over. Whole days, so the query key holds all day.
 */
function lessonWindow(now: number) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return {
    from: new Date(today.getTime() - 365 * DAY_MS).toISOString(),
    to: new Date(today.getTime() + 92 * DAY_MS).toISOString(),
  };
}

/**
 * The group page. Every read starts together, keyed by the id in the URL:
 * the group, its lessons, its packages and its attendance.
 */
export function GroupDetailView({ groupId }: { groupId: string }) {
  const t = useTranslations('groups');
  const clock = useNow();
  const [now] = useState(() => clock.getTime());
  const group = useGroupQuery(groupId);
  const window = useMemo(() => lessonWindow(now), [now]);
  const lessons = useLessonsQuery({ ...window, groupId });
  const packages = usePackagesQuery({ page: 1, pageSize: 100, groupId, state: 'active' });
  const attendance = useGroupAttendanceQuery(groupId, ATTENDANCE_WINDOW);

  if (group.isPending) return <DetailFrame loading={<LoadingPanel size="lg" />} />;
  // A failed background refresh keeps the page; only a first load that never
  // produced data is an error page.
  if (!group.data) {
    return (
      <DetailFrame
        error={
          <QueryErrorAlert
            error={group.error}
            title={t('error.detailTitle')}
            onRetry={() => void group.refetch()}
          />
        }
      />
    );
  }

  return (
    <GroupPageContent
      group={group.data}
      now={now}
      lessons={{ items: lessons.data?.items ?? [], loading: lessons.isPending }}
      packages={{
        items: packages.data?.items ?? [],
        loading: packages.isPending,
      }}
      attendance={{
        data: attendance.data,
        loading: attendance.isPending,
        failed: attendance.isError,
        retry: () => void attendance.refetch(),
      }}
    />
  );
}

/**
 * The page itself: the hero beside the schedule card, four metrics, then the
 * lessons and attendance on the left and the roster, package and notes on
 * the right. Phones stack it in the same order. An archived group reads the
 * same, with a banner, no editing and "Restore" as its command.
 */
export function GroupPageContent({
  group,
  now,
  lessons,
  packages,
  attendance,
}: {
  group: GroupDetail;
  now: number;
  lessons: { items: LessonResponse[]; loading: boolean };
  packages: { items: PackageResponse[]; loading: boolean };
  attendance: {
    data?: GroupAttendanceResponse;
    loading: boolean;
    failed: boolean;
    retry: () => void;
  };
}) {
  const t = useTranslations('groups');
  const router = useRouter();
  const searchParams = useSearchParams();
  const mobile = useIsMobile();
  useSetPageCrumb(t('detail.pageLabel'));
  const archived = Boolean(group.deletedAt);
  const lifecycle = archived ? 'ARCHIVED' : group.status;
  const justCreated = searchParams.get('created') === '1';

  const [pickerOpen, setPickerOpen] = useState(false);
  const [markLesson, setMarkLesson] = useState<LessonResponse | null>(null);
  const members = useMemo(() => memberPackages(packages.items, now), [packages.items, now]);
  const archiving = useGroupArchive({ onArchived: () => router.push('/app/groups') });
  const [restoring, setRestoring] = useState(false);
  const restore = () => {
    setRestoring(true);
    void archiving.restore(group.id).finally(() => setRestoring(false));
  };

  const identity = (
    <div className="flex flex-col gap-4">
      {archived ? (
        <Notice
          tone="warning"
          title={t('detail.archivedTitle')}
          text={t('detail.archivedText')}
          action={
            archiving.canArchive ? (
              <Button
                type="button"
                variant="white"
                size="xs"
                disabled={restoring}
                onClick={restore}
              >
                {restoring ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <RotateCcwIcon data-icon="inline-start" />
                )}
                {t('detail.restore')}
              </Button>
            ) : undefined
          }
        />
      ) : group.teacherMismatch ? (
        <Notice tone="info" text={t('detail.teacherMismatch')} />
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <GroupHero
          group={group}
          lifecycle={lifecycle}
          justCreated={justCreated}
          canArchive={archiving.canArchive}
          onAddStudents={() => setPickerOpen(true)}
          onArchive={() => archiving.request(group)}
          onRestore={restore}
          restoring={restoring}
        />
        <GroupScheduleCard group={group} archived={archived} />
      </div>
    </div>
  );

  return (
    <>
      <DetailFrame
        ratio="balanced"
        identity={identity}
        metrics={
          <GroupPageMetrics
            group={group}
            packages={{ data: members, loading: packages.loading }}
            attendance={{ data: attendance.data, loading: attendance.loading }}
          />
        }
        main={
          <>
            <GroupLessonsCard
              group={group}
              lessons={lessons.items}
              loading={lessons.loading}
              now={now}
              archived={archived}
              onMarkAttendance={setMarkLesson}
            />
            {/* A group with no students and no lessons yet has nothing to count;
                the design leaves the block out until it does. */}
            {group.enrollments.length === 0 && lessons.items.length === 0 ? null : (
              <GroupAttendanceCard
                attendance={attendance.data}
                loading={attendance.loading}
                failed={attendance.failed}
                window={ATTENDANCE_WINDOW}
                onRetry={attendance.retry}
              />
            )}
          </>
        }
        aside={
          <>
            <GroupRosterCard
              group={group}
              readOnly={archived}
              pickerOpen={pickerOpen}
              onPickerOpenChange={setPickerOpen}
            />
            <GroupPackageCard packages={members} loading={packages.loading} compact={mobile} />
            <GroupNotesCard group={group} readOnly={archived} />
          </>
        }
      />
      {archiving.dialog}
      {archived ? null : (
        <>
          <AttendanceDialog
            lesson={markLesson}
            open={markLesson !== null}
            onOpenChange={(open) => (open ? undefined : setMarkLesson(null))}
          />
        </>
      )}
    </>
  );
}
