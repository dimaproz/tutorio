'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ParentStudentRef } from '@tutorio/validation';
import type { LinkPickerItem } from '@/components/shared/link-picker';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useStudentsQuery } from '@/lib/api/students';

/**
 * The pickers are autocompletes: the first ten records show on opening, and
 * typing asks the server for the matching ones.
 */
const RESULTS_PAGE_SIZE = 10;
/** The API's page-size cap. */
const RESULTS_READ_MAX = 100;

type StudentRowSource = Pick<ParentStudentRef, 'id' | 'fullName' | 'avatarKey' | 'status'> & {
  languageLevel?: string | null;
  groupNames?: string[];
};

/**
 * A student as a linked row anywhere a record links students (a parent's
 * students, a group's roster): level and status. Stable per locale, because
 * the linked set compares the rows' identity to tell a refreshed record from
 * the one it already saw.
 */
export function useStudentLinkRow() {
  const tStatus = useTranslations('studentStatus');
  return useCallback(
    (student: StudentRowSource): LinkPickerItem => ({
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

/** Students to link, without the ones already linked. */
export function useStudentLinkResults({
  text,
  enabled,
  exclude,
}: {
  text: string;
  enabled: boolean;
  exclude: readonly string[];
}) {
  const toRow = useStudentLinkRow();
  const search = useDebouncedValue(text);
  // The linked students are dropped here, so read enough to still fill the
  // list without them — in steps of ten, so linking one more student does
  // not start a new read each time.
  const pageSize = Math.min(
    RESULTS_READ_MAX,
    Math.ceil((RESULTS_PAGE_SIZE + exclude.length) / RESULTS_PAGE_SIZE) * RESULTS_PAGE_SIZE,
  );
  const students = useStudentsQuery({ page: 1, pageSize, search: search || undefined }, enabled);
  return {
    results: (students.data?.items ?? [])
      .filter((student) => !exclude.includes(student.id))
      .slice(0, RESULTS_PAGE_SIZE)
      .map(toRow),
    loading: enabled && students.isPending,
  };
}

/**
 * The student search behind a form's linked-students section. The page owns
 * the query; the section only renders what it is handed.
 */
export type StudentFormPicker = {
  search: string;
  onSearchChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Search results, already without the linked students. */
  results: LinkPickerItem[];
  loading: boolean;
  /** Every student the form knows by id, so linked rows show a name. */
  known: Record<string, LinkPickerItem>;
  /** Keeps a picked result known after it leaves the results. */
  remember: (item: LinkPickerItem) => void;
  onCreate?: () => void;
};

const NO_STUDENTS: readonly StudentRowSource[] = [];

/**
 * The student search behind a form's linked-students section (the parent
 * form, the group form): the same search and rows as the profile pickers,
 * and the names of every student the form has seen.
 */
export function useStudentFormPicker({
  linkedIds,
  initial = NO_STUDENTS,
  onCreate,
}: {
  linkedIds: readonly string[];
  initial?: readonly StudentRowSource[];
  onCreate?: () => void;
}): StudentFormPicker {
  const toRow = useStudentLinkRow();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [remembered, setRemembered] = useState<Record<string, LinkPickerItem>>({});
  // The record's own students may arrive after the form opens (a prelinked
  // student on create), so they are read on every render.
  const known = useMemo(
    () => ({
      ...Object.fromEntries(initial.map((student) => [student.id, toRow(student)])),
      ...remembered,
    }),
    [initial, remembered, toRow],
  );
  const { results, loading } = useStudentLinkResults({
    text: search.trim(),
    enabled: open,
    exclude: linkedIds,
  });
  const remember = useCallback(
    (item: LinkPickerItem) => setRemembered((current) => ({ ...current, [item.id]: item })),
    [],
  );

  return {
    search,
    onSearchChange: setSearch,
    open,
    onOpenChange: setOpen,
    results,
    loading,
    known,
    remember,
    onCreate,
  };
}
