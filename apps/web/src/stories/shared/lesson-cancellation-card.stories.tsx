import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CircleSlashIcon, CircleXIcon } from 'lucide-react';
import {
  LessonCancellationCard,
  type CancellationCardTone,
} from '@/components/shared/lesson-cancellation-card';

type Args = {
  tone: CancellationCardTone;
  title: string;
  reason: string;
  when: string;
  text: string;
};

/**
 * The cancellation at the top of the lesson panel. It repeats the status
 * tone and icon: `danger` with a crossed circle for a charged cancellation,
 * `warning` with a slashed circle for a free one.
 */
function LessonCancellationCardStory({ tone, title, reason, when, text }: Args) {
  return (
    <div className="w-110 max-w-full">
      <LessonCancellationCard
        tone={tone}
        icon={tone === 'danger' ? <CircleXIcon /> : <CircleSlashIcon />}
        title={title}
        reason={reason ? `«${reason}»` : undefined}
        when={when || undefined}
        text={text || undefined}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Cards/LessonCancellationCard',
  component: LessonCancellationCardStory,
  args: {
    tone: 'danger',
    title: 'Скасовано учнем пізно',
    reason: 'Захворіла',
    when: '11 вер о 14:05, за 3 год · Olena Kovalenko',
    text: 'Пізніше за дедлайн 24 год — заняття списано з пакета.',
  },
  argTypes: { tone: { control: 'inline-radio', options: ['danger', 'warning'] } },
} satisfies Meta<typeof LessonCancellationCardStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
