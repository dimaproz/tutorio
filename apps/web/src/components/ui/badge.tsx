import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import { Slot } from 'radix-ui';

const badgeVariants = cva(
  'group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-pill border border-transparent px-2.5 leading-none font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground [a]:hover:bg-primary/80',
        // Lifecycle tints. Every pair is a painted surface with its own
        // foreground, so it reads the same in both themes.
        primary: 'bg-tint-indigo text-tint-indigo-foreground',
        indigo: 'bg-tint-indigo text-tint-indigo-foreground',
        success: 'bg-tint-success text-tint-success-foreground',
        warning: 'bg-tint-warning text-tint-warning-foreground',
        danger: 'bg-tint-danger text-tint-danger-foreground',
        destructive: 'bg-tint-danger text-tint-danger-foreground',
        info: 'bg-tint-info text-tint-info-foreground',
        secondary: 'bg-background text-muted-foreground',
        neutral: 'bg-background text-muted-foreground',
        brand: 'bg-brand-soft text-brand-soft-foreground',
        surface: 'bg-card text-foreground',
        'on-ink': 'bg-feature-soft text-feature-foreground',
        'on-tint': 'bg-chip-on-tint text-chip-on-tint-foreground',
        /** Success on a tinted card, where the green tint would sink into the ground. */
        'success-inverse': 'bg-card text-tint-success-foreground',
        outline: 'border-border text-foreground [a]:hover:bg-muted',
        ghost: 'hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50',
        link: 'text-brand underline-offset-4 hover:underline',
        /** Navigation and filter counts: mono figures in a compact pill. */
        counter: 'bg-secondary font-mono text-muted-foreground',
      },
      size: {
        sm: 'h-6 text-xs',
        md: 'h-6.5 text-xs',
        lg: 'h-6.5 text-[13px]',
      },
    },
    compoundVariants: [
      { variant: 'counter', size: 'sm', class: 'h-5.5 min-w-6.5 px-2' },
      { variant: 'counter', size: 'md', class: 'h-5.5 min-w-6.5 px-2' },
      { variant: 'counter', size: 'lg', class: 'h-5.5 min-w-6.5 px-2' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

const DOT_TONE = {
  current: 'bg-current',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger-mark',
  archived: 'bg-status-archived',
  brand: 'bg-brand',
} as const;

const VARIANT_DOT =
  'bg-current group-data-[variant=success]/badge:bg-success group-data-[variant=warning]/badge:bg-warning group-data-[variant=danger]/badge:bg-danger-mark group-data-[variant=destructive]/badge:bg-danger-mark group-data-[variant=neutral]/badge:bg-status-archived group-data-[variant=secondary]/badge:bg-status-archived group-data-[variant=surface]/badge:bg-success group-data-[variant=on-ink]/badge:bg-brand-soft group-data-[variant=success-inverse]/badge:bg-success group-data-[variant=info]/badge:bg-tint-info-foreground group-data-[variant=indigo]/badge:bg-tint-indigo-foreground group-data-[variant=brand]/badge:bg-ink';

function Badge({
  className,
  variant = 'default',
  size = 'md',
  dot = false,
  dotTone,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    dot?: boolean;
    /** Overrides the dot colour the variant would pick, for painted surfaces. */
    dotTone?: keyof typeof DOT_TONE;
  }) {
  const shared = {
    'data-slot': 'badge',
    'data-variant': variant,
    'data-size': size,
    className: cn(badgeVariants({ variant, size }), className),
    ...props,
  };

  // Slot clones a single child, so a composed badge cannot carry a dot.
  if (asChild) {
    return <Slot.Root {...shared}>{children}</Slot.Root>;
  }

  return (
    <span {...shared}>
      {dot ? (
        <span
          aria-hidden="true"
          data-slot="badge-dot"
          className={cn(
            'size-[7px] shrink-0 rounded-pill',
            // A variant's own dot colour wins over a plain one by specificity,
            // so it applies only when no tone is asked for.
            dotTone ? DOT_TONE[dotTone] : VARIANT_DOT,
          )}
        />
      ) : null}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
