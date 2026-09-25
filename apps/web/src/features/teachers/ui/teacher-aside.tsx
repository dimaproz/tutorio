'use client';

import { ChevronDownIcon, GraduationCapIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { TeacherResponse, TeacherStudent } from '@tutorio/validation';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { NotesCard } from '@/components/shared/notes-card';
import { PersonItem } from '@/components/shared/person-item';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { errorMessageKey } from '@/lib/api/error-message';
import { useUpdateTeacherMutation } from '@/lib/api/teachers';
import type { GatewayError } from '@/lib/auth/client';
import { TEACHER_NOTES_MAX } from '../model/form';

/**
 * «Учні» on the profile: each with the level and how they study with the
 * teacher — «B1 · індивідуально · English», «A2 · група Kids A2»; no package
 * information (S09 decision 3). A scroll region with «Показати ще».
 */
export function TeacherStudentsCard({
  students,
  total,
  loading,
  moreStep,
  onMore,
}: {
  students: TeacherStudent[];
  total: number;
  loading: boolean;
  moreStep: number;
  onMore: () => void;
}) {
  const t = useTranslations('teachers.profile.students');
  const line = (student: TeacherStudent) =>
    [
      student.languageLevel,
      ...(student.individual ? [t('individual'), student.subject].filter(Boolean) : []),
      ...student.groups.map((group) => t('group', { name: group.name })),
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <Card role="region" aria-label={t('titlePlain')} className="gap-4">
      <CardHeader>
        <CardTitle className="text-lg">
          {loading ? t('titlePlain') : t('title', { count: total })}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loading ? (
          <Skeleton className="h-48 w-full rounded-tile" />
        ) : students.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <>
            <ul className="scrollbar-thin -mx-1 flex max-h-75 flex-col gap-1 overflow-y-auto px-1">
              {students.map((student) => (
                <li key={student.id}>
                  <PersonItem
                    href={`/app/students/${student.id}`}
                    media={
                      <EntityAvatar
                        avatarKey={student.avatarKey}
                        fullName={student.fullName}
                        size="sm"
                      />
                    }
                    name={student.fullName}
                    subtitle={line(student)}
                  />
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
              <span>{t('showing', { shown: students.length, total })}</span>
              {total > students.length ? (
                <Button type="button" variant="ghost" size="sm" onClick={onMore}>
                  <ChevronDownIcon data-icon="inline-start" />
                  {t('more', { count: Math.min(total - students.length, moreStep) })}
                </Button>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The owner's «Викладання» (S09 board 02-03): «Я викладаю». Turning it off
 * opens the same consequences as an archive; turning it on restores at once.
 */
export function TeacherTeachingCard({
  teaching,
  busy,
  onChange,
}: {
  teaching: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
}) {
  const t = useTranslations('teachers.profile.teaching');
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-lg">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <label className="flex items-center gap-3 rounded-tile bg-background px-4 py-3.5">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-control bg-tile-indigo text-tile-indigo-foreground [&_svg]:size-4.5"
          >
            <GraduationCapIcon />
          </span>
          <span className="flex min-w-0 grow flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{t('switch')}</span>
            <span className="text-[13px] text-muted-foreground">
              {teaching ? t('on') : t('off')}
            </span>
          </span>
          <Switch checked={teaching} disabled={busy} onCheckedChange={onChange} />
        </label>
        <p className="text-[13px] text-muted-foreground">{t('note')}</p>
      </CardContent>
    </Card>
  );
}

/** The tutor's notes about a teacher, on the shared `NotesCard`. */
export function TeacherNotesCard({
  teacher,
  readOnly,
}: {
  teacher: TeacherResponse;
  readOnly: boolean;
}) {
  const t = useTranslations('teachers.profile.notes');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  const update = useUpdateTeacherMutation(teacher.id);

  return (
    <NotesCard
      notes={teacher.notes}
      updatedLabel={t('updated', {
        date: format.dateTime(new Date(teacher.updatedAt), { day: 'numeric', month: 'short' }),
      })}
      labels={{
        title: t('title'),
        edit: t('edit'),
        add: t('add'),
        empty: t('empty'),
        placeholder: t('placeholder'),
        save: tCommon('save'),
        cancel: tCommon('cancel'),
      }}
      maxLength={TEACHER_NOTES_MAX}
      readOnly={readOnly}
      pending={update.isPending}
      onSave={async (notes) => {
        try {
          await update.mutateAsync({ notes });
          toast.success(t('saved'));
          return true;
        } catch (error) {
          toast.error(tErrors(errorMessageKey(error as GatewayError)));
          return false;
        }
      }}
    />
  );
}
