'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ParentStudentRef } from '@tutorio/validation';
import type { LinkPickerItem } from '@/components/shared/link-picker';
import { useStudentsQuery } from '@/lib/api/students';
import type { ParentStudentPicker } from './parent-form-sections';

/**
 * The student search behind the parent form's linked-students section: a
 * server-side search, the results without the students already linked, and
 * the names of every student the form has seen.
 */
export function useParentStudentPicker({
  linkedIds,
  initial = [],
  onCreate,
}: {
  linkedIds: readonly string[];
  initial?: readonly ParentStudentRef[];
  onCreate?: () => void;
}): ParentStudentPicker {
  const tStatus = useTranslations('studentStatus');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [known, setKnown] = useState<Record<string, LinkPickerItem>>(() =>
    Object.fromEntries(
      initial.map((student) => [
        student.id,
        {
          id: student.id,
          name: student.fullName,
          avatarKey: student.avatarKey,
          meta: [student.languageLevel, tStatus(student.status).toLowerCase()]
            .filter(Boolean)
            .join(' · '),
        },
      ]),
    ),
  );
  const students = useStudentsQuery(
    { page: 1, pageSize: 20, search: search.trim() || undefined },
    open,
  );
  const results = (students.data?.items ?? [])
    .filter((student) => !linkedIds.includes(student.id))
    .map((student) => ({
      id: student.id,
      name: student.fullName,
      avatarKey: student.avatarKey,
      meta: [tStatus(student.status).toLowerCase(), student.groupNames[0]]
        .filter(Boolean)
        .join(' · '),
    }));
  const remember = useCallback(
    (item: LinkPickerItem) => setKnown((current) => ({ ...current, [item.id]: item })),
    [],
  );

  return {
    search,
    onSearchChange: setSearch,
    open,
    onOpenChange: setOpen,
    results,
    loading: students.isPending && open,
    known,
    remember,
    onCreate,
  };
}
