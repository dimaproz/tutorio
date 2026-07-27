'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Tabs as TabsPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

function Tabs({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn('group/tabs flex gap-2 data-horizontal:flex-col', className)}
      {...props}
    />
  );
}

// Three looks: `default` is the product filter bar — plain tabs on the page,
// the active one filled with a brand tint; `segmented` is the boxed
// grey-track switch; `line` is the underlined variant. Sizes line up with the
// button scale (xs 28 / sm 32 / default 36 / lg 44).
const tabsListVariants = cva(
  'group/tabs-list inline-flex w-fit items-center text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col group-data-vertical/tabs:items-stretch',
  {
    variants: {
      variant: {
        default: 'gap-1 rounded-lg bg-transparent',
        segmented: 'justify-center rounded-lg bg-muted p-1',
        line: 'gap-1 rounded-none bg-transparent',
      },
      size: {
        xs: 'group-data-horizontal/tabs:h-7',
        sm: 'group-data-horizontal/tabs:h-8',
        default: 'group-data-horizontal/tabs:h-9',
        lg: 'group-data-horizontal/tabs:h-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function TabsList({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      data-size={size}
      className={cn(tabsListVariants({ variant, size }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] items-center justify-center gap-2 rounded-lg border border-transparent font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // Size scale, driven by the list so every trigger stays in step.
        "group-data-[size=xs]/tabs-list:gap-1.5 group-data-[size=xs]/tabs-list:px-2 group-data-[size=xs]/tabs-list:text-xs group-data-[size=xs]/tabs-list:[&_svg:not([class*='size-'])]:size-3.5",
        'group-data-[size=sm]/tabs-list:px-2.5 group-data-[size=sm]/tabs-list:text-[0.8rem]',
        'group-data-[size=default]/tabs-list:px-3 group-data-[size=default]/tabs-list:text-sm',
        "group-data-[size=lg]/tabs-list:px-4 group-data-[size=lg]/tabs-list:text-base group-data-[size=lg]/tabs-list:[&_svg:not([class*='size-'])]:size-5",
        // Filled brand tint on the active tab — the product default.
        'group-data-[variant=default]/tabs-list:hover:bg-muted group-data-[variant=default]/tabs-list:data-active:bg-primary/10 group-data-[variant=default]/tabs-list:data-active:font-semibold group-data-[variant=default]/tabs-list:data-active:text-primary group-data-[variant=default]/tabs-list:data-active:hover:bg-primary/15',
        // Boxed switch: the active tab lifts out of the grey track.
        'group-data-[variant=segmented]/tabs-list:flex-1 group-data-[variant=segmented]/tabs-list:rounded-md group-data-[variant=segmented]/tabs-list:text-foreground group-data-[variant=segmented]/tabs-list:data-active:bg-primary group-data-[variant=segmented]/tabs-list:data-active:text-primary-foreground group-data-[variant=segmented]/tabs-list:data-active:shadow-sm',
        // Underlined: the rule under the active tab carries the state.
        'group-data-[variant=line]/tabs-list:data-active:text-foreground',
        'after:absolute after:bg-primary after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100',
        className,
      )}
      {...props}
    />
  );
}

// The count chip inside a tab: a filled circle that grows into a pill once the
// number needs two digits. `primary` unless a tab wants its own role.
const tabsBadgeVariants = cva(
  'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[0.6875rem] leading-none font-semibold tabular-nums group-data-[size=xs]/tabs-list:h-4 group-data-[size=xs]/tabs-list:min-w-4 group-data-[size=xs]/tabs-list:text-[0.625rem] group-data-[size=lg]/tabs-list:h-6 group-data-[size=lg]/tabs-list:min-w-6 group-data-[size=lg]/tabs-list:text-xs',
  {
    variants: {
      tone: {
        primary: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        success: 'bg-success text-success-foreground',
        warning: 'bg-warning text-warning-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        neutral: 'bg-muted-foreground/20 text-muted-foreground',
      },
    },
    defaultVariants: {
      tone: 'primary',
    },
  },
);

function TabsBadge({
  className,
  tone = 'primary',
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof tabsBadgeVariants>) {
  return (
    <span
      data-slot="tabs-badge"
      data-tone={tone}
      className={cn(tabsBadgeVariants({ tone }), className)}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 text-sm outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsBadge, TabsContent, tabsBadgeVariants, tabsListVariants };
