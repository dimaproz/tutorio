import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SectionSkeleton } from '@/components/shared/section-skeleton';

const meta = {
  title: 'Shared/Form/SectionSkeleton',
  component: SectionSkeleton,
  args: { fields: 2 },
  argTypes: { fields: { control: { type: 'range', min: 1, max: 5 } } },
  decorators: [
    (Story) => (
      <div className="w-160 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SectionSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
