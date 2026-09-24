'use client';

import { useState } from 'react';
import type { ScheduleConflict } from '@tutorio/validation';
import { scheduleConflicts } from '../../model/move';
import { useErrorToast } from '../lesson-form-parts';
import { ConflictDialog, type ConflictCandidate } from './conflict-dialog';

type Pending = {
  candidate: ConflictCandidate;
  conflicts: ScheduleConflict[];
  retry: () => Promise<void>;
};

/**
 * Every save that can overlap another lesson goes through here (L-111): the
 * save runs once; a 409 SCHEDULE_CONFLICT opens the conflict dialog with what
 * overlaps, and "Save anyway" runs it again with `force`. Any other error is
 * a toast. `onSaved` follows a successful save either way.
 */
export function useConflictGuard() {
  const showError = useErrorToast();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (
    candidate: ConflictCandidate,
    attempt: (force: boolean) => Promise<void>,
    onSaved: () => void,
  ) => {
    try {
      await attempt(false);
      onSaved();
    } catch (error) {
      const conflicts = scheduleConflicts(error);
      if (!conflicts) {
        showError(error);
        return;
      }
      setPending({
        candidate,
        conflicts,
        retry: async () => {
          await attempt(true);
          onSaved();
        },
      });
    }
  };

  const dialog = (
    <ConflictDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
      candidate={pending?.candidate ?? null}
      conflicts={pending?.conflicts ?? []}
      busy={busy}
      onSaveAnyway={() => {
        if (!pending) return;
        setBusy(true);
        pending
          .retry()
          .then(() => setPending(null))
          .catch(showError)
          .finally(() => setBusy(false));
      }}
    />
  );

  return { run, dialog };
}
