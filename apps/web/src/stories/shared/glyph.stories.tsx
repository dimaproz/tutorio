import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { GLYPH_NAMES, Glyph, type GlyphName } from '@/components/shared/glyph';

type Args = { name: GlyphName; size: number; strokeWidth: number };

function GlyphStory({ name, size, strokeWidth }: Args) {
  return (
    <div className="flex flex-col gap-6">
      <span style={{ width: size, height: size }} className="flex [&_svg]:size-full">
        <Glyph name={name} strokeWidth={strokeWidth} />
      </span>
      {/* The full set, labelled with the names design references use. */}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
        {GLYPH_NAMES.map((glyph) => (
          <li
            key={glyph}
            className="flex flex-col items-center gap-2 rounded-item bg-card p-3 text-xs text-muted-foreground"
          >
            <Glyph name={glyph} className="size-5 text-foreground" strokeWidth={strokeWidth} />
            {glyph}
          </li>
        ))}
      </ul>
    </div>
  );
}

const meta = {
  title: 'Shared/Base/Icon',
  component: GlyphStory,
  args: { name: 'plus', size: 18, strokeWidth: 2 },
  argTypes: {
    name: { control: 'select', options: GLYPH_NAMES },
    size: { control: { type: 'range', min: 12, max: 48, step: 2 } },
    strokeWidth: { control: { type: 'range', min: 1, max: 3, step: 0.25 } },
  },
} satisfies Meta<typeof GlyphStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
