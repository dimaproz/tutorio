import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useFormatter, useTranslations } from 'next-intl';
import { DEFAULT_TIME_ZONE, zonedDayStart } from '@/lib/datetime';
import {
  BanknoteIcon,
  HourglassIcon,
  PauseIcon,
  PlusIcon,
  RepeatIcon,
  UserRoundIcon,
  UsersIcon,
} from 'lucide-react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditMeter } from '@/components/shared/credit-meter';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { FieldNote } from '@/components/shared/field-note';
import { TintBand } from '@/components/shared/tint-band';
import {
  AvatarStack,
  WhoCard,
  WhoChip,
  WhoEmptyCard,
  WhoSearch,
  WhoTiles,
  type WhoSearchItem,
} from '@/components/shared/who-picker';
import { useSlotsLabel } from '@/features/lessons/ui/field-labels';

const STATES = [
  'empty',
  'search',
  'searchQuery',
  'notFound',
  'pickedPackage',
  'runningOut',
  'noPackage',
  'paused',
  'error',
  'groupEmpty',
  'groupSearch',
  'groupPicked',
  'locked',
] as const;
type State = (typeof STATES)[number];

type Args = { state: State };

const GROUP_MEMBERS = [
  { id: '1', fullName: 'Anna Shevchenko', avatarKey: 'user-1' },
  { id: '2', fullName: 'Sofiia Melnyk', avatarKey: 'user-4' },
  { id: '3', fullName: 'Maksym Tkachenko', avatarKey: 'user-2' },
];

/**
 * Who the lesson is for, in the indigo band of the lesson form (board
 * FieldsWho), in scenario order: nothing picked → the search (recent, a
 * query, nobody found) → a picked student with a package, one running out,
 * without a package, on pause → the error; then the group states and the
 * locked card of the edit form.
 */
