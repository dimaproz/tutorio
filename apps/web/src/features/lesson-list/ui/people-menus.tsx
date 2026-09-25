'use client';

import { useState } from 'react';
import { GraduationCapIcon, LayersIcon, UsersIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EntityPicker, type EntityPickerOption } from '@/components/shared/entity-picker';
import { FilterPill } from '@/components/shared/filter-pill';
import { useGroupOptionsQuery, useStudentsQuery } from '../api';

export type TeacherOption = { id: string; fullName: string; avatarKey: string | null };

function teacherOptions(teachers: readonly TeacherOption[]): EntityPickerOption[] {
  return teachers.map((teacher) => ({
    value: teacher.id,
    label: teacher.fullName,
    avatarKey: teacher.avatarKey,
  }));
}

/**
 * «Викладач» (S04 board 05): «Усі викладачі» and each teacher with the
 * avatar; the chosen one names the pill.
 */
export function TeacherMenu({
  teachers,
  selected,
  onChange,
}: {
  teachers: readonly TeacherOption[];
  selected: string | null;
  onChange: (teacherId: string | null) => void;
}) {
  const t = useTranslations('lessonList.filters');
  const chosen = teachers.find((teacher) => teacher.id === selected);
  return (
    <EntityPicker
      aria-label={t('teacher')}
      value={selected ?? undefined}
      options={teacherOptions(teachers)}
      onChange={(next) => onChange(next ?? null)}
      clearLabel={t('allTeachers')}
      placeholder={t('teacher')}
      searchPlaceholder={t('teacherSearch')}
      emptyLabel={t('nobody')}
      trigger={
        <FilterPill
          menu
          pressed={Boolean(chosen)}
          icon={<GraduationCapIcon />}
          label={chosen ? chosen.fullName : t('teacher')}
        />
      }
    />
  );
}

/** The teacher field of the phone's filter sheet. */
export function TeacherField({
  teachers,
  selected,
  onChange,
}: {
  teachers: readonly TeacherOption[];
  selected: string | null;
  onChange: (teacherId: string | null) => void;
}) {
  const t = useTranslations('lessonList.filters');
  return (
    <EntityPicker
      aria-label={t('teacher')}
      appearance="field"
      icon={<GraduationCapIcon />}
      value={selected ?? undefined}
      options={teacherOptions(teachers)}
      onChange={(next) => onChange(next ?? null)}
      clearLabel={t('allTeachers')}
      placeholder={t('allTeachers')}
      searchPlaceholder={t('teacherSearch')}
      emptyLabel={t('nobody')}
    />
  );
}

export type WhoValue = { kind: 'student' | 'group'; id: string };

const GROUP_PREFIX = 'group:';

/**
 * The students a search finds on the server and the groups whose name
 * matches, as picker options under «Учні» and «Групи».
 */
function useWhoOptions(search: string): EntityPickerOption[] {
  const t = useTranslations('lessonList.filters');
  const query = search.trim();
  const students = useStudentsQuery({
    page: 1,
    pageSize: 6,
    search: query || undefined,
    state: 'active',
  });
  const groups = useGroupOptionsQuery();
  const needle = query.toLocaleLowerCase();
  return [
    ...(students.data?.items ?? []).map((student) => ({
      value: student.id,
      label: student.fullName,
      avatarKey: student.avatarKey,
      section: t('students'),
    })),
    ...(groups.data?.items ?? [])
      .filter((group) => !needle || group.name.toLocaleLowerCase().includes(needle))
      .slice(0, 5)
      .map((group) => ({
        value: `${GROUP_PREFIX}${group.id}`,
        label: group.name,
        section: t('groups'),
        media: (
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-item bg-tile-indigo text-tile-indigo-foreground [&_svg]:size-4"
          >
            <LayersIcon />
          </span>
        ),
      })),
  ];
}

const toValue = (who: WhoValue | null) =>
  who ? (who.kind === 'group' ? `${GROUP_PREFIX}${who.id}` : who.id) : undefined;
const fromValue = (value?: string): WhoValue | null =>
  !value
    ? null
    : value.startsWith(GROUP_PREFIX)
      ? { kind: 'group', id: value.slice(GROUP_PREFIX.length) }
      : { kind: 'student', id: value };

/**
 * «Учень або група» (S04 board 06): a search, then «Учні» and «Групи»; a
 * student's filter takes their groups' lessons too, and the list says so.
 * On the phone it is a field of the filter sheet.
 */
export function WhoPicker({
  selected,
  name,
  onChange,
  appearance = 'pill',
}: {
  selected: WhoValue | null;
  /** The chosen student's or group's name, resolved by the page. */
  name: string | null;
  /** The pick, with its name for the pill until the page reads it back. */
  onChange: (value: WhoValue | null, name: string | null) => void;
  appearance?: 'pill' | 'field';
}) {
  const t = useTranslations('lessonList.filters');
  const [search, setSearch] = useState('');
  const found = useWhoOptions(search);
  const value = toValue(selected);
  // The chosen one stays listed (and named in the field) whatever the search finds.
  const options =
    value && name && !found.some((option) => option.value === value)
      ? [
          {
            value,
            label: name,
            section: t(selected?.kind === 'group' ? 'groups' : 'students'),
          },
          ...found,
        ]
      : found;
  return (
    <EntityPicker
      aria-label={t('who')}
      value={value}
      options={options}
      onChange={(next) =>
        onChange(fromValue(next), options.find((option) => option.value === next)?.label ?? null)
      }
      onSearchChange={setSearch}
      clearLabel={selected ? t('allWho') : undefined}
      placeholder={t('allWho')}
      searchPlaceholder={t('whoSearch')}
      emptyLabel={t('nobody')}
      footer={t('whoHint')}
      contentClassName="min-w-85"
      {...(appearance === 'field'
        ? { appearance: 'field' as const, icon: <UsersIcon /> }
        : {
            trigger: (
              <FilterPill
                menu
                pressed={Boolean(selected)}
                icon={selected?.kind === 'group' ? <LayersIcon /> : <UsersIcon />}
                label={selected ? (name ?? '…') : t('who')}
              />
            ),
          })}
    />
  );
}
