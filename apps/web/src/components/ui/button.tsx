import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
// The product cn: a caller's radius (e.g. a field box) replaces the pill.
import { cn } from '@/lib/utils';
import { Slot } from 'radix-ui';

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-pill border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-[background-color,border-color,box-shadow,color,translate,scale,opacity] duration-150 ease-out outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[.98] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-[size^=icon]:active:scale-95 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover hover:shadow-lift',
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover hover:shadow-lift',
        outline:
          'border-border bg-card text-foreground hover:border-line-hover hover:bg-surface-hover aria-expanded:border-line-hover aria-expanded:bg-surface-hover dark:bg-transparent dark:hover:bg-input/30',
        /** Raised paper on a tint: white in light, a hairlined chip in dark. */
        white:
          'border-raised-line bg-raised text-foreground hover:-translate-y-px hover:shadow-raise aria-expanded:shadow-raise',
        soft: 'bg-brand-soft font-semibold text-brand-soft-foreground hover:bg-brand-soft-hover',
        'dark-outline':
          'border-ink-line bg-transparent text-ink-foreground hover:border-ink-line-hover hover:bg-white/8',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary-hover aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        /** Icon-button tone on paper: a white disc that softens on hover. */
        surface: 'bg-card text-foreground hover:bg-secondary aria-expanded:bg-secondary',
        /** Icon-button tone on a card: a paper disc. */
        paper: 'bg-background text-foreground hover:bg-paper-hover aria-expanded:bg-paper-hover',
        /** Icon-button tone on a tinted surface: a frosted disc. */
        translucent: 'bg-card/60 text-foreground hover:bg-card aria-expanded:bg-card',
        ghost:
          'text-muted-foreground hover:bg-secondary hover:text-foreground aria-expanded:bg-secondary aria-expanded:text-foreground dark:hover:bg-muted/50',
        danger:
          'bg-destructive text-destructive-foreground hover:bg-destructive-hover hover:shadow-lift-danger',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive-hover hover:shadow-lift-danger',
        link: 'text-brand underline-offset-4 hover:underline active:scale-100',
      },
      size: {
        default:
          "h-11 gap-2 px-4.5 text-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-4.5",
        xl: "h-12 gap-2 px-5 text-[15px] has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5 [&_svg:not([class*='size-'])]:size-4.5",
        lg: 'h-10 gap-2 px-4 text-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
        sm: 'h-10 gap-2 px-4 text-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
        xs: "h-8 gap-1.5 px-3 text-[13px] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-4",
        icon: "size-11 [&_svg:not([class*='size-'])]:size-4.5",
        'icon-lg': "size-12 [&_svg:not([class*='size-'])]:size-4.5",
        'icon-md': "size-9.5 [&_svg:not([class*='size-'])]:size-4.5",
        'icon-sm': 'size-9',
        'icon-xs': 'size-8',
      },
      /** Pads the leading edge for the bubble slot instead of the icon pairs. */
      bubble: {
        true: 'gap-2.5 pl-1.5',
        false: '',
      },
    },
    compoundVariants: [{ size: 'xl', bubble: true, class: 'pl-2' }],
    defaultVariants: {
      variant: 'default',
      size: 'default',
      bubble: false,
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  leading,
  indicator = false,
  children,
  ...props
}: React.ComponentProps<'button'> &
  Omit<VariantProps<typeof buttonVariants>, 'bubble'> & {
    asChild?: boolean;
    /**
     * Icon rendered inside a sky bubble on the leading edge. The bubble inverts
     * to ink on the `soft` variant so it stays legible on the sky fill.
     */
    leading?: React.ReactNode;
    /** Unread marker for notification-style icon buttons. */
    indicator?: boolean;
  }) {
  const bubbleNode = leading ? (
    <span
      aria-hidden="true"
      data-slot="button-bubble"
      className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-brand-soft text-brand-soft-foreground group-data-[variant=soft]/button:bg-ink group-data-[variant=soft]/button:text-brand-soft [&_svg]:size-4.5 [&_svg]:stroke-[2.5]"
    >
      {leading}
    </span>
  ) : null;

  // Slot clones a single child; `Slottable` marks it, so a composed link can
  // still carry the leading bubble.
  if (asChild) {
    return (
      <Slot.Root
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, bubble: Boolean(leading) }), className)}
        {...props}
      >
        {bubbleNode}
        <Slot.Slottable>{children}</Slot.Slottable>
      </Slot.Root>
    );
  }

  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, bubble: Boolean(leading) }), className)}
      {...props}
    >
      {bubbleNode}
      {children}
      {indicator ? (
        <span
          aria-hidden="true"
          data-slot="button-indicator"
          className="absolute top-2.5 right-[11px] size-2 rounded-pill bg-danger-mark ring-2 ring-card"
        />
      ) : null}
    </button>
  );
}

export { Button, buttonVariants };
