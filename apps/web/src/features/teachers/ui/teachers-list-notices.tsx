'use client';

import Link from 'next/link';
import {
  ArchiveIcon,
  Building2Icon,
  GraduationCapIcon,
  PlusIcon,
  SearchXIcon,
  UserRoundIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TeacherListItem } from '@tutorio/validation';
import { EmptyState } from '@/components/shared/empty-state';
import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { Spinner } from '@/components/ui/spinner';
import { teacherColor } from '../model/presentation';
import { TeacherAvatar } from './teacher-art';
import { YouBadge } from './teacher-parts';

/**
 * The owner who turned teaching off, above the list (S09 board 01-03): who
 * they are, that they are not in the teacher picker, and «Я теж викладаю».
 */
export function NotTeachingRow({
  me,
  busy,
  onTeach,
}: {
  me: TeacherListItem;
  busy: boolean;
  onTeach: () => void;
}) {
  const t = useTranslations('teachers');
  return (
    <Card size="sm" className="py-0">
      <Item className="flex-nowrap max-md:flex-wrap">
        <ItemMedia>
          <TeacherAvatar
            avatarKey={me.avatarKey}
            fullName={me.fullName}
            color={teacherColor(me)}
            owner
            crownLabel={t('owner')}
          />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="text-[15px]">
            <Link prefetch={false} href={`/app/teachers/${me.id}`} className="truncate">
              {me.fullName}
            </Link>
            <YouBadge />
          </ItemTitle>
          <ItemDescription>
            <span className="md:hidden">{t('notTeaching.short')}</span>
            <span className="max-md:hidden">{t('notTeaching.text')}</span>
          </ItemDescription>
        </ItemContent>
        <ItemActions className="max-md:w-full">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onTeach}
            className="max-md:w-full"
          >
            {busy ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <GraduationCapIcon data-icon="inline-start" />
            )}
            {t('notTeaching.action')}
          </Button>
        </ItemActions>
      </Item>
    </Card>
  );
}

/** Under the owner's only row (S09 board 01-05): invite colleagues. */
export function OnlyYouCard() {
  const t = useTranslations('teachers');
  return (
    <Card>
      <Item className="px-6 py-0 max-md:flex-wrap">
        <ItemMedia
          variant="icon"
          className="size-14 rounded-tile bg-tile-indigo text-tile-indigo-foreground [&_svg]:size-6"
        >
          <GraduationCapIcon />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="text-[17px]">{t('onlyYou.title')}</ItemTitle>
          <ItemDescription className="line-clamp-none text-[15px]">
            {t('onlyYou.text')}
          </ItemDescription>
        </ItemContent>
        <ItemActions className="max-md:w-full">
          <Button asChild size="lg" className="max-md:w-full">
            <Link href="/app/teachers/new">
              <PlusIcon data-icon="inline-start" />
              {t('add')}
            </Link>
          </Button>
        </ItemActions>
      </Item>
    </Card>
  );
}

/** Tutor mode (S09 board 01-06): one teacher, and the way to a studio. */
export function SoloNotice({ busy, onSwitch }: { busy: boolean; onSwitch: () => void }) {
  const t = useTranslations('teachers.solo');
  return (
    <Notice
      tone="indigo"
      appearance="callout"
      icon={<UserRoundIcon />}
      title={t('title')}
      text={t('text')}
      actionPlacement="stacked"
      action={
        <Button type="button" variant="white" disabled={busy} onClick={onSwitch}>
          {busy ? <Spinner data-icon="inline-start" /> : <Building2Icon data-icon="inline-start" />}
          {t('action')}
        </Button>
      }
    />
  );
}

/** Nothing to show: no match for the search or the subject, or an empty archive. */
export function TeachersEmptyState({
  search,
  subject,
  archive,
  onClearSearch,
  onResetSubject,
}: {
  search?: string;
  subject?: string;
  archive: boolean;
  onClearSearch: () => void;
  onResetSubject: () => void;
}) {
  const t = useTranslations('teachers.empty');
  if (search) {
    return (
      <EmptyState
        framed
        icon={<SearchXIcon />}
        title={t('searchTitle')}
        text={t('searchText')}
        action={
          <Button type="button" variant="outline" onClick={onClearSearch}>
            {t('clearSearch')}
          </Button>
        }
      />
    );
  }
  if (subject) {
    return (
      <EmptyState
        framed
        icon={<SearchXIcon />}
        title={t('filteredTitle')}
        text={t('filteredText')}
        action={
          <Button type="button" variant="outline" onClick={onResetSubject}>
            {t('reset')}
          </Button>
        }
      />
    );
  }
  return (
    <EmptyState
      framed
      icon={<ArchiveIcon />}
      title={archive ? t('archiveTitle') : t('searchTitle')}
      text={archive ? t('archiveText') : undefined}
    />
  );
}
