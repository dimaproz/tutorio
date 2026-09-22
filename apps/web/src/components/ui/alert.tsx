import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-2xl border px-4 py-3 text-left text-sm has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 has-data-[slot=alert-action]:grid-cols-[1fr_auto] has-[>svg]:has-data-[slot=alert-action]:grid-cols-[auto_1fr_auto] *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive:
          'bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current',
        // Studio banners: a painted tint with its own foreground, 18px icon
        // and an optional inline action on the trailing edge.
        danger:
          'rounded-tile border-0 bg-tint-danger px-4 py-3.5 text-tint-danger-foreground has-[>svg]:gap-x-3 *:[svg:not([class*=size-])]:size-4.5 *:data-[slot=alert-description]:text-current',
        warning:
          'rounded-tile border-0 bg-tint-warning px-4 py-3.5 text-tint-warning-foreground has-[>svg]:gap-x-3 *:[svg:not([class*=size-])]:size-4.5 *:data-[slot=alert-description]:text-current',
        info: 'rounded-tile border-0 bg-tint-info px-4 py-3.5 text-tint-info-foreground has-[>svg]:gap-x-3 *:[svg:not([class*=size-])]:size-4.5 *:data-[slot=alert-description]:text-current',
        success:
          'rounded-tile border-0 bg-tint-success px-4 py-3.5 text-tint-success-foreground has-[>svg]:gap-x-3 *:[svg:not([class*=size-])]:size-4.5 *:data-[slot=alert-description]:text-current',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        'font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4',
        className,
      )}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-action"
      className={cn(
        'col-start-2 row-span-2 row-start-1 self-center justify-self-end group-has-[>svg]/alert:col-start-3',
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, AlertAction };
