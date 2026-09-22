import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SectionDivider } from '@/components/shared/section-divider';

const meta = {
  title: 'Shared/Lists/SectionDivider',
  component: SectionDivider,
  args: { label: 'Coming up' },
  decorators: [
    (Story) => (
      <div className="w-120 max-w-full rounded-block bg-card p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SectionDivider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