function WhoPickerStory({ state }: Args) {
  const t = useTranslations('lessons.create');
  const tLevel = useTranslations('languageLevel');
  const tValidation = useTranslations('validation');
  const format = useFormatter();
  const slots = useSlotsLabel();
  const pauseEnd = zonedDayStart('2026-10-12', DEFAULT_TIME_ZONE);
  const pausedShort = format.dateTime(pauseEnd, { day: 'numeric', month: 'short' });
  const pausedLong = format.dateTime(pauseEnd, { day: 'numeric', month: 'long' });
  const groupSchedule = slots([
    { weekday: 2, localTime: '18:00' },
    { weekday: 4, localTime: '18:00' },
  ])!;
  const group = state.startsWith('group');
  const [kind, setKind] = useState<'student' | 'group'>(group ? 'group' : 'student');
  const [query, setQuery] = useState(
    state === 'searchQuery' ? 'So' : state === 'notFound' ? 'Olga' : '',
  );

  const students: WhoSearchItem[] = [
    {
      value: 'anna',
      title: 'Anna Shevchenko',
      subtitle: t('studentMeta', { level: 'B2', teacher: 'Dmytro Tutor' }),
      media: <EntityAvatar avatarKey="user-1" fullName="Anna Shevchenko" size="sm" />,
      trail: <Badge variant="neutral">{t('badgePackage', { left: 5, total: 8 })}</Badge>,
    },
    {
      value: 'sofiia',
      title: 'Sofiia Melnyk',
      subtitle: t('studentMeta', { level: 'B1', teacher: 'Dmytro Tutor' }),
      media: <EntityAvatar avatarKey="user-4" fullName="Sofiia Melnyk" size="sm" />,
      trail: (
        <Badge variant="warning" dot>
          {t('badgePackage', { left: 2, total: 8 })}
        </Badge>
      ),
    },
    {
      value: 'maksym',
      title: 'Maksym Tkachenko',
      subtitle: t('studentMeta', { level: 'A2', teacher: 'Iryna Bondar' }),
      media: <EntityAvatar avatarKey="user-2" fullName="Maksym Tkachenko" size="sm" />,
      trail: <Badge variant="neutral">{t('badgeOneOff', { price: '400 ₴' })}</Badge>,
    },
    {
      value: 'oleksii',
      title: 'Oleksii Koval',
      subtitle: t('studentMeta', { level: 'B1', teacher: 'Dmytro Tutor' }),
      media: <EntityAvatar fullName="Oleksii Koval" size="sm" />,
      trail: (
        <Badge variant="warning" dot>
          {t('badgePaused', { date: pausedShort })}
        </Badge>
      ),
      muted: true,
    },
  ];
  const groups: WhoSearchItem[] = [
    {
      value: 'b2',
      title: 'B2 prep · evening',
      subtitle: t('groupRow', { schedule: groupSchedule, count: 6 }),
      media: <AvatarStack people={GROUP_MEMBERS} max={3} size="xs" />,
    },
    {
      value: 'b1',
      title: 'B1 English',
      subtitle: t('groupRow', {
        schedule: slots([
          { weekday: 1, localTime: '18:30' },
          { weekday: 3, localTime: '18:30' },
        ])!,
        count: 5,
      }),
      media: <AvatarStack people={GROUP_MEMBERS.slice(1)} max={3} size="xs" />,
    },
  ];

  const tiles = (
    <WhoTiles
      label={t('whoLabel')}
      value={kind}
      onValueChange={setKind}
      options={[
        { value: 'student', title: t('student'), hint: t('studentHint'), icon: <UserRoundIcon /> },
        { value: 'group', title: t('group'), hint: t('groupHint'), icon: <UsersIcon /> },
      ]}
    />
  );
  const change = (
    <Button type="button" variant="outline" size="sm">
      {t('change')}
    </Button>
  );
  const anna = <EntityAvatar avatarKey="user-1" fullName="Anna Shevchenko" size="lg" />;
  const annaMeta = t('studentMeta', { level: tLevel('B2'), teacher: 'Dmytro Tutor' });
  const schedule = (
    <WhoChip icon={<RepeatIcon />}>
      {slots(
        [
          { weekday: 1, localTime: '17:00' },
          { weekday: 5, localTime: '17:00' },
        ],
        { short: true },
      )}
    </WhoChip>
  );
  const packagePill = (left: number) => (
    <span className="inline-flex h-6.5 items-center rounded-pill bg-background px-2.5">
      <CreditMeter
        inline
        left={left}
        total={8}
        lowThreshold={1}
        label={t('chipPackage', { left, total: 8 })}
      />
    </span>
  );

  const body = (() => {
    switch (state) {
      case 'empty':
      case 'error':
        return (
          <WhoEmptyCard
            title={t('pickStudent')}
            hint={t('pickStudentHint', { count: 42 })}
            error={state === 'error' ? tValidation('lessonStudentRequired') : undefined}
            onOpen={() => undefined}
          />
        );
      case 'groupEmpty':
        return (
          <WhoEmptyCard
            title={t('pickGroup')}
            hint={t('pickGroupHint', { count: 6 })}
            onOpen={() => undefined}
          />
        );
      case 'search':
      case 'searchQuery':
      case 'notFound':
      case 'groupSearch': {
        const pool = state === 'groupSearch' ? groups : students;
        const items = query
          ? pool.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
          : pool;
        return (
          <div className="min-h-100">
            <WhoSearch
              query={query}
              onQueryChange={setQuery}
              items={items}
              onSelect={() => undefined}
              onClose={() => undefined}
              labels={{
                placeholder: state === 'groupSearch' ? t('searchGroup') : t('searchStudent'),
                heading:
                  state === 'groupSearch'
                    ? t('headingGroups')
                    : query
                      ? t('headingFound')
                      : t('headingStudents'),
                clear: t('clear'),
                close: t('closeSearch'),
                escape: t('escape'),
                emptyTitle: t('emptyTitle', { query }),
                emptyText: t('emptyText'),
              }}
              footer={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-brand"
                >
                  <PlusIcon data-icon="inline-start" />
                  {state === 'groupSearch'
                    ? t('newGroup')
                    : items.length === 0
                      ? t('newStudentNamed', { name: query })
                      : t('newStudent')}
                </Button>
              }
            />
          </div>
        );
      }
      case 'pickedPackage':
        return (
          <WhoCard
            media={anna}
            name="Anna Shevchenko"
            meta={annaMeta}
            chips={
              <>
                {packagePill(5)}
                {schedule}
              </>
            }
            action={change}
          />
        );
      case 'runningOut':
        return (
          <>
            <WhoCard
              media={anna}
              name="Anna Shevchenko"
              meta={annaMeta}
              chips={
                <>
                  {packagePill(1)}
                  {schedule}
                </>
              }
              action={change}
            />
            <FieldNote tone="brand" icon={<HourglassIcon />}>
              {t('noteRunningOut', { covered: 1, price: '500 ₴' })}
            </FieldNote>
          </>
        );
      case 'noPackage':
        return (
          <>
            <WhoCard
              media={anna}
              name="Anna Shevchenko"
              meta={annaMeta}
              chips={
                <>
                  <Badge variant="indigo">{t('chipNoPackage')}</Badge>
                  <Badge variant="indigo">{t('chipOneOff', { price: '500 ₴' })}</Badge>
                </>
              }
              action={change}
            />
            <FieldNote tone="brand" icon={<BanknoteIcon />}>
              {t('noteNoPackage')}
            </FieldNote>
          </>
        );
      case 'paused':
        return (
          <>
            <WhoCard
              media={<EntityAvatar fullName="Oleksii Koval" size="lg" />}
              name="Oleksii Koval"
              meta={t('studentMeta', { level: tLevel('B2'), teacher: 'Dmytro Tutor' })}
              chips={
                <Badge variant="warning" dot>
                  {t('chipPaused', { date: pausedLong })}
                </Badge>
              }
              action={change}
            />
            <FieldNote tone="brand" icon={<PauseIcon />}>
              {t('notePaused', { name: 'Oleksii' })}
            </FieldNote>
          </>
        );
      case 'groupPicked':
        return (
          <WhoCard
            media={<AvatarStack people={GROUP_MEMBERS} max={3} size="md" />}
            name="B2 prep · evening"
            meta={t('groupMeta', { schedule: groupSchedule, teacher: 'Dmytro Tutor' })}
            chips={
              <>
                <Badge variant="indigo" aria-label={t('chipMembers', { count: 6 })}>
                  <UsersIcon data-icon="inline-start" />6
                </Badge>
                <Badge variant="warning" dot>
                  {t('chipPausedMembers', { count: 1 })}
                </Badge>
                <Badge variant="indigo">{t('chipPerMember', { price: '400 ₴' })}</Badge>
              </>
            }
            action={change}
          />
        );
      case 'locked':
        return (
          <WhoCard
            media={anna}
            name="Anna Shevchenko"
            meta={annaMeta}
            chips={
              <>
                {packagePill(5)}
                {schedule}
              </>
            }
            locked
            lockLabel={t('lockedStudent')}
          />
        );
    }
  })();

  return (
    <div className="w-160 max-w-full overflow-hidden rounded-hero">
      <TintBand>
        {state === 'locked' ? null : tiles}
        {body}
      </TintBand>
    </div>
  );
}

const meta = {
  title: 'Shared/Form/WhoPicker',
  component: WhoPickerStory,
  args: { state: 'pickedPackage' },
  argTypes: { state: { control: 'select', options: STATES } },
} satisfies Meta<typeof WhoPickerStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The search lists the students; typing narrows the list to the matches. */
export const Search: Story = {
  args: { state: 'search' },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const input = await body.findByRole('combobox', { name: 'Name, phone or @telegram' });
    const anna = await body.findByRole('option', { name: /Anna Shevchenko/ });
    // The list fades in with its popover.
    await waitFor(() => expect(anna).toBeVisible());
    await userEvent.type(input, 'Sof');
    await expect(body.queryByRole('option', { name: /Anna Shevchenko/ })).toBeNull();
    await expect(body.getByRole('option', { name: /Sofiia Melnyk/ })).toBeVisible();
  },
};
