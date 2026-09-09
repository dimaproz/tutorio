import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Avatar, AvatarFallback, AvatarGroup } from '@/components/ui/avatar';

function AvatarContract({ size = 'default' }: { size?: 'default' | 'sm' | 'lg' }) {
  return (
    <Avatar size={size} role="img" aria-label="Anna Shevchenko">
      <AvatarFallback>AS</AvatarFallback>
    </Avatar>
  );
}

const meta = {
  title: 'Foundation/Avatar',
  component: AvatarContract,
} satisfies Meta<typeof AvatarContract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => (
    <AvatarGroup role="group" aria-label="Avatar sizes">
      <AvatarContract size="sm" />
      <AvatarContract />
      <AvatarContract size="lg" />
    </AvatarGroup>
  ),
};

export const Dark: Story = {
  globals: { theme: 'dark' },
};
