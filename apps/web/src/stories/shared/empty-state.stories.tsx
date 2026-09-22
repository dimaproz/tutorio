import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { Glyph, type GlyphName } from '@/components/shared/glyph';
import { glyphControl } from '../story-helpers';

type Args = {
  glyph: GlyphName;
  title: string;
  text: string;
  action: string;
  framed: boolean;
  minHeight: number;
};

function EmptyStateStory({ glyph, title, text, action, framed, minHeight }: Args) {
  return (
    <div className="w-160 max-w-full rounded-card bg-card p-5">
      <EmptyState
        icon={<Glyph name={glyph} />}
        title={title}
        text={text || undefined}
        framed={framed}
        minHeight={minHeight}
        action={action ? <Button leading={<PlusIcon />}>{action}</Button> : undefined}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Feedback/EmptyState',
  component: EmptyStateStory,
  args: {
    glyph: 'cal',
    title: 'No lessons yet',
    text: 'Schedule the first lesson — it will appear here along with the attendance history.',
    action: 'Schedule lesson',
    framed: true,
    minHeight: 280,
  },
  argTypes: {
    glyph: { ...glyphControl, options: glyphControl.options.filter((name) => name !== 'none') },
    minHeight: { control: { type: 'range', min: 160, max: 560, step: 20 } },
  },
} satisfies Meta<typeof EmptyStateStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const NoPayments: Story = {
  args: {
    glyph: 'wallet',
    title: 'No payments yet',
    text: 'When the student pays for a package, it appears here.',
    action: '',
    framed: false,
  },
};
