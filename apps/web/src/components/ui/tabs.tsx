'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import { Tabs as TabsPrimitive } from 'radix-ui';

function Tabs({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn('group/tabs flex gap-2 data-horizontal:flex-col', className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  'group/tabs-list inline-flex w-fit items-center justify-center rounded-full p-1 text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col group-data-vertical/tabs:rounded-2xl data-[variant=line]:rounded-none',
  {
    variants: {
      variant: {
        default: 'bg-muted group-data-horizontal/tabs:h-9',
        line: 'gap-1 bg-transparent group-data-horizontal/tabs:h-9',
        /** Filter and section switcher: a white pill container on paper. */
        segmented: 'gap-0.5 border border-border bg-card group-data-horizontal/tabs:h-11',
        /** The same control on a white surface, where an outline would fight. */
        'segmented-subtle': 'gap-0.5 bg-background group-data-horizontal/tabs:h-[42px]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function TabsList({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  count,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & {
  /** Result count shown beside the label, in mono figures. */
  count?: React.ReactNode;
}) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-2 rounded-full border border-transparent! px-3 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start group-data-vertical/tabs:rounded-2xl group-data-vertical/tabs:px-3 group-data-vertical/tabs:py-1.5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        'group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent',
        'data-active:bg-card data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground',
        // The count dims only on the filled segment, where 70% still clears AA.
        'data-active:[&_[data-slot=tabs-trigger-count]]:opacity-70',
        // Segmented control: ink fill on the selected segment, sized to content.
        'group-data-[variant=segmented]/tabs-list:h-9 group-data-[variant=segmented]/tabs-list:flex-none group-data-[variant=segmented]/tabs-list:px-3.5 group-data-[variant=segmented]/tabs-list:data-active:bg-primary group-data-[variant=segmented]/tabs-list:data-active:text-primary-foreground group-data-[variant=segmented]/tabs-list:not-data-active:hover:bg-foreground/5 group-data-[variant=segmented]/tabs-list:not-data-active:hover:text-foreground',
        'group-data-[variant=segmented-subtle]/tabs-list:h-8.5 group-data-[variant=segmented-subtle]/tabs-list:flex-none group-data-[variant=segmented-subtle]/tabs-list:px-3.5 group-data-[variant=segmented-subtle]/tabs-list:text-[13px] group-data-[variant=segmented-subtle]/tabs-list:data-active:bg-primary group-data-[variant=segmented-subtle]/tabs-list:data-active:text-primary-foreground group-data-[variant=segmented-subtle]/tabs-list:not-data-active:hover:bg-foreground/5 group-data-[variant=segmented-subtle]/tabs-list:not-data-active:hover:text-foreground',
        'after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100',
        className,
      )}
      {...props}
    >
      {count == null ? (
        children
      ) : (
        <>
          {children}
          <span data-slot="tabs-trigger-count" className="font-mono text-xs">
            {count}
          </span>
        </>
      )}
    </TabsPrimitive.Trigger>
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

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
