'use client';

import { useId, useState, type ComponentProps, type ReactNode } from 'react';
import { AlertCircleIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupTextarea,
} from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IconButton } from '@/components/shared/icon-button';
import { cn } from '@/lib/utils';

/**
 * The 52px field box. Exported so a control that is not an input — a combobox
 * trigger, a date picker — can look exactly like its neighbours in a form.
 */
export const fieldBoxClass =
  'flex h-13 w-full min-w-0 items-center gap-2.5 rounded-field border border-border bg-card px-4 text-left text-[15px] text-foreground transition-[border-color,box-shadow,background-color] duration-150 ease-out outline-none not-disabled:hover:border-line-hover focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/16 aria-expanded:border-ring aria-expanded:ring-3 aria-expanded:ring-ring/16 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/12 disabled:cursor-not-allowed disabled:bg-background disabled:opacity-55 data-placeholder:text-muted-foreground [&_svg]:shrink-0';

type Chrome = {
  label?: ReactNode;
  /** Shows the red asterisk. The control itself still carries `required`. */
  required?: boolean;
  /** Right-aligned mono note beside the label, e.g. a character counter. */
  aside?: ReactNode;
  hint?: ReactNode;
  /** Replaces the hint, turns the box red and is announced with the control. */
  error?: ReactNode;
  id?: string;
  className?: string;
  /** Leading glyph inside the box. */
  icon?: ReactNode;
};

export type TextFieldOption = { value: string; label: ReactNode };

type InputProps = Chrome &
  Omit<ComponentProps<'input'>, 'className' | 'id' | 'prefix'> & {
    type?: 'text' | 'email' | 'password' | 'tel' | 'number' | 'search' | 'url';
    /** Leading unit in its own paper cell, e.g. `@` for a username. */
    prefix?: ReactNode;
    /** Accessible names for the password reveal toggle. */
    revealLabels?: { show: string; hide: string };
    /** Starts a password field revealed. */
    defaultRevealed?: boolean;
  };

type TextareaProps = Chrome &
  Omit<ComponentProps<'textarea'>, 'className' | 'id'> & { type: 'textarea' };

type SelectProps = Chrome & {
  type: 'select';
  options: TextFieldOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  onBlur?: () => void;
};

export type TextFieldProps = InputProps | TextareaProps | SelectProps;

const CHROME_KEYS = [
  'label',
  'required',
  'aside',
  'hint',
  'error',
  'id',
  'className',
  'icon',
] as const;

/** The props that belong to the native control, without the field chrome. */
function controlProps<T extends Chrome>(props: T): Omit<T, (typeof CHROME_KEYS)[number]> {
  const rest: Record<string, unknown> = { ...props };
  for (const key of CHROME_KEYS) delete rest[key];
  return rest as Omit<T, (typeof CHROME_KEYS)[number]>;
}

/**
 * Label, control and hint or error as one unit. Every Tutorio form field is a
 * TextField, so labels, focus rings, errors and their ARIA wiring are identical
 * across the product. All copy is supplied by the caller.
 */
export function TextField(props: TextFieldProps) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const messageId = `${id}-message`;
  const { label, required, aside, hint, error, className } = props;
  const message = error ?? hint;
  const describedBy = message ? messageId : undefined;
  const invalid = error ? true : undefined;

  return (
    <Field data-slot="text-field" className={cn('gap-2', className)}>
      {label || aside ? (
        <div className="flex items-baseline justify-between gap-3">
          {label ? (
            <FieldLabel htmlFor={id} className="text-sm leading-5 font-medium">
              <span>
                {label}
                {required ? (
                  <span aria-hidden="true" className="text-destructive">
                    {' *'}
                  </span>
                ) : null}
              </span>
            </FieldLabel>
          ) : (
            <span />
          )}
          {aside ? (
            <span className="font-mono text-xs leading-[18px] text-muted-foreground">{aside}</span>
          ) : null}
        </div>
      ) : null}

      <TextFieldControl field={props} a11y={{ id, describedBy, invalid }} />

      {error ? (
        <FieldError
          id={messageId}
          className="flex items-center gap-1.5 text-[13px] leading-[18px] font-medium"
        >
          <AlertCircleIcon aria-hidden="true" className="size-3.5 shrink-0" />
          {error}
        </FieldError>
      ) : hint ? (
        <FieldDescription id={messageId} className="text-[13px] leading-[18px]">
          {hint}
        </FieldDescription>
      ) : null}
    </Field>
  );
}

