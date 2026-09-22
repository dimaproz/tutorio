import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MoreHorizontalIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { IconButton } from '@/components/shared/icon-button';
import { LessonItem } from '@/components/shared/lesson-item';

const TONES = ['success', 'warning', 'danger', 'info', 'indigo', 'neutral', 'brand'] as const;

type Args = {
  dow: string;
  day: string;
  title: string;
  meta: string;
  status: string;
  statusTone: (typeof TONES)[number];
  state: 'default' | 'next' | 'past';
};

function LessonItemStory({ dow, day, title, meta, status, statusTone, state }: Args) {
  return (
    <div className="w-170 max-w-full rounded-card bg-card p-2">
      <LessonItem
        state={state}
        date={{ top: dow, day }}
        title={title}
        meta={meta}
        status={<Badge variant={statusTone}>{status}</Badge>}
        actions={
          <IconButton tone="ghost" size={36} icon={<MoreHorizontalIcon />} label="Lesson actions" />
        }
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Lists/LessonItem',
  component: LessonItemStory,
  args: {
    dow: 'Thu',
    day: '11',
    title: 'Speaking practice',
    meta: 'Sep · 17:00 – 18:00 · Dmytro Tutor',
    status: 'Scheduled',
    statusTone: 'info',
    state: 'default',
  },
  argTypes: {
    statusTone: { control: 'select', options: TONES },
    state: { control: 'inline-radio', options: ['default', 'next', 'past'] },
  },
} satisfies Meta<typeof LessonItemStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Next: Story = { args: { state: 'next', status: 'Next', statusTone: 'brand' } };
