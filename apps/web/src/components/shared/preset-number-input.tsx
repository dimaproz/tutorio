'use client';

import { useState, type ReactNode } from 'react';
import { ChevronsUpDownIcon } from 'lucide-react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export function selectedPresetValue(value: string, presets: readonly number[]): string {
  return presets.includes(Number(value)) ? value : '';
}

export function PresetNumberInput({
  id,
  value,
  onValueChange,
  onBlur,
  presets,
  presetsLabel,
  formatPreset = String,
  hint,
  invalid = false,
  disabled = false,
  min,
  max,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  presets: readonly number[];
  /** Accessible name for the button that opens the preset choices. */
  presetsLabel: string;
  formatPreset?: (value: number) => ReactNode;
  hint?: ReactNode;
  invalid?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const selected = selectedPresetValue(value, presets);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
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
          <InputGroupAddon align="inline-end">
            <PopoverTrigger asChild>
              <InputGroupButton
                size="icon-xs"
                disabled={disabled}
                aria-label={presetsLabel}
                title={presetsLabel}
              >
                <ChevronsUpDownIcon aria-hidden="true" />
              </InputGroupButton>
            </PopoverTrigger>
          </InputGroupAddon>
        </InputGroup>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) space-y-3"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {hint ? <p className="text-sm leading-normal text-muted-foreground">{hint}</p> : null}
        <ToggleGroup
          type="single"
          value={selected}
          onValueChange={(next) => {
            if (!next) return;
            onValueChange(next);
            setOpen(false);
          }}
          variant="outline"
          className="grid w-full grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))]"
        >
          {presets.map((preset) => (
            <ToggleGroupItem key={preset} value={String(preset)} className="w-full min-w-0">
              {formatPreset(preset)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </PopoverContent>
    </Popover>
  );
}
