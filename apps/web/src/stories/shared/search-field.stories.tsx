import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SearchField } from '@/components/shared/search-field';

type Args = { label: string; placeholder: string; shortcut: string; width: number };

function SearchFieldStory({ width, shortcut, ...props }: Args) {
  return (
    <div style={{ width }}>
      <SearchField {...props} shortcut={shortcut || undefined} />
    </div>
  );
}

const meta = {
  title: 'Shared/Collection/SearchField',
  component: SearchFieldStory,
  args: {
    label: 'Search students, lessons, payments',
    placeholder: 'Search students, lessons, payments',
    shortcut: '⌘K',
    width: 340,
  },
  argTypes: {
    width: { control: { type: 'range', min: 200, max: 480, step: 20 } },
    shortcut: { description: 'Keyboard hint on the trailing edge; empty hides it.' },
  },
} satisfies Meta<typeof SearchFieldStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
