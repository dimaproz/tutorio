'use client';

import { useState } from 'react';
import { BanknoteIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { EntityPicker } from '@/components/shared/entity-picker';
import { FieldFrame } from '@/components/shared/text-field';
import { useStudentBillingQuery } from '@/features/students/api';
import { directionName } from '@/features/students/model/learning';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useStudentQuery, useStudentsQuery } from '@/lib/api/students';
import { PaymentDialog } from './payment-dialog';

/**
 * «Записати оплату» from outside a profile (the Today page, S11): pick the
 * student, then the direction when there are several, and the S06 payment
 * dialog takes over. A known student (a debtor's row) starts at the
 * direction; a known direction goes straight to the payment.
 */
export function StudentPaymentDialog({
  open,
  onOpenChange,
  studentId,
  enrollmentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId?: string;
  enrollmentId?: string;
}) {
  return open ? (
    <PaymentFlow
      initialStudent={studentId ?? null}
      initialDirection={enrollmentId ?? null}
      onClose={() => onOpenChange(false)}
    />
  ) : null;
}

function PaymentFlow({
  initialStudent,
  initialDirection,
  onClose,
}: {
  initialStudent: string | null;
  initialDirection: string | null;
  onClose: () => void;
}) {
  const t = useTranslations('students.paymentStart');
  const [studentId, setStudentId] = useState(initialStudent);
  const [picked, setPicked] = useState(initialDirection);
  const [confirmed, setConfirmed] = useState(initialDirection !== null);
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const students = useStudentsQuery(
    { page: 1, pageSize: 10, search: debounced || undefined },
    studentId === null || !confirmed,
  );
  const student = useStudentQuery(studentId ?? '', studentId !== null);
  const billing = useStudentBillingQuery(studentId ?? '', studentId !== null);
  const directions = billing.data?.directions ?? [];
  const only = directions.length === 1 ? directions[0] : undefined;
  const directionId = picked ?? only?.enrollmentId ?? null;
  const direction = directions.find((row) => row.enrollmentId === directionId);
  const name =
    student.data?.fullName ??
    students.data?.items.find((row) => row.id === studentId)?.fullName ??
    '';

  // One direction, or a direction named by the caller: straight to the payment.
  if (direction && (confirmed || (only && initialStudent !== null))) {
    return (
      <PaymentDialog
        open
        onOpenChange={(next) => (next ? undefined : onClose())}
        studentName={name}
        direction={direction}
      />
    );
  }

  const studentOptions = (students.data?.items ?? []).map((row) => ({
    value: row.id,
    label: row.fullName,
    avatarKey: row.avatarKey,
  }));
  if (studentId && name && !studentOptions.some((row) => row.value === studentId)) {
    studentOptions.unshift({
      value: studentId,
      label: name,
      avatarKey: student.data?.avatarKey ?? null,
    });
  }

  return (
    <AdaptiveDialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      icon={<BanknoteIcon />}
      title={t('title')}
      description={t('description')}
      closeLabel={t('close')}
      primary={
        <Button type="button" disabled={!direction} onClick={() => setConfirmed(true)}>
          {t('next')}
        </Button>
      }
      secondary={
        <Button type="button" variant="outline" onClick={onClose}>
          {t('cancel')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <FieldFrame label={t('student')}>
          {(a11y) => (
            <EntityPicker
              id={a11y.id}
              aria-describedby={a11y.describedBy}
              appearance="field"
              value={studentId ?? undefined}
              onChange={(next) => {
                setStudentId(next ?? null);
                setPicked(null);
              }}
              options={studentOptions}
              isLoading={students.isPending}
              onSearchChange={setSearch}
              placeholder={t('studentPlaceholder')}
              searchPlaceholder={t('studentSearch')}
              emptyLabel={t('studentEmpty')}
            />
          )}
        </FieldFrame>
        {studentId && billing.data && directions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noDirections')}</p>
        ) : null}
        {directions.length > 1 ? (
          <FieldFrame label={t('direction')}>
            {(a11y) => (
              <EntityPicker
                id={a11y.id}
                aria-describedby={a11y.describedBy}
                appearance="field"
                value={picked ?? undefined}
                onChange={(next) => setPicked(next ?? null)}
                options={directions.map((row) => ({
                  value: row.enrollmentId,
                  label: directionName(row),
                  description: row.teacher.name,
                }))}
                placeholder={t('directionPlaceholder')}
                searchPlaceholder={t('directionSearch')}
                emptyLabel={t('directionEmpty')}
              />
            )}
          </FieldFrame>
        ) : null}
      </div>
    </AdaptiveDialog>
  );
}
