import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { NextLessonCard } from '@/components/shared/next-lesson-card';
import { PersonItem } from '@/components/shared/person-item';

type Args = {
  state: 'scheduled' | 'empty' | 'loading';
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
};

/**
 * The highlight ticket: ink in light, the saturated indigo in dark. The empty state shows either a button (`emptyAction`) or,
 * with the action left blank, one of the three illustrations.
 */
function NextLessonCardStory(args: Args) {
  return (
    <div className="w-105 max-w-full">
      <NextLessonCard
        heading={args.heading}
        loading={args.state === 'loading'}
        relative={args.relative}
        date={args.state === 'scheduled' ? args.date : undefined}
        time={args.time}
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
        secondaryAction={<Button variant="dark-outline">{args.secondaryLabel}</Button>}
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
  },
  argTypes: {
    state: { control: 'inline-radio', options: ['scheduled', 'empty', 'loading'] },
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
