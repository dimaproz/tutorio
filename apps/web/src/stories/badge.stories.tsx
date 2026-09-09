import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Badge } from '@/components/ui/badge';

const meta = {
  title: 'Foundation/Badge',
  component: Badge,
  args: {
    children: 'Active',
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Archived',
  },
};

export const SemanticStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="primary">Active</Badge>
      <Badge variant="success">Paid</Badge>
      <Badge variant="warning">On hold</Badge>
      <Badge variant="destructive">Archived</Badge>
    </div>
  ),
};

export const Dark: Story = {
  globals: { theme: 'dark' },
};
