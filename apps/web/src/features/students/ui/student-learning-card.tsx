'use client';

import { useState } from 'react';
import { BookOpenIcon, PlusIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type {
  EnrollmentResponse,
  StudentDetail,
  StudentEnrollmentSummary,
} from '@tutorio/validation';
import { SectionTitle } from '@/components/shared/detail-view';
import { QueryErrorAlert } from '@/components/shared/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Spinner } from '@/components/ui/spinner';
import { EnrollmentDialog, EnrollmentStatusBadge } from '@/features/enrollments';
import { BillingTypeBadge } from '@/features/packages';
import { useEnrollmentQuery } from '@/lib/api/enrollments';
import { formatMoneyDisplay } from '@/lib/money';

export function StudentLearningCard({
  student,
  createOpen,
  onCreateOpenChange,
  readOnly = false,
}: {
  student: StudentDetail;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  readOnly?: boolean;
}) {
  const t = useTranslations('students.learning');
  const locale = useLocale();
  const [editing, setEditing] = useState<EnrollmentResponse | null>(null);
  // Without relationships the profile keeps the section out of the way: the
  // set-up checklist is where learning is started, and it opens this dialog.
  const visible = student.enrollments.length > 0;

  return (
    <>
      {visible ? (
        <Card>
          <CardHeader>
            <SectionTitle icon={BookOpenIcon}>{t('title')}</SectionTitle>
            {!readOnly ? (
              <CardAction>
                <Button type="button" size="sm" onClick={() => onCreateOpenChange(true)}>
                  <PlusIcon data-icon="inline-start" />
                  {t('add')}
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            {student.enrollments.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{t('empty')}</EmptyTitle>
                  <EmptyDescription>
                    {readOnly ? t('emptyArchived') : t('emptyDescription')}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="flex flex-col gap-3">
                {student.enrollments.map((enrollment) => (
                  <StudentEnrollmentItem
                    key={enrollment.id}
                    enrollment={enrollment}
                    locale={locale}
                    readOnly={readOnly}
                    onEdit={setEditing}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
      {!readOnly ? (
        <>
          <EnrollmentDialog
            open={createOpen}
            onOpenChange={onCreateOpenChange}
            lockedStudent={{
              id: student.id,
              fullName: student.fullName,
              avatarKey: student.avatarKey,
            }}
          />
          {editing ? (
            <EnrollmentDialog
              open
              onOpenChange={(open) => {
                if (!open) setEditing(null);
              }}
              enrollment={editing}
              lockedStudent={{
                id: student.id,
                fullName: student.fullName,
                avatarKey: student.avatarKey,
              }}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}

function StudentEnrollmentItem({
  enrollment,
  locale,
  readOnly,
  onEdit,
}: {
  enrollment: StudentEnrollmentSummary;
  locale: string;
  readOnly: boolean;
  onEdit: (enrollment: EnrollmentResponse) => void;
}) {
  const t = useTranslations('students.learning');
  const details = useEnrollmentQuery(enrollment.id, !readOnly);

  return (
    <li className="flex flex-col gap-2">
      <Item variant="outline">
        <ItemContent>
          <ItemTitle>
            <span>{enrollment.group?.name ?? t('individual')}</span>
            <EnrollmentStatusBadge status={enrollment.status} />
            <BillingTypeBadge billingType={enrollment.billingType} />
          </ItemTitle>
          <ItemDescription>
            {t('summary', {
              teacher: enrollment.teacher.name,
              price: formatMoneyDisplay(enrollment.priceMinor, enrollment.currency, locale),
            })}
          </ItemDescription>
        </ItemContent>
        {!readOnly ? (
          <ItemActions>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => details.data && onEdit(details.data)}
              disabled={!details.data || details.isFetching}
            >
              {details.isFetching ? <Spinner data-icon="inline-start" /> : null}
              {t('edit')}
            </Button>
          </ItemActions>
        ) : null}
      </Item>
      {!readOnly && details.isError ? (
        <QueryErrorAlert
          error={details.error}
          title={t('loadError')}
          onRetry={() => void details.refetch()}
        />
      ) : null}
    </li>
  );
}
