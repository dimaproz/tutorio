import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FilterPill } from '@/components/shared/filter-pill';
import type { GlyphName } from '@/components/shared/glyph';
import { glyphControl, glyphNode } from '../story-helpers';

type Args = {
  label: string;
  icon: GlyphName | 'none';
  dropdown: boolean;
  active: boolean;
  count: string;
  disabled: boolean;
};

function FilterPillStory({ label, icon, dropdown, active, count, disabled }: Args) {
  return (
    <FilterPill
      label={label}
      icon={glyphNode(icon)}
      menu={dropdown}
      pressed={active}
      count={count || undefined}
      disabled={disabled}
    />
  );
}

const meta = {
  title: 'Shared/Collection/FilterPill',
  component: FilterPillStory,
  args: { label: 'Group', icon: 'none', dropdown: true, active: false, count: '', disabled: false },
  argTypes: {
    icon: glyphControl,
    dropdown: { description: 'Adds the chevron of a control that opens a menu.' },
    active: { description: 'Pressed state of a toggle filter.' },
    count: { description: 'Number of selected values, drawn as an ink counter.' },
  },
} satisfies Meta<typeof FilterPillStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const LowCredits: Story = {
  args: { label: 'Low on credits', icon: 'filter', dropdown: false },
};
