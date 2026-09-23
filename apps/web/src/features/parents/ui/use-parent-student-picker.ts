'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ParentStudentRef } from '@tutorio/validation';
import type { LinkPickerItem } from '@/components/shared/link-picker';
import type { ParentStudentPicker } from './parent-form-sections';
import { useStudentLinkResults, useStudentLinkRow } from './use-link-results';

const NO_STUDENTS: readonly ParentStudentRef[] = [];

/**
 * The student search behind the parent form's linked-students section: the
 * same search and rows as the profile's picker, and the names of every
 * student the form has seen so a linked row always shows a name.
 */
export function useParentStudentPicker({
  linkedIds,
  initial = NO_STUDENTS,
  onCreate,
}: {
  linkedIds: readonly string[];
  initial?: readonly ParentStudentRef[];
  onCreate?: () => void;
}): ParentStudentPicker {
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
