import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent } from 'storybook/test';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function TabsContract({ orientation = 'horizontal' }: { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <Tabs defaultValue="profile" orientation={orientation}>
      <TabsList aria-label="Student sections">
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="packages">Packages</TabsTrigger>
      </TabsList>
      <TabsContent value="profile">Student profile</TabsContent>
      <TabsContent value="packages">Lesson packages</TabsContent>
    </Tabs>
  );
}

const meta = {
  title: 'Foundation/Tabs',
  component: TabsContract,
} satisfies Meta<typeof TabsContract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {};

export const VerticalKeyboardNavigation: Story = {
  args: { orientation: 'vertical' },
  play: async ({ canvas }) => {
    const profile = canvas.getByRole('tab', { name: 'Profile' });
    const packages = canvas.getByRole('tab', { name: 'Packages' });

    await userEvent.click(profile);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(packages).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByText('Lesson packages')).toBeVisible();
  },
};
