'use client';

import { useCallback, useState } from 'react';
import type { ParentStudentRef } from '@tutorio/validation';
import type { LinkPickerItem } from '@/components/shared/link-picker';
import type { ParentStudentPicker } from './parent-form-sections';
import { useStudentLinkResults, useStudentLinkRow } from './use-link-results';

/**
 * The student search behind the parent form's linked-students section: the
 * same search and rows as the profile's picker, and the names of every
 * student the form has seen so a linked row always shows a name.
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
  const toRow = useStudentLinkRow();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [known, setKnown] = useState<Record<string, LinkPickerItem>>(() =>
    Object.fromEntries(initial.map((student) => [student.id, toRow(student)])),
  );
  const { results, loading } = useStudentLinkResults({
    text: search.trim(),
    enabled: open,
    exclude: linkedIds,
  });
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
    loading,
    known,
    remember,
    onCreate,
  };
}
