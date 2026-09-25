'use client';

import { useEffect, useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { CreateFormValues } from '../../model/create';
import { priceText } from './create-price';
import type { CreateData } from './use-create-data';

/**
 * What the lesson form fills in for what is picked, without overriding the
 * tutor: the teacher of the direction or the group; the price from the pair's
 * rate (or the group's), following a new teacher unless it was typed by hand
 * — with the rate it replaced, for «Оновлено»; and the usual length of the
 * direction's or group's schedule while the length is untouched.
 */
export function useCreatePrefill({
  form,
  data,
  picked,
  lengthGiven,
  teacherId,
}: {
  form: UseFormReturn<CreateFormValues>;
  data: CreateData;
  /** The picked student's or group's id, or "". */
  picked: string;
  /** A length came with the form (e.g. a drag on the calendar): keep it. */
  lengthGiven: boolean;
  /**
   * The teacher the form was opened for (a teacher's profile): used until a
   * pick brings its own direction's or group's teacher.
   */
  teacherId?: string;
}) {
  const [updatedFrom, setUpdatedFrom] = useState<number | null>(null);

  // The teacher follows the pick: the direction's or the group's teacher.
  const pickKey = `${picked}:${data.regularTeacherId ?? ''}`;
  const lastPick = useRef<string | null>(null);
  const fallback = teacherId ?? data.firstTeacherId;
  useEffect(() => {
    if (lastPick.current === pickKey) return;
    const teacher = data.regularTeacherId ?? (picked && !teacherId ? null : fallback);
    if (!teacher && !fallback) return;
    lastPick.current = pickKey;
    form.setValue('teacherId', teacher ?? fallback ?? '');
  }, [data.regularTeacherId, fallback, form, pickKey, picked, teacherId]);

  // The price follows the pick and the teacher, unless it was typed by hand.
  const rate = data.group ? data.group.rateMinor : (data.booking?.rateMinor ?? null);
  const lastRate = useRef<number | null>(null);
  useEffect(() => {
    form.setValue('priceMode', data.priceMode);
    if (rate === null) {
      lastRate.current = null;
      return;
    }
    const previous = lastRate.current;
    if (previous === rate) return;
    const current = form.getValues('price');
    if (current === '' || (previous !== null && current === priceText(previous))) {
      form.setValue('price', priceText(rate));
      setUpdatedFrom(previous !== null && data.booking?.substitute ? previous : null);
    }
    lastRate.current = rate;
  }, [data.booking?.substitute, data.priceMode, form, rate]);

  // The usual length of the direction or group, while the length is untouched.
  const usual = data.schedule?.durationMin ?? null;
  useEffect(() => {
    if (usual && !lengthGiven && !form.getFieldState('durationMin').isDirty) {
      form.setValue('durationMin', String(usual));
    }
  }, [form, lengthGiven, usual]);

  return { rate, usual, updatedFrom, clearUpdated: () => setUpdatedFrom(null) };
}
