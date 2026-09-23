'use client';

import Link from 'next/link';
import { PencilIcon, RotateCcwIcon, UserIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { StudentStatusDto } from '@tutorio/validation';
import { RowActionsTrigger } from '@/components/shared/row-actions-trigger';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { errorMessageKey } from '@/lib/api/error-message';
import { useRestoreStudentMutation } from '@/lib/api/students';
import { studentRowActions } from './student-row-actions.model';

/**
 * The row menu of a student in the collection. Status changes deliberately do
 * not live here: they belong to the status control on the profile and the
 * edit page, so every lifecycle change passes through its confirmation.
 */
export function StudentRowActions({
  studentId,
  fullName,
  status = 'ACTIVE',
}: {
  studentId: string;
  fullName: string;
  status?: StudentStatusDto;
}) {
  const t = useTranslations('students');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const restoreStudent = useRestoreStudentMutation();
  const actions = studentRowActions(status);

  const handleRestore = () => {
    restoreStudent.mutate(studentId, {
      onSuccess: () => toast.success(t('toasts.restored')),
      onError: (error) => toast.error(tErrors(errorMessageKey(error))),
    });
  };

  return (
    <DropdownMenu>
      <RowActionsTrigger
        busy={restoreStudent.isPending}
        label={t('rowActions', { name: fullName })}
      />
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link prefetch={false} href={`/app/students/${studentId}`}>
              <UserIcon data-icon />
              {t('openProfile')}
            </Link>
          </DropdownMenuItem>
          {actions.includes('edit') ? (
            <DropdownMenuItem asChild>
              <Link prefetch={false} href={`/app/students/${studentId}/edit`}>
                <PencilIcon data-icon />
                {tCommon('edit')}
              </Link>
            </DropdownMenuItem>
          ) : null}
          {actions.includes('restore') ? (
            <DropdownMenuItem onSelect={handleRestore}>
              <RotateCcwIcon data-icon />
              {tCommon('restore')}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
