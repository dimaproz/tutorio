import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CircleSlashIcon, ClipboardCheckIcon, ClockIcon, PencilIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttendanceSummaryCard } from '@/components/shared/attendance-summary-card';

type State = 'afterStart' | 'notMarked' | 'marked' | 'noMarks' | 'cancelled';
type Args = { state: State; present: number; absent: number; excused: number; paused: number };

/**
 * Who came to a group lesson, as the lesson panel shows it in each state:
 * before the start, running (not marked yet), marked, held without marks, and
 * cancelled. A zero tile fades.
 */
function AttendanceSummaryCardStory({ state, present, absent, excused, paused }: Args) {
  const tiles = [
    { id: 'present', label: 'Були', count: present, tone: 'success' as const },
    { id: 'absent', label: 'Не був', count: absent, tone: 'danger' as const },
    { id: 'excused', label: 'Поважна', count: excused, tone: 'info' as const },
    { id: 'paused', label: 'Пауза', count: paused, tone: 'warning' as const },
  ];
  const change = (
    <Button type="button" variant="white" size="xs">
      <PencilIcon data-icon="inline-start" />
      Змінити
    </Button>
  );
  const card = {
    afterStart: (
      <AttendanceSummaryCard
        tone="plain"
        icon={<ClockIcon />}
        title="Присутність — після початку"
        text="Якщо нічого не відмітити, усі активні учасники вважатимуться присутніми й будуть списані."
      />
    ),
    notMarked: (
      <AttendanceSummaryCard
        tone="indigo"
        label="Присутність"
        title="Ще не відмічено"
        action={
          <Button type="button" variant="white" size="xs">
            <ClipboardCheckIcon data-icon="inline-start" />
            Відмітити
          </Button>
        }
        text="Заняття йде з 18:00. Без відміток після завершення всі 5 активних учасників вважатимуться присутніми."
      />
    ),
    marked: (
      <AttendanceSummaryCard
        tone="indigo"
        label="Присутність"
        title="Відмічено"
        action={change}
        tiles={tiles}
        note="Списано з 4 учасників · Olena Kovalenko, 19:45"
      />
    ),
    noMarks: (
      <AttendanceSummaryCard
        tone="indigo"
        label="Присутність"
        title="Без відміток"
        action={change}
        tiles={tiles}
        note="Відміток не було — усі активні враховані як присутні"
      />
    ),
    cancelled: (
      <AttendanceSummaryCard
        tone="plain"
        icon={<CircleSlashIcon />}
        title="Присутність не ведеться"
        text="Заняття скасоване — нікого не списано."
      />
    ),
  }[state];

  return <div className="w-110 max-w-full">{card}</div>;
}

const meta = {
  title: 'Shared/Cards/AttendanceSummaryCard',
  component: AttendanceSummaryCardStory,
  args: { state: 'marked', present: 3, absent: 1, excused: 1, paused: 1 },
  argTypes: {
    state: {
      control: 'select',
      options: ['afterStart', 'notMarked', 'marked', 'noMarks', 'cancelled'],
    },
    present: { control: { type: 'range', min: 0, max: 12 } },
    absent: { control: { type: 'range', min: 0, max: 12 } },
    excused: { control: { type: 'range', min: 0, max: 12 } },
    paused: { control: { type: 'range', min: 0, max: 12 } },
  },
} satisfies Meta<typeof AttendanceSummaryCardStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
