'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { LinkPickerDialogProps } from '@/components/shared/link-picker-dialog';
import type { LinkPickerItem } from '@/components/shared/link-picker';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLinkedSet } from '@/hooks/use-linked-set';

type Row = LinkPickerItem;

/**
 * The whole "link these records together" flow behind one profile card, for
 * either side of a relationship: the saved set (through `useLinkedSet`), the
 * rows to render for it, the picker's search and selection, and the unlink
 * confirmation. Both sides use it, so the parent and student cards cannot
 * drift apart. Wording comes from the shared `links` namespace; the caller
 * names its own entity (titles, create row) and supplies the search results.
 */
export function useRelationshipLinks({
  serverRows,
  save,
  refetch,
  refreshing = false,
  pickerOpen: controlledOpen,
  onPickerOpenChange,
}: {
  /** The linked records as the saved record reports them. */
  serverRows: readonly Row[];
  /** Sends the whole set of ids. */
  save: (ids: string[]) => Promise<unknown>;
  /** Refetches the record after a save. */
  refetch: () => Promise<unknown>;
  /** The record itself is being fetched. */
  refreshing?: boolean;
  /** Controls the picker when another command opens it too. */
  pickerOpen?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations('links');
  const mobile = useIsMobile();
  const serverIds = useMemo(() => serverRows.map((row) => row.id), [serverRows]);
  const links = useLinkedSet({ serverIds, save, confirm: refetch, refreshing });
  const [ownOpen, setOwnOpen] = useState(false);
  const pickerOpen = controlledOpen ?? ownOpen;
  const setPickerOpen = (open: boolean) =>
    onPickerOpenChange ? onPickerOpenChange(open) : setOwnOpen(open);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [unlinking, setUnlinking] = useState<Row | null>(null);
  // Records picked or created here, so a sent set can show its rows before
  // the refreshed record arrives.
  const [remembered, setRemembered] = useState<Record<string, Row>>({});

  const known = useMemo(() => {
    const byId: Record<string, Row> = { ...remembered };
    for (const row of serverRows) byId[row.id] = row;
    return byId;
  }, [remembered, serverRows]);
  const rows = links.linkedIds.map((id) => known[id]).filter((row): row is Row => Boolean(row));

  const remember = useCallback(
    (items: readonly Row[]) =>
      setRemembered((current) => ({
        ...current,
        ...Object.fromEntries(items.map((item) => [item.id, item])),
      })),
    [],
  );
  const closePicker = () => {
    setPickerOpen(false);
    setSearch('');
    setSelected([]);
  };
  const report = (saved: boolean, message: string) =>
    saved ? toast.success(message) : toast.error(t('saveError'));

  return {
    links,
    rows,
    busy: links.busy,
    openPicker: () => setPickerOpen(true),
    requestUnlink: (row: Row) => setUnlinking(row),
    /** Links a record created from the picker's create row. */
    linkCreated: (row: Row) => {
      remember([row]);
      closePicker();
      void links.link([row.id]).then((saved) => report(saved, t('saved')));
    },
    /** Props for `LinkPickerDialog`, apart from the caller's titles and results. */
    pickerProps: (results: Row[]) =>
      ({
        open: pickerOpen,
        onOpenChange: (open: boolean) => (open ? setPickerOpen(true) : closePicker()),
        searchLabel: t('searchLabel'),
        placeholder: t('searchPlaceholder'),
        search,
        onSearchChange: setSearch,
        results,
        selected,
        onToggle: (id: string) =>
          setSelected((current) =>
            current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
          ),
        listLabel: t('listLabel'),
        emptyTitle: t('noResultsTitle'),
        emptyHint: t('noResultsHint'),
        chooseText: t('choose'),
        selectedText: (count: number) => t('selected', { count }),
        keyboardHint: t('keyboardHint'),
        confirmLabel: mobile
          ? t('doneCount', { count: selected.length })
          : t('linkCount', { count: selected.length }),
        cancelLabel: t('cancel'),
        closeLabel: t('close'),
        busy: links.busy,
        onConfirm: (ids: string[]) => {
          remember(results.filter((row) => ids.includes(row.id)));
          void links.link(ids).then((saved) => {
            report(saved, t('saved'));
            if (saved) closePicker();
          });
        },
      }) satisfies Partial<LinkPickerDialogProps>,
    /** The search the caller runs for the picker. */
    search: { text: search.trim(), enabled: pickerOpen },
    /** The unlink confirmation: who, and its commands. */
    unlink: {
      target: unlinking,
      pending: links.busy,
      cancel: () => (links.busy ? undefined : setUnlinking(null)),
      confirm: () => {
        if (!unlinking) return;
        void links.unlink(unlinking.id).then((saved) => {
          report(saved, t('unlinked'));
          setUnlinking(null);
        });
      },
    },
  };
}
