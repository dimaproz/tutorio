'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  MailIcon,
  MoreVerticalIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  SendIcon,
  XIcon,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ParentDetail } from '@tutorio/validation';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { ProfileHero } from '@/components/shared/profile-hero';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { telegramHandle } from '@/features/parents/model/presentation';
import { useParentRoleLine } from './parent-row-cells';

/**
 * The parent's identity block. Parents have no lifecycle, so there is no
 * status control: the hero links a student, edits the record, and — for the
 * owner only — carries the permanent delete in its `…` menu.
 */
export function ParentProfileHero({
  parent,
  onLink,
  linkDisabled = false,
  canDelete,
  onDelete,
}: {
  parent: ParentDetail;
  onLink: () => void;
  linkDisabled?: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const t = useTranslations('parents');
  const format = useFormatter();
  const role = useParentRoleLine(parent.students);
  const handle = telegramHandle(parent.telegramUsername);

  const meta = [
    parent.students.length > 0 ? role : t('noStudents'),
    parent.students.length > 1 ? t('studentsCount', { count: parent.students.length }) : null,
  ].filter((item): item is string => Boolean(item));

  const contact = (href: string, label: string, icon: ReactNode, external = false) => (
    <Button asChild variant="white" size="icon" aria-label={label}>
      <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
        {icon}
      </a>
    </Button>
  );
  const contacts =
    parent.phone || handle || parent.email ? (
      <>
        {parent.phone
          ? contact(`tel:${parent.phone}`, t('callName', { name: parent.fullName }), <PhoneIcon />)
          : null}
        {handle
          ? contact(
              `https://t.me/${handle}`,
              t('messageName', { name: parent.fullName }),
              <SendIcon />,
              true,
            )
          : null}
        {parent.email
          ? contact(
              `mailto:${parent.email}`,
              t('emailName', { name: parent.fullName }),
              <MailIcon />,
            )
          : null}
      </>
    ) : undefined;

  return (
    <ProfileHero
      avatar={
        <EntityAvatar
          avatarKey={parent.avatarKey}
          fullName={parent.fullName}
          size="2xl"
          ring="hero"
          tint="surface"
        />
      }
      badges={
        <Badge variant="on-tint" size="lg">
          {t('detail.addedOn', {
            date: format.dateTime(new Date(parent.createdAt), {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
          })}
        </Badge>
      }
      name={parent.fullName}
      meta={meta}
      contacts={contacts}
      primaryAction={
        <Button type="button" leading={<PlusIcon />} disabled={linkDisabled} onClick={onLink}>
          {t('detail.linkStudent')}
        </Button>
      }
      actions={
        <Button asChild variant="white">
          <Link href={`/app/parents/${parent.id}/edit`}>
            <PencilIcon data-icon="inline-start" />
            {t('detail.edit')}
          </Link>
        </Button>
      }
      menu={
        canDelete ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="translucent"
                size="icon-sm"
                aria-label={t('detail.recordActions')}
              >
                <MoreVerticalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  <XIcon data-icon />
                  {t('detail.delete')}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : undefined
      }
    />
  );
}
