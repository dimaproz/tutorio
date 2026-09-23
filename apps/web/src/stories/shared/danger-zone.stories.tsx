import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { XIcon } from 'lucide-react';
import { expect, fn, userEvent } from 'storybook/test';
import { DangerZone } from '@/components/shared/danger-zone';

type Args = {
  title: string;
  text: string;
  action: string;
  glyph: 'archive' | 'x';
  disabled: boolean;
  onAction: () => void;
};

/**
 * The destructive block at the end of an edit form. It never sits in the
 * save bar, and a viewer who cannot perform the action gets no block at all.
 */
function DangerZoneStory({ title, text, action, glyph, disabled, onAction }: Args) {
  return (
    <div className="w-240 max-w-full">
      <DangerZone
        title={title}
        text={text}
        action={action}
        icon={glyph === 'x' ? <XIcon /> : undefined}
        disabled={disabled}
        onAction={onAction}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Form/DangerZone',
  component: DangerZoneStory,
  args: {
    title: 'Delete record',
    text: 'Iryna Shevchenko and their links to students will be erased permanently. The students’ lesson and payment history does not change.',
    action: 'Delete',
    glyph: 'archive',
    disabled: false,
    onAction: fn(),
  },
  argTypes: { glyph: { control: 'inline-radio', options: ['archive', 'x'] } },
} satisfies Meta<typeof DangerZoneStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Delete' }));
    await expect(args.onAction).toHaveBeenCalled();
  },
};
