import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ContactRow } from '@/components/shared/contact-row';
import { GLYPHS, type GlyphName } from '@/components/shared/glyph';
import { glyphControl } from '../story-helpers';

type Args = { glyph: GlyphName; value: string; mono: boolean };

function ContactRowStory({ glyph, value, mono }: Args) {
  return (
    <div className="w-80 rounded-block bg-card p-5">
      <ContactRow icon={GLYPHS[glyph]} mono={mono}>
        {value}
      </ContactRow>
    </div>
  );
}

const meta = {
  title: 'Shared/Base/ContactRow',
  component: ContactRowStory,
  args: { glyph: 'phone', value: '+380 50 111 22 33', mono: true },
  argTypes: {
    glyph: { ...glyphControl, options: glyphControl.options.filter((name) => name !== 'none') },
    mono: { description: 'Mono figures, for values read digit by digit.' },
  },
} satisfies Meta<typeof ContactRowStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
