'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BanknoteIcon,
  BookOpenIcon,
  ChevronRightIcon,
  ClockIcon,
  GaugeIcon,
  GraduationCapIcon,
  MailIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
  UsersRoundIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { EnrollmentResponse, StudentEnrollmentSummary } from '@tutorio/validation';
import { BackButton } from '@/components/app/back-button';
import { ListSkeleton, QueryErrorAlert } from '@/components/app/page-shell';
import { BillingTypeBadge, EnrollmentStatusBadge } from '@/components/app/status-badges';
import { StudentStatusBadge } from './student-status-badge';
import { StudentDeleteDialog } from './student-delete-dialog';
import { EnrollmentDialog } from '@/components/enrollments/enrollment-dialog';
import { StudentFormDialog } from './student-form-dialog';
import { ParentMiniCard } from '@/components/parents/parent-mini-card';
import { InfoRow, ProfileHeader, ProfileTag, SectionTitle } from '@/components/app/detail-view';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { useEnrollmentsQuery } from '@/lib/api/enrollments';
import { useStudentQuery } from '@/lib/api/students';
import { formatMoneyDisplay } from '@/lib/money';

export function StudentDetailView({ studentId }: { studentId: string }) {
  const t = useTranslations('students');
  const tCommon = useTranslations('common');
  const tSubject = useTranslations('subject');
  const tLanguageLevel = useTranslations('languageLevel');
  const tKnowledgeLevel = useTranslations('knowledgeLevel');
  const locale = useLocale();
  const router = useRouter();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<EnrollmentResponse | undefined>();

  const student = useStudentQuery(studentId);
  const enrollments = useEnrollmentsQuery({ page: 1, studentId });

  if (student.isPending) {
    return <ListSkeleton rows={5} />;
  }

  if (student.isError) {
    return (
      <QueryErrorAlert
        error={student.error}
        title={t('error.title')}
        onRetry={() => void student.refetch()}
      />
    );
  }

  const data = student.data;

  // Distinct groups this student is enrolled in.
  const groups = [
    ...new Map(
      data.enrollments
        .filter((enrollment) => enrollment.group)
        .map((enrollment) => [enrollment.group!.id, enrollment.group!]),
    ).values(),
  ];

  const addedOn = t('detail.addedOn', {
    date: new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(data.createdAt)),
  });

  function openCreate() {
    setEditing(undefined);
    setSheetOpen(true);
  }

  function openEdit(summary: StudentEnrollmentSummary) {
    setEditing(enrollments.data?.items.find((item) => item.id === summary.id));
    setSheetOpen(true);
  }

  return (
    <>
      {/* Top bar: back link + primary actions. */}
      <div className="flex items-center justify-between gap-3">
        <BackButton href="/app/students" />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
            <PencilIcon data-icon="inline-start" />
            {tCommon('edit')}
          </Button>
          <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2Icon data-icon="inline-start" />
            {tCommon('delete')}
          </Button>
        </div>
      </div>

      {/* Profile header — sits on the page background, no card. */}
      <ProfileHeader
        avatarKey={data.avatarKey}
        fullName={data.fullName}
        badge={<StudentStatusBadge status={data.status} />}
        subtitle={addedOn}
        tags={
          <>
            {data.subject ? (
              <ProfileTag icon={BookOpenIcon}>{tSubject(data.subject)}</ProfileTag>
            ) : null}
            {data.knowledgeLevel ? (
              <ProfileTag icon={GaugeIcon}>{tKnowledgeLevel(data.knowledgeLevel)}</ProfileTag>
            ) : null}
            {data.languageLevel ? (
              <ProfileTag>{tLanguageLevel(data.languageLevel)}</ProfileTag>
            ) : null}
            {data.age != null ? (
              <ProfileTag>{t('detail.ageYears', { age: data.age })}</ProfileTag>
            ) : null}
            {data.grade != null ? (
              <ProfileTag icon={GraduationCapIcon}>
                {t('detail.gradeShort', { grade: data.grade })}
              </ProfileTag>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column. */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <SectionTitle icon={BanknoteIcon} tone="emerald">
                {t('detail.pricingTitle')}
              </SectionTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <InfoRow
                icon={BanknoteIcon}
                label={t('form.hourlyRate')}
                accent={data.hourlyRateMinor != null && Boolean(data.currency)}
              >
                {data.hourlyRateMinor != null && data.currency ? (
                  formatMoneyDisplay(data.hourlyRateMinor, data.currency, locale)
                ) : (
                  <span className="text-muted-foreground">{tCommon('notProvided')}</span>
                )}
              </InfoRow>
              <InfoRow icon={ClockIcon} label={t('form.timezone')}>
                {data.timezone}
              </InfoRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle icon={GraduationCapIcon} tone="violet">
                {t('detail.enrollmentsTitle')}
              </SectionTitle>
              <CardAction>
                <Button type="button" size="sm" onClick={openCreate}>
                  <PlusIcon data-icon="inline-start" />
                  {t('detail.addEnrollment')}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {data.enrollments.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>{t('detail.noEnrollments')}</EmptyTitle>
                    <EmptyDescription>{t('detail.noEnrollmentsDescription')}</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button type="button" onClick={openCreate}>
                      <PlusIcon data-icon="inline-start" />
                      {t('detail.addEnrollment')}
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : (
                <ul className="flex flex-col gap-3">
                  {data.enrollments.map((enrollment) => (
                    <li
                      key={enrollment.id}
                      className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {enrollment.group?.name ?? t('detail.individual')}
                          </span>
                          <EnrollmentStatusBadge status={enrollment.status} />
                          <BillingTypeBadge billingType={enrollment.billingType} />
                        </div>
                        <p className="tabular text-muted-foreground text-sm">
                          {`${t('detail.teacher')}: ${enrollment.teacher.name} · ${t('detail.price')}: ${formatMoneyDisplay(
                            enrollment.priceMinor,
                            enrollment.currency,
                            locale,
                          )} · ${t('detail.deadline')}: ${t('detail.deadlineHours', {
                            hours: enrollment.effectiveCancellationDeadlineHours,
                          })}`}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(enrollment)}
                        disabled={enrollments.isPending}
                      >
                        {tCommon('edit')}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {data.notes ? (
            <Card>
              <CardHeader>
                <SectionTitle icon={BookOpenIcon} tone="rose">{t('detail.notesTitle')}</SectionTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{data.notes}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Right column. */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <SectionTitle icon={PhoneIcon} tone="sky">{t('detail.contactsTitle')}</SectionTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <InfoRow
                icon={PhoneIcon}
                label={t('form.phone')}
                href={data.phone ? `tel:${data.phone}` : undefined}
              >
                {data.phone ?? (
                  <span className="text-muted-foreground">{tCommon('notProvided')}</span>
                )}
              </InfoRow>
              <InfoRow
                icon={MailIcon}
                label={t('form.email')}
                href={data.email ? `mailto:${data.email}` : undefined}
              >
                {data.email ?? (
                  <span className="text-muted-foreground">{tCommon('notProvided')}</span>
                )}
              </InfoRow>
              <InfoRow
                icon={SendIcon}
                label={t('form.telegramUsername')}
                href={
                  data.telegramUsername
                    ? `https://t.me/${data.telegramUsername.replace(/^@/, '')}`
                    : undefined
                }
                external={Boolean(data.telegramUsername)}
              >
                {data.telegramUsername ? (
                  `@${data.telegramUsername.replace(/^@/, '')}`
                ) : (
                  <span className="text-muted-foreground">{tCommon('notProvided')}</span>
                )}
              </InfoRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle icon={UsersRoundIcon} tone="amber">
                {t('detail.parentTitle')}
              </SectionTitle>
            </CardHeader>
            <CardContent>
              {data.parents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tCommon('notProvided')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.parents.map((parent) => (
                    <li key={parent.id}>
                      <ParentMiniCard parent={parent} href={`/app/parents/${parent.id}`} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle icon={GraduationCapIcon} tone="indigo">
                {t('detail.groupsTitle')}
              </SectionTitle>
            </CardHeader>
            <CardContent>
              {groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('detail.noGroups')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {groups.map((group) => (
                    <li key={group.id}>
                      <Link
                        href={`/app/groups/${group.id}`}
                        className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50"
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                          <GraduationCapIcon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {group.name}
                        </span>
                        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <StudentDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        student={{
          id: data.id,
          fullName: data.fullName,
          avatarKey: data.avatarKey,
          status: data.status,
        }}
        onDeleted={() => router.push('/app/students')}
      />

      <EnrollmentDialog
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        enrollment={editing}
        lockedStudent={{
          id: data.id,
          fullName: data.fullName,
          avatarKey: data.avatarKey,
          subject: data.subject,
        }}
      />

      <StudentFormDialog open={editOpen} onOpenChange={setEditOpen} studentId={data.id} />
    </>
  );
}
