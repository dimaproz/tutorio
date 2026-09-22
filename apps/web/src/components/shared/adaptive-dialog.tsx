'use client';

import type { ReactNode } from 'react';
import {
  Dialog,
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
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

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
    <div className="flex gap-3.5 text-left">
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
      <div className="flex flex-col gap-1">
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
 * bottom sheet on phones, with the same heading, body and actions. On the
 * sheet the actions stack full width with the primary one first.
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
          <div className="flex flex-col gap-5 px-5 pt-5">{children}</div>
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
      <DialogContent showCloseButton={false} className="gap-5 sm:max-w-120">
        <DialogHeader>
          <Heading
            icon={icon}
            iconClassName={iconClassName}
            title={title}
            description={description}
            mobile={false}
          />
        </DialogHeader>
        {children}
        <DialogFooter className="gap-2.5">
          {secondary}
          {primary}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
