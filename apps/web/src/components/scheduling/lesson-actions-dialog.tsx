'use client';

import { useState } from 'react';
import {
  CalendarClockIcon,
  CheckIcon,
  RotateCcwIcon,
  StickyNoteIcon,
  Trash2Icon,
  XCircleIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  cancellationTiming,
  hoursUntil,
  suggestedCancellationStatus,
} from '@tutorio/domain';
import type { CancelledByDto, LessonResponse } from '@tutorio/validation';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { LessonStatusBadge } from '@/components/app/status-badges';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { DateTimePicker } from '@/components/shared';
import { errorMessageKey } from '@/lib/api/error-message';
import {
  useDeleteLessonMutation,
  useRescheduleLessonMutation,
  useTransitionLessonMutation,
  useUpdateLessonMutation,
} from '@/lib/api/scheduling';
import { toLocalDateTimeInput } from '@/lib/datetime';
import { useDateFormatters } from '@/lib/i18n/format';

const CANCELLED_BY: CancelledByDto[] = ['TEACHER', 'STUDENT', 'GROUP'];

/** Which panel of the dialog is showing. */
export type LessonDialogMode = 'menu' | 'cancel' | 'reschedule';

type Mode = LessonDialogMode;

export function LessonActionsDialog({
  open,
  onOpenChange,
  lesson,
  initialMode = 'menu',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: LessonResponse | null;
  /** Which panel to open on: a row menu can jump straight to reschedule. */
  initialMode?: Mode;
}) {
  const t = useTranslations('scheduling.actions');
  const tBy = useTranslations('scheduling.cancelledBy');
  const tCancel = useTranslations('scheduling.cancelDialog');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const format = useDateFormatters();

  const transition = useTransitionLessonMutation();
  const reschedule = useRescheduleLessonMutation();
  const updateLesson = useUpdateLessonMutation();
  const deleteLesson = useDeleteLessonMutation();

  const [mode, setMode] = useState<Mode>('menu');
  const [charged, setCharged] = useState('charged');
  const [cancelledBy, setCancelledBy] = useState<CancelledByDto>('STUDENT');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [newStart, setNewStart] = useState('');
  const [scope, setScope] = useState<'this' | 'this_and_following'>('this');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // How late a cancellation would be, decided by the deadline that applies to
  // this lesson — so the tutor is not choosing "charge or not" blind.
  const startsAt = lesson ? new Date(lesson.startsAtUtc) : null;
  const hoursLeft = startsAt ? hoursUntil(startsAt, new Date()) : 0;
  const timing =
    startsAt && lesson
      ? cancellationTiming(startsAt, new Date(), lesson.cancellationDeadlineHours)
      : 'on_time';

  // Reset on the transition into "open", at render time — the repo convention
  // for uncontrolled dialogs (an effect here trips the React Compiler's
  // set-state-in-effect rule).
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (open && lesson && openedFor !== lesson.id) {
    setOpenedFor(lesson.id);
    setMode(initialMode);
    setCancelledBy('STUDENT');
    setReason('');
    setNotes(lesson.notes ?? '');
    setNewStart(toLocalDateTimeInput(new Date(lesson.startsAtUtc)));
    setScope('this');
    // Preselect what the deadline implies; the tutor can still override it.
    setCharged(
      suggestedCancellationStatus(timing) === 'CANCELLED_CHARGED'
        ? 'charged'
        : 'uncharged',
    );
  }
  if (!open && openedFor !== null) {
    setOpenedFor(null);
  }

  if (!lesson) {
    return null;
  }

  const anyError =
    transition.error ?? reschedule.error ?? deleteLesson.error ?? updateLesson.error;
  const isScheduled = lesson.status === 'SCHEDULED';
  const notesDirty = notes !== (lesson.notes ?? '');

  const runTransition = async (dto: Parameters<typeof transition.mutateAsync>[0]['dto']) => {
    try {
      await transition.mutateAsync({ lessonId: lesson.id, dto });
      onOpenChange(false);
    } catch {
      // Surfaced by the alert.
    }
  };

  const runReschedule = async (force = false) => {
    if (!newStart) {
      return;
    }
    const dto = { startsAtUtc: new Date(newStart).toISOString(), scope };
    try {
      await reschedule.mutateAsync({ lessonId: lesson.id, dto, force });
      toast.success(t('toastRescheduled'));
      onOpenChange(false);
    } catch (error) {
      if ((error as { status?: number }).status === 409) {
        toast.error(tErrors('SCHEDULE_CONFLICT'), {
          action: { label: tCancel('submit'), onClick: () => void runReschedule(true) },
        });
        return;
      }
      // Surfaced by the alert.
    }
  };

  const runDelete = async () => {
    try {
      await deleteLesson.mutateAsync(lesson.id);
      toast.success(t('toastDeleted'));
      setConfirmDelete(false);
      onOpenChange(false);
    } catch {
      setConfirmDelete(false);
    }
  };

  const saveNotes = async () => {
    try {
      await updateLesson.mutateAsync({
        lessonId: lesson.id,
        dto: { notes: notes.trim() || null },
      });
      toast.success(t('toastUpdated'));
    } catch {
      // Surfaced by the alert.
    }
  };

  const title = lesson.student?.fullName ?? lesson.group?.name ?? t('title');
  const busy =
    transition.isPending || reschedule.isPending || deleteLesson.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {title}
              <LessonStatusBadge status={lesson.status} />
            </DialogTitle>
            <DialogDescription>
              {format.dayMonthTime(lesson.startsAtUtc)} · {lesson.teacher.name}
            </DialogDescription>
          </DialogHeader>

          {anyError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{tErrors(errorMessageKey(anyError))}</AlertDescription>
            </Alert>
          ) : null}

          {mode === 'menu' ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                {isScheduled ? (
                  <>
                    <Button
                      disabled={busy}
                      onClick={() => void runTransition({ targetStatus: 'COMPLETED' })}
                    >
                      <CheckIcon data-icon="inline-start" />
                      {t('complete')}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => setMode('reschedule')}
                    >
                      <CalendarClockIcon data-icon="inline-start" />
                      {t('reschedule')}
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={busy}
                      onClick={() => setMode('cancel')}
                    >
                      <XCircleIcon data-icon="inline-start" />
                      {t('cancel')}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void runTransition({ targetStatus: 'SCHEDULED' })}
                  >
                    <RotateCcwIcon data-icon="inline-start" />
                    {t('reactivate')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2Icon data-icon="inline-start" />
                  {t('delete')}
                </Button>
              </div>

              <Field>
                <FieldLabel htmlFor="lesson-actions-notes">
                  <StickyNoteIcon className="text-muted-foreground size-4" />
                  {t('notes')}
                </FieldLabel>
                <Textarea
                  id="lesson-actions-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={t('notesPlaceholder')}
                />
                {notesDirty ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    disabled={updateLesson.isPending}
                    onClick={() => void saveNotes()}
                  >
                    {updateLesson.isPending ? <Spinner data-icon="inline-start" /> : null}
                    {t('saveNotes')}
                  </Button>
                ) : null}
              </Field>
            </div>
          ) : null}

          {mode === 'reschedule' ? (
            <div className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="lesson-new-start">{t('newTime')}</FieldLabel>
                <DateTimePicker
                  id="lesson-new-start"
                  value={newStart}
                  onChange={setNewStart}
                />
              </Field>

              {/* Only a series lesson can move its followers. */}
              {lesson.seriesId ? (
                <Field>
                  <FieldLabel htmlFor="lesson-scope">{t('scope')}</FieldLabel>
                  <Select
                    value={scope}
                    onValueChange={(value) =>
                      setScope(value as 'this' | 'this_and_following')
                    }
                  >
                    <SelectTrigger id="lesson-scope" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="this">{t('scopeThis')}</SelectItem>
                        <SelectItem value="this_and_following">
                          {t('scopeFollowing')}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
            </div>
          ) : null}

          {mode === 'cancel' ? (
            <div className="flex flex-col gap-4">
              {/* The deadline decides whether this is late — say so plainly. */}
              <Alert variant={timing === 'late' ? 'destructive' : 'default'}>
                <AlertDescription>
                  {hoursLeft < 0
                    ? t('deadlineStarted')
                    : t(timing === 'late' ? 'deadlineLate' : 'deadlineOnTime', {
                        hours: hoursLeft,
                        deadline: lesson.cancellationDeadlineHours,
                      })}
                </AlertDescription>
              </Alert>

              <Field>
                <FieldLabel>{tCancel('charge')}</FieldLabel>
                <RadioGroup value={charged} onValueChange={setCharged}>
                  <FieldLabel
                    htmlFor="charge-yes"
                    className="flex items-center gap-2 font-normal"
                  >
                    <RadioGroupItem id="charge-yes" value="charged" />
                    {tCancel('charged')}
                  </FieldLabel>
                  <FieldLabel
                    htmlFor="charge-no"
                    className="flex items-center gap-2 font-normal"
                  >
                    <RadioGroupItem id="charge-no" value="uncharged" />
                    {tCancel('uncharged')}
                  </FieldLabel>
                </RadioGroup>
              </Field>

              <Field>
                <FieldLabel htmlFor="cancelled-by">{tCancel('by')}</FieldLabel>
                <Select
                  value={cancelledBy}
                  onValueChange={(value) => setCancelledBy(value as CancelledByDto)}
                >
                  <SelectTrigger id="cancelled-by" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {CANCELLED_BY.map((value) => (
                        <SelectItem key={value} value={value}>
                          {tBy(value)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="cancel-reason">{tCancel('reason')}</FieldLabel>
                <Textarea
                  id="cancel-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </Field>
            </div>
          ) : null}

          <DialogFooter>
            {mode === 'menu' ? (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('close')}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setMode('menu')}>
                  {tCommon('back')}
                </Button>
                {mode === 'reschedule' ? (
                  <Button
                    disabled={!newStart || reschedule.isPending}
                    onClick={() => void runReschedule()}
                  >
                    {reschedule.isPending ? <Spinner data-icon="inline-start" /> : null}
                    {t('reschedule')}
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    disabled={transition.isPending}
                    onClick={() =>
                      void runTransition({
                        targetStatus:
                          charged === 'charged'
                            ? 'CANCELLED_CHARGED'
                            : 'CANCELLED_UNCHARGED',
                        cancelledBy,
                        cancelledReason: reason || null,
                      })
                    }
                  >
                    {transition.isPending ? <Spinner data-icon="inline-start" /> : null}
                    {tCancel('submit')}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('deleteTitle')}
        description={t('deleteDescription')}
        confirmLabel={tCommon('delete')}
        onConfirm={() => void runDelete()}
        pending={deleteLesson.isPending}
      />
    </>
  );
}
