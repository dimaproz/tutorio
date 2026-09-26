'use client';

import { useState } from 'react';
import { MinusIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * A whole number with − and + (S10 board 03): the value in mono with its
 * unit, typed or stepped inside `min`…`max`, and the preset pills under it.
 * A changed value gets the warning ring the «змінено» mark speaks of.
 */
export function SettingStepper({
  value,
  onChange,
  min,
  max,
  unit,
  presets = [],
  presetLabel,
  changed,
  labelledBy,
  labels,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** The unit after the value, agreeing with it («4 тижні»). */
  unit: string;
  presets?: readonly number[];
  presetLabel?: (value: number) => string;
  changed: boolean;
  /** Id of the setting's heading: the field's name. */
  labelledBy: string;
  labels: { decrease: string; increase: string; presets: string };
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next)));
  const commit = () => {
    if (draft === null) return;
    const parsed = Number.parseInt(draft, 10);
    onChange(Number.isNaN(parsed) ? value : clamp(parsed));
    setDraft(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        data-changed={changed || undefined}
        className={cn(
          'flex h-13 w-full max-w-72.5 items-center gap-2 rounded-tile bg-background p-1.5 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring',
          changed && 'ring-2 ring-warning',
        )}
      >
        <Button
          type="button"
          variant="surface"
          size="icon-md"
          aria-label={labels.decrease}
          disabled={value <= min}
          onClick={() => onChange(clamp(value - 1))}
        >
          <MinusIcon />
        </Button>
        <label className="flex min-w-0 grow items-baseline justify-center gap-1.5">
          <input
            type="text"
            inputMode="numeric"
            role="spinbutton"
            aria-labelledby={labelledBy}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-valuetext={`${value} ${unit}`}
            value={draft ?? String(value)}
            onChange={(event) => setDraft(event.currentTarget.value.replace(/\D/g, '').slice(0, 3))}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit();
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                onChange(clamp(value + 1));
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                onChange(clamp(value - 1));
              }
            }}
            className="w-[3ch] bg-transparent text-right font-mono text-lg leading-6 font-semibold tabular-nums outline-none"
          />
          <span className="text-sm text-muted-foreground">{unit}</span>
        </label>
        <Button
          type="button"
          variant="surface"
          size="icon-md"
          aria-label={labels.increase}
          disabled={value >= max}
          onClick={() => onChange(clamp(value + 1))}
        >
          <PlusIcon />
        </Button>
      </div>
      {presets.length > 0 ? (
        <div role="group" aria-label={labels.presets} className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <Button
              key={preset}
              type="button"
              size="xs"
              variant={preset === value ? 'default' : 'paper'}
              aria-pressed={preset === value}
              onClick={() => onChange(preset)}
            >
              {presetLabel ? presetLabel(preset) : preset}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
