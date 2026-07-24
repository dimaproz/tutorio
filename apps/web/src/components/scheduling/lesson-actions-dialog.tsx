'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CancelledByDto, LessonResponse } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTransitionLessonMutation } from '@/lib/api/scheduling';

const CANCELLED_BY: CancelledByDto[] = ['TEACHER', 'STUDENT', 'GROUP'];

export function LessonActionsDialog({
  open,
  onOpenChange,
  lesson,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: LessonResponse | null;
}) {
  const t = useTranslations('scheduling.actions');
  const tStatus = useTranslations('scheduling.status');
  const tBy = useTranslations('scheduling.cancelledBy');
  const tCancel = useTranslations('scheduling.cancelDialog');
  const transition = useTransitionLessonMutation();

  const [mode, setMode] = useState<'menu' | 'cancel'>('menu');
  const [charged, setCharged] = useState('charged');
  const [cancelledBy, setCancelledBy] = useState<CancelledByDto>('STUDENT');
  const [reason, setReason] = useState('');

  // Reset the form to a clean state whenever the dialog transitions to open,
  // without an effect (see repo convention in lesson-form-dialog).
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setMode('menu');
    setCharged('charged');
    setCancelledBy('STUDENT');
    setReason('');
  }
  if (!open && wasOpen) {
    setWasOpen(false);
  }

  if (!lesson) {
    return null;
  }

  const run = async (dto: Parameters<typeof transition.mutateAsync>[0]['dto']) => {
    await transition.mutateAsync({ lessonId: lesson.id, dto });
    onOpenChange(false);
  };

  const title = lesson.student?.fullName ?? lesson.group?.name ?? t('title');
  const when = new Date(lesson.startsAtUtc).toLocaleString();
  const isScheduled = lesson.status === 'SCHEDULED';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title}
            <Badge variant="secondary">{tStatus(lesson.status)}</Badge>
          </DialogTitle>
          <DialogDescription>
            {when} · {lesson.teacher.name}
          </DialogDescription>
        </DialogHeader>

        {mode === 'menu' ? (
          <div className="flex flex-col gap-2">
            {isScheduled ? (
              <>
                <Button onClick={() => void run({ targetStatus: 'COMPLETED' })}>
                  {t('complete')}
                </Button>
                <Button variant="destructive" onClick={() => setMode('cancel')}>
                  {t('cancel')}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => void run({ targetStatus: 'SCHEDULED' })}
              >
                {t('reactivate')}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel>{tCancel('charge')}</FieldLabel>
              <RadioGroup value={charged} onValueChange={setCharged}>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="charged" />
                  {tCancel('charged')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="uncharged" />
                  {tCancel('uncharged')}
                </label>
              </RadioGroup>
            </Field>
            <Field>
              <FieldLabel>{tCancel('by')}</FieldLabel>
              <Select
                value={cancelledBy}
                onValueChange={(value) => setCancelledBy(value as CancelledByDto)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANCELLED_BY.map((value) => (
                    <SelectItem key={value} value={value}>
                      {tBy(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{tCancel('reason')}</FieldLabel>
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
            </Field>
          </div>
        )}

        <DialogFooter>
          {mode === 'cancel' ? (
            <>
              <Button variant="outline" onClick={() => setMode('menu')}>
                {tCancel('cancel')}
              </Button>
              <Button
                variant="destructive"
                disabled={transition.isPending}
                onClick={() =>
                  void run({
                    targetStatus:
                      charged === 'charged' ? 'CANCELLED_CHARGED' : 'CANCELLED_UNCHARGED',
                    cancelledBy,
                    cancelledReason: reason || null,
                  })
                }
              >
                {tCancel('submit')}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('close')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
