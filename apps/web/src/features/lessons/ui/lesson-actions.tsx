'use client';

import type { ReactNode } from 'react';
import {
  CalendarClockIcon,
  CalendarPlusIcon,
  ChevronLeftIcon,
  CircleXIcon,
  ClipboardCheckIcon,
  CopyIcon,
  EllipsisIcon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
  UserXIcon,
  XIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconButton } from '@/components/shared/icon-button';
import { cn } from '@/lib/utils';
import type { FooterAction, MenuAction, PanelActions } from '../model/panel-actions';

const ICON: Record<FooterAction | MenuAction, ReactNode> = {
  move: <CalendarClockIcon />,
  cancel: <CircleXIcon />,
  fixStatus: <RotateCcwIcon />,
  makeup: <CalendarPlusIcon />,
  markAttendance: <ClipboardCheckIcon />,
  edit: <PencilIcon />,
  noShow: <UserXIcon />,
  copyLink: <CopyIcon />,
  delete: <Trash2Icon />,
};

/** The «⋯» menu: every action the footer does not carry, delete last and apart. */
function LessonMenu({
  items,
  onAction,
}: {
  items: PanelActions['menu'];
  onAction: (action: MenuAction) => void;
}) {
  const t = useTranslations('lessons');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton icon={<EllipsisIcon />} label={t('panel.more')} size={38} tone="paper" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        {items.map((item) => (
          <MenuEntry key={item.action} item={item} onAction={onAction} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuEntry({
  item,
  onAction,
}: {
  item: PanelActions['menu'][number];
  onAction: (action: MenuAction) => void;
}) {
  const t = useTranslations('lessons.actions');
  const entry = (
    <DropdownMenuItem
      disabled={item.disabled}
      variant={item.action === 'delete' ? 'destructive' : 'default'}
      onSelect={() => onAction(item.action)}
      className="items-start"
    >
      <span className="mt-0.5 flex">{ICON[item.action]}</span>
      <span className="flex flex-col gap-0.5">
        {t(item.action)}
        {item.hint ? (
          <span className="text-xs font-normal text-muted-foreground">{t(item.hint)}</span>
        ) : null}
      </span>
    </DropdownMenuItem>
  );
  if (item.action !== 'delete') return entry;
  return (
    <>
      <DropdownMenuSeparator />
      {entry}
    </>
  );
}

/**
 * The panel's top bar. Desktop: close on the left, edit and «⋯» on the right.
 * Phone: back, the centred title, edit and «⋯».
 */
export function LessonTopBar({
  mobile,
  menu,
  onClose,
  onEdit,
  onAction,
  title,
}: {
  mobile: boolean;
  menu: PanelActions['menu'] | null;
  onClose: () => void;
  onEdit?: () => void;
  onAction: (action: MenuAction) => void;
  /** The phone title, e.g. "Заняття" or "Редагування заняття". */
  title?: ReactNode;
}) {
  const t = useTranslations('lessons.panel');
  return (
    <div className="flex items-center gap-2">
      <IconButton
        icon={mobile ? <ChevronLeftIcon /> : <XIcon />}
        label={mobile ? t('back') : t('close')}
        size={38}
        tone="paper"
        onClick={onClose}
      />
      {title ? (
        <span
          className={cn(
            'min-w-0 grow truncate text-base font-semibold',
            mobile && (onEdit || menu) ? 'text-center' : 'pl-1 text-left',
          )}
        >
          {title}
        </span>
      ) : (
        <span className="grow" />
      )}
      {onEdit ? (
        <IconButton
          icon={<PencilIcon />}
          label={t('edit')}
          size={38}
          tone="paper"
          onClick={onEdit}
        />
      ) : null}
      {menu ? <LessonMenu items={menu} onAction={onAction} /> : null}
    </div>
  );
}

/** The pinned footer: at most an outline action and the one primary action. */
export function LessonFooterActions({
  actions,
  onAction,
}: {
  actions: PanelActions;
  onAction: (action: FooterAction) => void;
}) {
  const t = useTranslations('lessons.actions');
  return (
    <>
      {actions.secondary ? (
        <Button type="button" variant="outline" onClick={() => onAction(actions.secondary!)}>
          <span data-icon="inline-start" className="flex">
            {ICON[actions.secondary]}
          </span>
          {t(actions.secondary)}
        </Button>
      ) : null}
      {actions.primary ? (
        <Button type="button" onClick={() => onAction(actions.primary!)}>
          <span data-icon="inline-start" className="flex">
            {ICON[actions.primary]}
          </span>
          {t(actions.primary)}
        </Button>
      ) : null}
    </>
  );
}
