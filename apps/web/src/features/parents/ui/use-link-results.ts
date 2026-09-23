'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { ParentListItem, ParentStudentRef } from '@tutorio/validation';
import type { LinkPickerItem } from '@/components/shared/link-picker';
import { parentContactLine, parentRoleNames } from '@/features/parents/model/presentation';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useParentsQuery } from '@/lib/api/parents';
import { useStudentsQuery } from '@/lib/api/students';

/**
 * The pickers are autocompletes: the first ten records show on opening, and
 * typing asks the server for the matching ones.
 */
const RESULTS_PAGE_SIZE = 10;

type LinkSearch = { text: string; enabled: boolean; exclude: readonly string[] };

/**
 * A linked student as a row on the parent side: level and status. Stable per
 * locale, because the linked set compares the rows' identity to tell a
 * refreshed record from the one it already saw.
 */
export function useStudentLinkRow() {
  const tStatus = useTranslations('studentStatus');
  return useCallback(
    (
      student: Pick<ParentStudentRef, 'id' | 'fullName' | 'avatarKey' | 'status'> & {
        languageLevel?: string | null;
        groupNames?: string[];
      },
    ): LinkPickerItem => ({
      id: student.id,
      name: student.fullName,
      avatarKey: student.avatarKey,
      meta: [student.languageLevel, tStatus(student.status), student.groupNames?.[0]]
        .filter(Boolean)
        .join(' · '),
    }),
    [tStatus],
  );
}

/** Students to link to a parent, without the ones already linked. */
export function useStudentLinkResults({ text, enabled, exclude }: LinkSearch) {
  const toRow = useStudentLinkRow();
  const search = useDebouncedValue(text);
  const students = useStudentsQuery(
    { page: 1, pageSize: RESULTS_PAGE_SIZE, search: search || undefined },
    enabled,
  );
  return {
    results: (students.data?.items ?? [])
      .filter((student) => !exclude.includes(student.id))
      .map(toRow),
    loading: enabled && students.isPending,
  };
}

/** A parent as a row on the student side: the best contact, then the role line. */
export function useParentLinkRow() {
  const t = useTranslations('parents');
  return useCallback(
    (
      parent: Pick<
        ParentListItem,
        'id' | 'fullName' | 'avatarKey' | 'phone' | 'telegramUsername'
      > & {
        email?: string | null;
        students?: ParentListItem['students'];
      },
    ): LinkPickerItem => ({
      id: parent.id,
      name: parent.fullName,
      avatarKey: parent.avatarKey,
      meta: [
        parentContactLine(parent),
        parent.students?.length ? t('roleLine', { names: parentRoleNames(parent.students) }) : null,
      ]
        .filter(Boolean)
        .join(' · '),
    }),
    [t],
  );
}

/** Parents to link to a student, without the ones already linked. */
export function useParentLinkResults({ text, enabled, exclude }: LinkSearch) {
  const toRow = useParentLinkRow();
  const search = useDebouncedValue(text);
  const parents = useParentsQuery(
    { page: 1, pageSize: RESULTS_PAGE_SIZE, search: search || undefined },
    enabled,
  );
  return {
    results: (parents.data?.items ?? [])
      .filter((parent) => !exclude.includes(parent.id))
      .map(toRow),
    loading: enabled && parents.isPending,
  };
}
