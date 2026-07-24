'use client';

import { useMemo, useState } from 'react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { CreateLessonDto } from '@tutorio/validation';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEnrollmentsQuery } from '@/lib/api/enrollments';
import { useCreateLessonMutation } from '@/lib/api/scheduling';
import { formatPriceInput, parsePriceInput } from '@/lib/money';

// datetime-local value ("2026-07-24T10:00") → ISO in the browser's timezone.
function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

export function LessonFormDialog({
  open,
  onOpenChange,
  initialStart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStart?: Date;
}) {
  const t = useTranslations('scheduling.lessonForm');
  const tConflict = useTranslations('scheduling.conflict');
  const enrollments = useEnrollmentsQuery({ page: 1 }, open);
  const createLesson = useCreateLessonMutation();

  const [enrollmentId, setEnrollmentId] = useState('');
  const [duration, setDuration] = useState('60');
  const [price, setPrice] = useState('');
  const [dates, setDates] = useState<string[]>(['']);

  const selected = useMemo(
    () => enrollments.data?.items.find((item) => item.id === enrollmentId),
    [enrollments.data, enrollmentId],
  );

  // Reset to a clean form each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setEnrollmentId('');
    setDuration('60');
    setPrice('');
    const start = initialStart
      ? // Trim seconds/tz to a datetime-local string in browser time.
        new Date(initialStart.getTime() - initialStart.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : '';
    setDates([start]);
  }
  if (!open && wasOpen) {
    setWasOpen(false);
  }

  const onPickEnrollment = (id: string) => {
    setEnrollmentId(id);
    const enrollment = enrollments.data?.items.find((item) => item.id === id);
    if (enrollment) {
      setPrice(formatPriceInput(enrollment.priceMinor));
    }
  };

  const submit = async (force = false) => {
    const priceMinor = parsePriceInput(price);
    if (!selected || priceMinor === null) {
      return;
    }
    const dto: CreateLessonDto = {
      enrollmentId: selected.id,
      teacherId: selected.teacher.id,
      startsAt: dates.filter(Boolean).map(localInputToIso),
      durationMin: Number(duration),
      priceMinor,
      currency: selected.currency,
    };
    try {
      await createLesson.mutateAsync({ dto, force });
      onOpenChange(false);
    } catch (error) {
      if ((error as { status?: number }).status === 409) {
        toast.error(tConflict('message'), {
          action: { label: tConflict('force'), onClick: () => void submit(true) },
        });
        return;
      }
      throw error;
    }
  };

  const canSubmit = Boolean(selected) && dates.some(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('createTitle')}</DialogTitle>
          <DialogDescription>{t('createSubtitle')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel>{t('enrollment')}</FieldLabel>
            <Select value={enrollmentId} onValueChange={onPickEnrollment}>
              <SelectTrigger>
                <SelectValue placeholder={t('enrollmentPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {enrollments.data?.items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.student.fullName}
                    {item.group ? ` · ${item.group.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {enrollments.data && enrollments.data.items.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('noEnrollments')}</p>
            ) : null}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>{t('duration')}</FieldLabel>
              <Input
                type="number"
                min={5}
                max={720}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t('price')}</FieldLabel>
              <Input value={price} onChange={(event) => setPrice(event.target.value)} />
            </Field>
          </div>

          <Field>
            <FieldLabel>{t('date')}</FieldLabel>
            <div className="flex flex-col gap-2">
              {dates.map((value, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="datetime-local"
                    value={value}
                    onChange={(event) =>
                      setDates((prev) =>
                        prev.map((item, i) => (i === index ? event.target.value : item)),
                      )
                    }
                  />
                  {dates.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDates((prev) => prev.filter((_, i) => i !== index))}
                      aria-label={t('removeDate')}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => setDates((prev) => [...prev, ''])}
              >
                <PlusIcon className="size-4" />
                {t('addDate')}
              </Button>
            </div>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button disabled={!canSubmit || createLesson.isPending} onClick={() => void submit()}>
            {t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
