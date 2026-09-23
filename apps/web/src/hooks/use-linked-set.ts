'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** The set with `ids` added, in first-seen order and without duplicates. */
export function withLinks(current: readonly string[], ids: readonly string[]): string[] {
  return [...new Set([...current, ...ids])];
}

/** The set without `id`. */
export function withoutLink(current: readonly string[], id: string): string[] {
  return current.filter((item) => item !== id);
}

/**
 * The set the next edit must build on. A sent set stays authoritative until a
 * record that arrived after the send replaces it; before that, the record the
 * page holds may predate the save and would silently undo it.
 */
export function effectiveLinks(
  serverIds: readonly string[],
  sent: { ids: string[]; against: readonly string[] } | null,
): string[] {
  return sent && sent.against === serverIds ? sent.ids : [...serverIds];
}

/**
 * Saves a whole relationship set — a parent's students, a student's parents —
 * where every request replaces the set on the server.
 *
 * Because each save sends the whole set, the next edit starts from what was
 * last sent, not from a record that has not refetched yet; otherwise two quick
 * edits undo each other. The sent set is remembered against the record it was
 * built on and stays authoritative until a newer record arrives, whether that
 * is the refetch after the save or any later one. `busy` holds the controls
 * disabled from the send until the refetch settles, and while the record
 * itself is refreshing (`refreshing`), so nothing is built on a stale copy.
 * A failed save keeps the last good set, and `retry` sends the failed one again.
 */
export function useLinkedSet({
  serverIds,
  save,
  confirm,
  refreshing = false,
}: {
  /** The set the record currently reports; a new array means a new record. */
  serverIds: readonly string[];
  /** Sends the whole set. Rejects when the save fails. */
  save: (ids: string[]) => Promise<unknown>;
  /** Refetches the record after a successful save. */
  confirm: () => Promise<unknown>;
  /** The record is being fetched; its set may be about to change. */
  refreshing?: boolean;
}) {
  const [sent, setSent] = useState<{ ids: string[]; against: readonly string[] } | null>(null);
  const [retryIds, setRetryIds] = useState<string[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const linkedIds = effectiveLinks(serverIds, sent);
  // The latest values for a commit that outlives the render it started in.
  const latest = useRef({ serverIds, sent });
  useEffect(() => {
    latest.current = { serverIds, sent };
  });

  const commit = useCallback(
    async (ids: string[]): Promise<boolean> => {
      const before = latest.current.sent;
      setRetryIds(null);
      setError(null);
      setSaving(true);
      try {
        await save(ids);
      } catch (failure) {
        // Keep the last set that is known to be saved, not the stale record.
        setSent(before);
        setRetryIds(ids);
        setError(failure);
        setSaving(false);
        return false;
      }
      setSent({ ids, against: latest.current.serverIds });
      await confirm().catch(() => undefined);
      setSaving(false);
      return true;
    },
    [save, confirm],
  );

  return {
    /** The set to render and to build the next edit on. */
    linkedIds,
    busy: saving || refreshing,
    /** Why the last save failed, while its retry is pending. */
    error: retryIds ? error : null,
    commit,
    link: (ids: readonly string[]) => commit(withLinks(linkedIds, ids)),
    unlink: (id: string) => commit(withoutLink(linkedIds, id)),
    retry: retryIds ? () => commit(retryIds) : undefined,
  };
}

export type LinkedSet = ReturnType<typeof useLinkedSet>;
