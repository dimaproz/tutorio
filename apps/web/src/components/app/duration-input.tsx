'use client';

import { useState } from 'react';
import { InfoIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InputGroup, InputGroupInput } from '@/components/ui/input-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export const POPULAR_DURATIONS = [30, 45, 60, 90, 120] as const;

/**
 * A numeric duration field with common lesson lengths one click away. The
 * regular input remains editable, so uncommon durations never need a special
 * "other" path.
 */
export function DurationInput({
  id,
  value,
  onValueChange,
  onBlur,
  invalid = false,
  disabled = false,
  min = 5,
  max = 720,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
}) {
  const t = useTranslations('common');
  const [open, setOpen] = useState(false);
  const selectedPreset = POPULAR_DURATIONS.includes(
    Number(value) as (typeof POPULAR_DURATIONS)[number],
  )
    ? value
    : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="w-full">
          <InputGroup>
            <InputGroupInput
              id={id}
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              value={value}
              aria-invalid={invalid || undefined}
              disabled={disabled}
              onBlur={onBlur}
              onChange={(event) => onValueChange(event.target.value)}
            />
          </InputGroup>
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width)"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Alert variant="secondary">
          <InfoIcon />
          <AlertDescription>{t('durationChoiceHint')}</AlertDescription>
        </Alert>
        <ToggleGroup
          type="single"
          value={selectedPreset}
          onValueChange={(next) => {
            if (!next) {
              return;
            }
            onValueChange(next);
            setOpen(false);
          }}
          variant="outline"
          size="default"
          className="grid w-full grid-cols-[repeat(auto-fit,minmax(5rem,1fr))]"
        >
          {POPULAR_DURATIONS.map((minutes) => (
            <ToggleGroupItem key={minutes} value={String(minutes)} className="w-full min-w-0">
              {t('durationMinutes', { minutes })}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </PopoverContent>
    </Popover>
  );
}
