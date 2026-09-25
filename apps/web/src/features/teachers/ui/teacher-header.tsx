'use client';

import Link from 'next/link';
import { MailIcon, PencilIcon, PhoneIcon, RotateCcwIcon, SendIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { TeacherResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { teacherColor } from '../model/presentation';
import { TEACHER_TINT, TeacherAvatar, TeacherCircles, teacherStyle } from './teacher-art';
import { TeacherSubjectChips, YouBadge, useJoinedDate } from './teacher-parts';
import { TeacherRowActions, type TeacherCommands } from './teacher-row-actions';

/**
 * One header for every width, laid out by grid areas (S09 board 02): a phone
 * stacks the avatar with ⋯, the name, the meta, the subjects, then
 * «Редагувати» stretched beside the contacts; a tablet puts the subjects, the
 * contacts, «Редагувати» and ⋯ on a second row; a desktop keeps «Редагувати»
 * and ⋯ top right with the contacts under them.
 */
const GRID = cn(
  'grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2',
  '[grid-template-areas:"avatar_menu""name_name""meta_meta""chips_chips""edit_contacts"]',
  'md:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] md:gap-x-2.5',
  'md:[grid-template-areas:"avatar_name_name_name_name""avatar_meta_meta_meta_meta""chips_chips_contacts_edit_menu"]',
  'lg:grid-cols-[auto_minmax(0,1fr)_auto_auto] lg:gap-x-6',
  'lg:[grid-template-areas:"avatar_name_edit_menu""avatar_meta_contacts_contacts""avatar_chips_contacts_contacts"]',
);

function ContactLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Button asChild variant="surface" size="icon" className="rounded-pill md:max-lg:size-9">
      <a href={href} aria-label={label}>
        {icon}
      </a>
    </Button>
  );
}

/**
 * The profile header, tinted in the teacher's colour with the background
 * circles (S09 decision 2): the ringed avatar (crown for the owner), the
 * name, who they are and since when with their calendar colour, the
 * subjects, and the commands. An archived teacher's header is grey with
 * «Відновити» as its only command.
 */
export function TeacherHeader({
  teacher,
  commands,
  restoring,
}: {
  teacher: TeacherResponse;
  commands: TeacherCommands;
  restoring: boolean;
}) {
  const t = useTranslations('teachers');
  const format = useFormatter();
  const joined = useJoinedDate();
  const color = teacherColor(teacher);
  const archived = teacher.status === 'ARCHIVED' && !teacher.isMe;
  const since =
    archived && teacher.archivedAt
      ? t('profile.archivedSince', {
          date: format.dateTime(new Date(teacher.archivedAt), { day: 'numeric', month: 'short' }),
        })
      : teacher.isMe
        ? teacher.status === 'ARCHIVED'
          ? t('profile.ownerMetaOff')
          : t('profile.ownerMeta')
        : t('teachesSince', { date: joined(teacher) });

  return (
    <section
      aria-labelledby="teacher-name"
      style={teacherStyle(archived ? 'var(--muted-foreground)' : color)}
      className={cn(
        'relative overflow-hidden rounded-hero px-5 py-5 md:px-6 md:py-6 lg:px-8 lg:py-7.5',
        TEACHER_TINT.band,
      )}
    >
      <TeacherCircles variant="heroPhone" className="right-0 opacity-55 md:hidden" />
      <TeacherCircles
        variant="heroTablet"
        className="right-10 hidden opacity-55 md:block lg:hidden"
      />
      <TeacherCircles variant="hero" className="right-35 hidden opacity-55 lg:block" />

      <div className={cn('relative items-center', GRID)}>
        <div className="[grid-area:avatar] self-start pt-2 lg:self-center lg:pt-0">
          <TeacherAvatar
            avatarKey={teacher.avatarKey}
            fullName={teacher.fullName}
            color={color}
            size="xl"
            ring="thick"
            owner={teacher.isMe}
            crownLabel={t('owner')}
            muted={archived}
            avatarClassName="max-md:size-18 md:max-lg:size-14"
          />
        </div>

        <h1
          id="teacher-name"
          className="flex min-w-0 items-center gap-3 [grid-area:name] text-[26px] leading-8 font-bold tracking-[-0.03em] md:self-end md:text-[30px] md:leading-9 lg:text-4xl lg:leading-[44px]"
        >
          <span className="min-w-0 break-words">{teacher.fullName}</span>
          {teacher.isMe ? <YouBadge /> : null}
        </h1>

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 [grid-area:meta] text-sm text-muted-foreground md:self-start md:text-[15px]">
          <span>{since}</span>
          <span aria-hidden="true" className="max-md:hidden">
            ·
          </span>
          <span className="inline-flex items-center gap-1.5 max-md:basis-full">
            <span aria-hidden="true" className="size-2.5 rounded-pill bg-(--teacher)" />
            {t('profile.color')}
          </span>
        </p>

        <TeacherSubjectChips
          subjects={teacher.subjects}
          onTint
          className="[grid-area:chips] md:self-center lg:self-start"
        />

        {archived ? (
          <div className="flex [grid-area:edit] md:justify-end">
            <Button
              type="button"
              variant="default"
              disabled={restoring}
              onClick={() => commands.onRestore(teacher)}
              className="max-md:w-full"
            >
              {restoring ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RotateCcwIcon data-icon="inline-start" />
              )}
              {t('profile.restore')}
            </Button>
          </div>
        ) : (
          <>
            <Button
              asChild
              variant="white"
              className="[grid-area:edit] max-md:w-full md:justify-self-end"
            >
              <Link href={`/app/teachers/${teacher.id}/edit`}>
                <PencilIcon data-icon="inline-start" />
                {t('profile.edit')}
              </Link>
            </Button>
            <div className="[grid-area:menu] justify-self-end">
              <TeacherRowActions
                teacher={teacher}
                commands={commands}
                busy={restoring}
                onProfile
                className="rounded-pill bg-card hover:bg-secondary md:size-11"
              />
            </div>
            <div className="flex items-center gap-2 [grid-area:contacts] justify-self-end">
              {teacher.phone ? (
                <ContactLink
                  href={`tel:${teacher.phone}`}
                  label={t('profile.call', { value: teacher.phone })}
                  icon={<PhoneIcon />}
                />
              ) : null}
              {teacher.telegramUsername ? (
                <ContactLink
                  href={`https://t.me/${teacher.telegramUsername}`}
                  label={t('profile.telegram', { value: teacher.telegramUsername })}
                  icon={<SendIcon />}
                />
              ) : null}
              {teacher.email ? (
                <ContactLink
                  href={`mailto:${teacher.email}`}
                  label={t('profile.email', { value: teacher.email })}
                  icon={<MailIcon />}
                />
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
