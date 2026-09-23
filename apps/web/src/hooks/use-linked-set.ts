'use client';

import { useCallback, useState } from 'react';

/** The set with `ids` added, in first-seen order and without duplicates. */
export function withLinks(current: readonly string[], ids: readonly string[]): string[] {
  return [...new Set([...current, ...ids])];
}

/** The set without `id`. */
export function withoutLink(current: readonly string[], id: string): string[] {
  return current.filter((item) => item !== id);
}

/**
 * Saves a whole relationship set — a parent's students, a student's parents —
 * where every request replaces the set on the server.
 *
 * Because each save sends the whole set, the next edit must start from what
 * was last sent, not from a record that has not refetched yet; otherwise two
 * quick edits undo each other. The sent set therefore stays authoritative
 * until `confirm` reports a refreshed record, and `busy` holds the controls
 * disabled from the send until then. A failed save keeps the set it tried to
 * send, so `retry` can send it again.
 */
export function useLinkedSet({
  serverIds,
  save,
  confirm,
}: {
  /** The set the record currently reports. */
  serverIds: readonly string[];
  /** Sends the whole set. Rejects when the save fails. */
  save: (ids: string[]) => Promise<unknown>;
  /** Refetches the record; resolves true once a fresh copy has arrived. */
  confirm: () => Promise<boolean>;
}) {
  const [sentIds, setSentIds] = useState<string[] | null>(null);
  const [retryIds, setRetryIds] = useState<string[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const linkedIds = sentIds ?? [...serverIds];

  const commit = useCallback(
    async (ids: string[]): Promise<boolean> => {
      setRetryIds(null);
      setError(null);
      setSentIds(ids);
      setBusy(true);
      try {
        await save(ids);
      } catch (failure) {
        setSentIds(null);
        setRetryIds(ids);
        setError(failure);
        setBusy(false);
        return false;
      }
      // The save succeeded. A failed refresh must not hand the next edit a
      // stale set to build on, so the sent set is kept until one succeeds.
      if (await confirm().catch(() => false)) setSentIds(null);
      setBusy(false);
      return true;
    },
    [save, confirm],
  );

  return {
    /** The set to render and to build the next edit on. */
    linkedIds,
    busy,
    /** Why the last save failed, while its retry is pending. */
    error: retryIds ? error : null,
    commit,
    link: (ids: readonly string[]) => commit(withLinks(linkedIds, ids)),
    unlink: (id: string) => commit(withoutLink(linkedIds, id)),
    retry: retryIds ? () => commit(retryIds) : undefined,
  };
}

export type LinkedSet = ReturnType<typeof useLinkedSet>;
