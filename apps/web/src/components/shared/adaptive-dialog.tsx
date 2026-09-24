'use client';

import type { ReactNode } from 'react';
import { XIcon } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { IconButton } from '@/components/shared/icon-button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const WIDTH_CLASS = {
  md: 'sm:max-w-120',
  lg: 'sm:max-w-150',
} as const;

function Heading({
  icon,
  iconClassName,
  title,
  description,
  mobile,
}: {
  icon?: ReactNode;
  iconClassName?: string;
  title: ReactNode;
  description?: ReactNode;
  mobile: boolean;
}) {
  const Title = mobile ? DrawerTitle : DialogTitle;
  const Description = mobile ? DrawerDescription : DialogDescription;

  return (
    <div className="flex min-w-0 grow gap-3.5 text-left">
      {icon ? (
        <span
          aria-hidden="true"
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-item [&_svg]:size-5',
            iconClassName,
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-col gap-1">
        <Title className="text-lg leading-6 font-semibold">{title}</Title>
        {description ? (
          <Description className="text-sm leading-5 text-muted-foreground">
            {description}
          </Description>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A focused decision with a few fields: a centred dialog on desktop and a
 * bottom sheet on phones, with the same heading, body and actions. The body
 * scrolls between a fixed heading and fixed actions. On the sheet the actions
 * stack full width with the primary one first, and there is no close button
 * (the handle and the secondary action close it); `closeLabel` adds the round
 * close button to the desktop heading. `size="lg"` widens the desktop dialog
 * for a list, e.g. the attendance of a group.
 */
export function AdaptiveDialog({
  open,
  onOpenChange,
  title,
  description,
  icon,
  iconClassName,
  children,
  primary,
  secondary,
  closeLabel,
  size = 'md',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** Tile colours for the icon, e.g. a warning tint. */
  iconClassName?: string;
  children?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  /** Accessible name of the desktop close button; omit for no button. */
  closeLabel?: string;
  size?: keyof typeof WIDTH_CLASS;
}) {
  const mobile = useIsMobile();

  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="px-5 pt-5 pb-0">
            <Heading
              icon={icon}
              iconClassName={iconClassName}
              title={title}
              description={description}
              mobile
            />
          </DrawerHeader>
          {children ? (
            <div className="scrollbar-thin flex min-h-0 flex-col gap-5 overflow-y-auto px-5 pt-5">
              {children}
            </div>
          ) : null}
          <DrawerFooter className="gap-2 px-5 pt-5 *:w-full">
            {primary}
            {secondary}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn('flex max-h-[calc(100dvh-2rem)] flex-col gap-5', WIDTH_CLASS[size])}
      >
        <DialogHeader className="flex-row items-start gap-3">
          <Heading
            icon={icon}
            iconClassName={iconClassName}
            title={title}
            description={description}
            mobile={false}
          />
          {closeLabel ? (
            <DialogClose asChild>
              <IconButton icon={<XIcon />} label={closeLabel} size={36} tone="paper" />
            </DialogClose>
          ) : null}
        </DialogHeader>
        {children ? (
          <div className="scrollbar-thin -mx-1 flex min-h-0 flex-col gap-5 overflow-y-auto px-1 py-0.5">
            {children}
          </div>
        ) : null}
        <DialogFooter className="gap-2.5">
          {secondary}
          {primary}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