type ControlA11y = { id: string; describedBy?: string; invalid?: true };

function TextFieldControl({ field, a11y }: { field: TextFieldProps; a11y: ControlA11y }) {
  const aria = {
    id: a11y.id,
    'aria-describedby': a11y.describedBy,
    'aria-invalid': a11y.invalid,
    'aria-required': field.required || undefined,
  };

  if (field.type === 'select') {
    const { icon, options, value, onValueChange, placeholder, disabled, name, onBlur } = field;
    return (
      <Select value={value} onValueChange={onValueChange} disabled={disabled} name={name}>
        <SelectTrigger
          {...aria}
          onBlur={onBlur}
          className={cn(
            fieldBoxClass,
            'justify-between data-[size=default]:h-13 [&>svg:last-child]:size-4.5',
          )}
        >
          {icon ? (
            <span aria-hidden="true" className="flex text-muted-foreground [&_svg]:size-4.5">
              {icon}
            </span>
          ) : null}
          <span className="min-w-0 grow truncate text-left">
            <SelectValue placeholder={placeholder} />
          </span>
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  if (field.type === 'textarea') {
    const { type: _type, rows = 3, ...rest } = controlProps(field);
    void _type;
    return (
      <InputGroup size="field" className="h-auto items-start">
        <InputGroupTextarea
          {...rest}
          {...aria}
          rows={rows}
          // The box grows with its rows the way the reference does: 28px of
          // padding plus one 22px line per row.
          style={{ minHeight: 28 + 22 * rows }}
          className="px-4 py-3.5 text-[15px] leading-[22px] md:text-[15px]"
        />
      </InputGroup>
    );
  }

  return <TextFieldInput field={field} aria={aria} />;
}

function TextFieldInput({
  field,
  aria,
}: {
  field: InputProps;
  aria: Record<string, string | boolean | undefined>;
}) {
  const {
    type = 'text',
    prefix,
    revealLabels,
    defaultRevealed = false,
    ...rest
  } = controlProps(field);
  const [revealed, setRevealed] = useState(defaultRevealed);
  const password = type === 'password';
  const icon = field.icon;

  return (
    <InputGroup size="field">
      {prefix ? (
        <InputGroupAddon
          align="inline-start"
          className="h-full self-stretch rounded-l-[15px] border-r border-border bg-background px-3 py-0 text-[15px] font-normal"
        >
          {prefix}
        </InputGroupAddon>
      ) : icon ? (
        <InputGroupAddon align="inline-start" className="pl-4 [&>svg]:size-4.5">
          {icon}
        </InputGroupAddon>
      ) : null}
      <InputGroupInput
        {...rest}
        {...aria}
        type={password && revealed ? 'text' : type}
        className={cn(
          'h-full text-[15px] md:text-[15px]',
          prefix ? 'pl-3.5' : icon ? 'pl-2.5' : 'pl-4',
          password ? 'pr-1' : 'pr-4',
        )}
      />
      {password && revealLabels ? (
        <InputGroupAddon align="inline-end" className="pr-2">
          <IconButton
            size={36}
            tone="ghost"
            icon={revealed ? <EyeOffIcon /> : <EyeIcon />}
            label={revealed ? revealLabels.hide : revealLabels.show}
            aria-pressed={revealed}
            disabled={rest.disabled}
            onClick={() => setRevealed((value) => !value)}
          />
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}
