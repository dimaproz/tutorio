import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Badge } from '@/components/ui/badge';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { MemberChargeRow, type MemberNoteTone } from '@/components/shared/member-charge-row';

type Row = {
  name: string;
  avatarKey: string | null;
  note?: { label: string; tone: MemberNoteTone };
  badge: {
    label: string;
    variant: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
    dot?: boolean;
  };
};

const HELD: Row[] = [
  {
    name: 'Anna Shevchenko',
    avatarKey: 'user-1',
    note: { label: 'Був', tone: 'success' },
    badge: { label: 'Списано · лишилось 3', variant: 'success' },
  },
  {
    name: 'Sofiia Melnyk',
    avatarKey: 'user-4',
    note: { label: 'Був', tone: 'success' },
    badge: { label: 'Списано · лишилось 1', variant: 'danger', dot: true },
  },
  {
    name: 'Maksym Tkachenko',
    avatarKey: 'user-2',
    note: { label: 'Не був', tone: 'danger' },
    badge: { label: 'Борг 400 ₴', variant: 'danger', dot: true },
  },
  {
    name: 'Daryna Kravets',
    avatarKey: 'user-6',
    note: { label: 'Поважна причина', tone: 'info' },
    badge: { label: 'Не списано', variant: 'info' },
  },
  {
    name: 'Artem Lysenko',
    avatarKey: 'user-3',
    note: { label: 'Був', tone: 'success' },
    badge: { label: 'Пакет вичерпано', variant: 'danger', dot: true },
  },
  {
    name: 'Oleksii Koval',
    avatarKey: null,
    note: { label: 'Пауза · не відмічається', tone: 'warning' },
    badge: { label: 'На паузі', variant: 'warning', dot: true },
  },
];

const BEFORE: Row[] = [
  {
    name: 'Anna Shevchenko',
    avatarKey: 'user-1',
    badge: { label: 'Пакет · 4 з 8', variant: 'neutral' },
  },
  {
    name: 'Sofiia Melnyk',
    avatarKey: 'user-4',
    note: { label: 'Пакет закінчується', tone: 'warning' },
    badge: { label: 'Пакет · 2 з 8', variant: 'warning', dot: true },
  },
  {
    name: 'Maksym Tkachenko',
    avatarKey: 'user-2',
    badge: { label: 'Разово · 400 ₴', variant: 'neutral' },
  },
  {
    name: 'Artem Lysenko',
    avatarKey: 'user-3',
    note: { label: 'Останнє заняття в пакеті', tone: 'danger' },
    badge: { label: 'Пакет · 1 з 8', variant: 'danger', dot: true },
  },
];

type Args = { moment: 'before' | 'held'; stacked: boolean };

/**
 * Group members on one lesson: the mark (or a package note) under the name and
 * the charge badge. `moment` switches between the lesson before it starts and
 * after it was held; `stacked` is the phone layout.
 */
function MemberChargeRowStory({ moment, stacked }: Args) {
  const rows = moment === 'held' ? HELD : BEFORE;
  return (
    <div className="flex w-110 max-w-full flex-col rounded-row border border-border bg-card px-4 py-2">
      {rows.map((row) => (
        <MemberChargeRow
          key={row.name}
          stacked={stacked}
          media={<EntityAvatar avatarKey={row.avatarKey} fullName={row.name} size="md" />}
          name={row.name}
          note={row.note}
          badge={
            <Badge variant={row.badge.variant} dot={row.badge.dot}>
              {row.badge.label}
            </Badge>
          }
        />
      ))}
    </div>
  );
}

const meta = {
  title: 'Shared/Lists/MemberChargeRow',
  component: MemberChargeRowStory,
  args: { moment: 'held', stacked: false },
  argTypes: { moment: { control: 'inline-radio', options: ['before', 'held'] } },
} satisfies Meta<typeof MemberChargeRowStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
