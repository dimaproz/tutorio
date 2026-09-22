import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { IconButton } from '@/components/shared/icon-button';
import { Glyph, type GlyphName } from '@/components/shared/glyph';
import { glyphControl } from '../story-helpers';

type Args = {
  glyph: GlyphName;
  label: string;
  size: 44 | 38 | 36 | 32;
  tone: 'surface' | 'paper' | 'ghost' | 'translucent';
  border: boolean;
  indicator: boolean;
  disabled: boolean;
};

function IconButtonStory({ glyph, ...props }: Args) {
  // Every tone sits on the ground it was designed for.
  const ground =
    props.tone === 'surface'
      ? 'bg-background'
      : props.tone === 'translucent'
        ? 'bg-tint-sky'
        : 'bg-card';
  return (
    <div className={`w-fit rounded-block p-5 ${ground}`}>
      <IconButton icon={<Glyph name={glyph} />} {...props} />
    </div>
  );
}

const meta = {
  title: 'Shared/Base/IconButton',
  component: IconButtonStory,
  args: {
    glyph: 'phone',
    label: 'Call +380 50 111 22 33',
    size: 44,
    tone: 'surface',
    border: false,
    indicator: false,
    disabled: false,
  },
  argTypes: {
    glyph: { ...glyphControl, options: glyphControl.options.filter((name) => name !== 'none') },
    size: { control: 'inline-radio', options: [44, 38, 36, 32] },
    tone: { control: 'inline-radio', options: ['surface', 'paper', 'ghost', 'translucent'] },
    label: { description: 'Required accessible name: the glyph is never announced.' },
  },
} satisfies Meta<typeof IconButtonStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Notifications: Story = {
  args: { glyph: 'bell', label: 'Notifications', border: true, indicator: true },
};
