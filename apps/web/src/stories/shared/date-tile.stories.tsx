import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DateTile } from '@/components/shared/date-tile';

const meta = {
  title: 'Shared/Lists/DateTile',
  component: DateTile,
  args: { top: 'Thu', day: '11', state: 'default', size: 60 },
  argTypes: {
    state: { control: 'inline-radio', options: ['default', 'highlighted', 'past'] },
    size: { control: 'inline-radio', options: [60, 52] },
  },
  decorators: [
    (Story) => (
      <div className="w-fit rounded-block bg-card p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DateTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
