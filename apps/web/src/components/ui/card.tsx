import * as React from 'react';
import { cn } from 'cn';

// Painted card surfaces. Each tone carries its own foreground pair, and every
// pair is redefined by the dark theme. `feature` is the one highlight card on
// a page: ink in light, the saturated indigo in dark. `danger` is reserved for
// the destructive block at the end of an edit form.
const CARD_TONE = {
  surface: 'bg-card text-card-foreground',
  info: 'bg-tint-info text-tint-foreground',
  warning: 'bg-tint-warning text-tint-foreground',
  indigo: 'bg-tint-indigo text-tint-foreground',
  ink: 'bg-ink text-ink-foreground',
  feature: 'bg-feature text-feature-foreground',
  // The money card: the brand indigo in both themes (S11).
  accent: 'bg-accent-card text-accent-card-foreground',
  // The destructive block of an edit form: its text reads the danger pair.
  danger: 'bg-tint-danger text-tint-danger-foreground',
} as const;

const CARD_RADIUS = {
  card: 'rounded-card *:[img:first-child]:rounded-t-card *:[img:last-child]:rounded-b-card',
  hero: 'rounded-hero *:[img:first-child]:rounded-t-hero *:[img:last-child]:rounded-b-hero',
} as const;

function Card({
  className,
  size = 'default',
  tone = 'surface',
  radius = 'card',
  ...props
}: React.ComponentProps<'div'> & {
  size?: 'default' | 'sm';
  tone?: keyof typeof CARD_TONE;
  radius?: keyof typeof CARD_RADIUS;
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-tone={tone}
      className={cn(
        'group/card flex flex-col gap-(--card-spacing) overflow-hidden py-(--card-spacing) text-sm [--card-spacing:--spacing(6)] has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(4)]',
        CARD_RADIUS[radius],
        CARD_TONE[tone],
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'group/card-header @container/card-header grid auto-rows-min items-start gap-1.5 rounded-t-card px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)',
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('font-heading text-base font-medium', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-content" className={cn('px-(--card-spacing)', className)} {...props} />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'flex items-center rounded-b-4xl px-(--card-spacing) [.border-t]:pt-(--card-spacing)',
        className,
      )}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
