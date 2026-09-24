import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { NextLessonCard } from '@/components/shared/next-lesson-card';
import { PersonItem } from '@/components/shared/person-item';

type Args = {
  state: 'scheduled' | 'running' | 'empty' | 'loading';
  heading: string;
  relative: string;
  date: string;
  time: string;
  teacher: string;
  teacherSub: string;
  primaryLabel: string;
  secondaryLabel: string;
  emptyTitle: string;
  emptyText: string;
  emptyAction: string;
  art: 'empty' | 'pause' | 'archive';
  /** Minutes passed, for the running state. */
  elapsed: number;
  duration: number;
};

/**
 * The highlight ticket: ink in light, the saturated indigo in dark. The empty state shows either a button (`emptyAction`) or,
 * with the action left blank, one of the three illustrations. `running` is a
 * lesson under way: a live chip, the end time and a progress bar.
 */
function NextLessonCardStory(args: Args) {
  const running = args.state === 'running';
  return (
    <div className="w-105 max-w-full">
      <NextLessonCard
        heading={running ? 'Lesson in progress' : args.heading}
        loading={args.state === 'loading'}
        relative={running ? 'In progress' : args.relative}
        date={running ? 'until 18:00' : args.state === 'scheduled' ? args.date : undefined}
        time={running ? 'started at 17:00 · Speaking' : args.time}
        progress={
          running
            ? {
                value: args.elapsed,
                total: args.duration,
                start: '17:00',
                end: '18:00',
                label: `${args.elapsed} of ${args.duration} min`,
                name: 'Lesson progress',
              }
            : undefined
        }
        teacher={
          <PersonItem
            tone="ink"
            size="sm"
            media={<EntityAvatar avatarKey="user-2" fullName={args.teacher} size="sm" />}
            name={args.teacher}
            subtitle={args.teacherSub}
          />
        }
        primaryAction={<Button variant="soft">{args.primaryLabel}</Button>}
        secondaryAction={
          running ? (
            <Button variant="white">Mark attendance</Button>
          ) : (
            <Button variant="dark-outline">{args.secondaryLabel}</Button>
          )
        }
        emptyTitle={args.emptyTitle}
        emptyDescription={args.emptyText}
        emptyAction={
          args.emptyAction ? (
            <Button variant="soft" leading={<PlusIcon />}>
              {args.emptyAction}
            </Button>
          ) : undefined
        }
        art={args.art}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Cards/NextLessonCard',
  component: NextLessonCardStory,
  args: {
    state: 'scheduled',
    heading: 'Next lesson',
    relative: 'in 2 days',
    date: 'Thu, 11 Sep',
    time: '17:00 – 18:00 · Speaking',
    teacher: 'Dmytro Tutor',
    teacherSub: 'Room 2 · uses 1 credit',
    primaryLabel: 'Open lesson',
    secondaryLabel: 'Reschedule',
    emptyTitle: 'Nothing planned',
    emptyText: 'Book the next lesson so the package keeps moving.',
    emptyAction: '',
    art: 'empty',
    elapsed: 35,
    duration: 60,
  },
  argTypes: {
    state: { control: 'inline-radio', options: ['scheduled', 'running', 'empty', 'loading'] },
    elapsed: {
      control: { type: 'range', min: 0, max: 60 },
      description: 'Shown only for a running lesson.',
    },
    duration: { control: 'number', description: 'Shown only for a running lesson.' },
    art: {
      control: 'inline-radio',
      options: ['empty', 'pause', 'archive'],
      description: 'Shown only for an empty card without an action.',
    },
  },
} satisfies Meta<typeof NextLessonCardStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A lesson under way; the bar follows `elapsed`. */
export const Running: Story = {
  args: { state: 'running' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute(
      'aria-valuetext',
      '35 of 60 min',
    );
  },
};

export const OnHold: Story = {
  args: {
    state: 'empty',
    art: 'pause',
    emptyTitle: 'Lessons are paused',
    emptyText: 'The student is on a break. New lessons appear after they return.',
  },
};

export const EmptyWithAction: Story = {
  args: { state: 'empty', emptyAction: 'Schedule lesson' },
};
