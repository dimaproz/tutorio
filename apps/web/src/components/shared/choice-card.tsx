'use client';

import { useId, type ReactNode } from 'react';
import { CheckIcon } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

export type ChoiceCardOption<T extends string> = {
  value: T;
  title: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  /** Replaces the icon tile with the caller's own mark, e.g. a currency's flag. */
  media?: ReactNode;
};

export type ChoiceCardAppearance = 'card' | 'tile';

/**
 * A large radio choice: icon tile, title, hint and a radio on the trailing
 * edge. The whole card is the label, so a click anywhere selects it; keyboard
 * users move through the group with the arrow keys like any radio group.
 *
 * `tile` is the settings choice (S10): a paper tile that turns indigo with a
 * 2px ring and a check disc in its corner when chosen; `idleIndicator` shows
 * the empty circle on the others (a mode, not a currency).
 */
export function ChoiceCardGroup<T extends string>({
  value,
  onValueChange,
  options,
  label,
  disabled,
  appearance = 'card',
  idleIndicator = true,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: ChoiceCardOption<T>[];
  /** Accessible name of the group; the visible legend belongs to the caller. */
  label: string;
  disabled?: boolean;
  appearance?: ChoiceCardAppearance;
  idleIndicator?: boolean;
  className?: string;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      aria-label={label}
      disabled={disabled}
      className={cn('gap-3', className)}
    >
      {options.map((option) =>
        appearance === 'tile' ? (
          <ChoiceTile
            key={option.value}
            option={option}
            selected={option.value === value}
            idleIndicator={idleIndicator}
          />
        ) : (
          <ChoiceCard key={option.value} option={option} selected={option.value === value} />
        ),
      )}
    </RadioGroup>
  );
}

function ChoiceCard<T extends string>({
  option,
  selected,
}: {
  option: ChoiceCardOption<T>;
  selected: boolean;
}) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      data-slot="choice-card"
      data-selected={selected}
      className={cn(
        'flex w-full cursor-pointer items-start gap-3.5 rounded-row p-4 text-foreground transition-[background-color,border-color] duration-150 ease-out has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
        // The selected border is 2px; the resting one is 1px plus a 1px margin
        // so the content never shifts when the selection moves.
        selected
          ? 'border-2 border-brand bg-surface-hover'
          : 'm-px w-[calc(100%-2px)] border border-border bg-card hover:border-brand-line hover:bg-surface-hover',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-control [&_svg]:size-5',
          selected
            ? 'bg-tile-indigo text-tile-indigo-foreground'
            : 'bg-background text-muted-foreground',
        )}
      >
        {option.icon}
      </span>
      <span className="flex min-w-0 grow flex-col gap-1">
        <span className="text-[15px] leading-5 font-semibold">{option.title}</span>
        {option.hint ? (
          <span className="text-[13px] leading-[18px] text-muted-foreground">{option.hint}</span>
        ) : null}
      </span>
      <RadioGroupItem
        id={id}
        value={option.value}
        className="mt-0.5 size-5.5 border-2 border-border bg-transparent focus-visible:ring-0 data-checked:border-brand data-checked:bg-brand dark:data-checked:bg-brand [&_[data-slot=radio-group-indicator]]:size-5.5 [&_[data-slot=radio-group-indicator]>span]:size-2.5 [&_[data-slot=radio-group-indicator]>span]:bg-brand-foreground"
      />
    </label>
  );
}

function ChoiceTile<T extends string>({
  option,
  selected,
  idleIndicator,
}: {
  option: ChoiceCardOption<T>;
  selected: boolean;
  idleIndicator: boolean;
}) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      data-slot="choice-card"
      data-appearance="tile"
      data-selected={selected}
      className={cn(
        'relative flex w-full cursor-pointer items-start gap-3.5 rounded-row p-4 pr-11 text-foreground transition-[background-color,box-shadow] duration-150 ease-out has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
        selected
          ? 'bg-tint-indigo text-tint-foreground ring-2 ring-primary ring-inset'
          : 'bg-background hover:bg-surface-hover',
      )}
    >
      {option.media ?? (
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-control bg-card text-brand [&_svg]:size-5"
        >
          {option.icon}
        </span>
      )}
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="text-[15px] leading-5 font-semibold md:text-base">{option.title}</span>
        {option.hint ? (
          <span className="text-[13px] leading-[18px] text-muted-foreground">{option.hint}</span>
        ) : null}
      </span>
      {/* The radio itself is the corner circle; the check is drawn over it. */}
      <RadioGroupItem
        id={id}
        value={option.value}
        className={cn(
          'absolute top-3 right-3 size-5 border-2 border-border bg-card focus-visible:ring-0 data-checked:border-primary [&_[data-slot=radio-group-indicator]>span]:hidden',
          !idleIndicator && 'data-[state=unchecked]:opacity-0',
        )}
      />
      {selected ? (
        <CheckIcon
          aria-hidden="true"
          strokeWidth={3}
          className="pointer-events-none absolute top-4 right-4 size-3 text-primary-foreground"
        />
      ) : null}
    </label>
  );
}
