'use client';

import { useState } from 'react';
import { RotateCcwIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { TeacherResponse } from '@tutorio/validation';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { errorMessageKey } from '@/lib/api/error-message';
import { useRestoreTeacherMutation } from '@/lib/api/teachers';
import { useUpdateWorkspaceSettingsMutation } from '@/lib/api/workspace';
import type { GatewayError } from '@/lib/auth/client';
import { SoloRefusalDialog } from './solo-refusal-dialog';
import { TeacherArchiveDialog } from './teacher-archive-dialog';
import type { TeacherCommands } from './teacher-row-actions';

/**
 * The commands on a teacher, shared by the collection and the profile, with
 * the dialogs they open: archive (and the owner's «turn teaching off», the
 * same dialog), restore behind a confirmation — the owner's own «Я теж
 * викладаю» runs at once —, and the switch to tutor mode with its refusal
 * while other teachers are active.
 */
export function useTeacherActions({
  otherActiveTeachers = 0,
  onArchived,
}: {
  /** Active teachers besides the owner: what the solo refusal reports. */
  otherActiveTeachers?: number;
  onArchived?: () => void;
} = {}) {
  const t = useTranslations('teachers');
  const tErrors = useTranslations('errors');
  const [archiving, setArchiving] = useState<TeacherResponse | null>(null);
  const [restoring, setRestoring] = useState<TeacherResponse | null>(null);
  const [refusal, setRefusal] = useState(false);
  const restore = useRestoreTeacherMutation();
  const settings = useUpdateWorkspaceSettingsMutation();

  const runRestore = async (teacher: TeacherResponse) => {
    try {
      await restore.mutateAsync(teacher.id);
      toast.success(
        teacher.isMe ? t('toasts.teachingOn') : t('toasts.restored', { name: teacher.fullName }),
      );
      setRestoring(null);
    } catch (error) {
      toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  };

  const switchToSolo = async () => {
    try {
      await settings.mutateAsync({ mode: 'SOLO' });
      toast.success(t('soloRefusal.switched'));
    } catch (error) {
      if ((error as GatewayError).code === 'SOLO_MODE_SINGLE_TEACHER') setRefusal(true);
      else toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  };

  const commands: TeacherCommands = {
    onArchive: setArchiving,
    onStopTeaching: setArchiving,
    onRestore: (teacher) => (teacher.isMe ? void runRestore(teacher) : setRestoring(teacher)),
    onSwitchToSolo: () => void switchToSolo(),
  };

  const dialogs = (
    <>
      {archiving ? (
        <TeacherArchiveDialog
          teacher={archiving}
          open
          onOpenChange={(open) => !open && setArchiving(null)}
          onDone={onArchived}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(restoring)}
        onOpenChange={(open) => !open && setRestoring(null)}
        tone="neutral"
        icon={<RotateCcwIcon />}
        title={t('restore.title', { name: restoring?.fullName ?? '' })}
        description={t('restore.description')}
        confirmLabel={t('restore.action')}
        pending={restore.isPending}
        onConfirm={() => restoring && void runRestore(restoring)}
      />
      <SoloRefusalDialog open={refusal} onOpenChange={setRefusal} others={otherActiveTeachers} />
    </>
  );

  return {
    commands,
    dialogs,
    /** The teacher a restore is running for, to spin its trigger. */
    busyId: restore.isPending ? restore.variables : undefined,
    switchingMode: settings.isPending,
  };
}
