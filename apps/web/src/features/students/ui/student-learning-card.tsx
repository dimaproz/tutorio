'use client';

import { BookOpenIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { StudentDetail, StudentEnrollmentSummary } from '@tutorio/validation';
import { SectionTitle } from '@/components/shared/detail-view';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { EnrollmentStatusBadge } from './enrollment-status';
import { BillingTypeBadge } from './package-status';
import { formatMoneyDisplay } from '@/lib/money';

export function StudentLearningCard({
  student,
  readOnly = false,
}: {
  student: StudentDetail;
  readOnly?: boolean;
}) {
  const t = useTranslations('students.learning');
  const locale = useLocale();
  // Without relationships the profile keeps the section out of the way.
  const visible = student.enrollments.length > 0;

  return (
    <>
      {visible ? (
        <Card>
          <CardHeader>
            <SectionTitle icon={BookOpenIcon}>{t('title')}</SectionTitle>
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
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function StudentEnrollmentItem({
  enrollment,
  locale,
}: {
  enrollment: StudentEnrollmentSummary;
  locale: string;
}) {
  const t = useTranslations('students.learning');

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
      </Item>
    </li>
  );
}
