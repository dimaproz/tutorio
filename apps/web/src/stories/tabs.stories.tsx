import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent } from 'storybook/test';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LayoutGridIcon, ListIcon } from 'lucide-react';

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

/** Collection status filter: a white pill container sitting on paper. */
export const Segmented: Story = {
  render: () => (
    <Tabs defaultValue="all">
      <TabsList variant="segmented" aria-label="Student status">
        <TabsTrigger value="all" count={48}>
          All
        </TabsTrigger>
        <TabsTrigger value="active" count={39}>
          Active
        </TabsTrigger>
        <TabsTrigger value="hold" count={6}>
          On hold
        </TabsTrigger>
        <TabsTrigger value="archived" count={3}>
          Archived
        </TabsTrigger>
      </TabsList>
      <TabsContent value="all">Every student</TabsContent>
      <TabsContent value="active">Active students</TabsContent>
      <TabsContent value="hold">Students on hold</TabsContent>
      <TabsContent value="archived">Archived students</TabsContent>
    </Tabs>
  ),
};

/** The same control on a white card, where an outline would fight the surface. */
export const SegmentedSubtle: Story = {
  render: () => (
    <div className="rounded-card bg-card p-5">
      <Tabs defaultValue="lessons">
        <TabsList variant="segmented-subtle" aria-label="Profile sections">
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
          <TabsTrigger value="packages">Packages</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="lessons">Lessons</TabsContent>
        <TabsContent value="packages">Packages</TabsContent>
        <TabsContent value="payments">Payments</TabsContent>
        <TabsContent value="history">History</TabsContent>
      </Tabs>
    </div>
  ),
};

/** The matching icon-only control, used for the list/grid view switch. */
export const SegmentedToggleGroup: Story = {
  render: () => (
    <ToggleGroup
      type="single"
      defaultValue="list"
      variant="segmented"
      size="icon"
      spacing={0.5}
      aria-label="View"
    >
      <ToggleGroupItem value="list" aria-label="List view">
        <ListIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="grid" aria-label="Card view">
        <LayoutGridIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const SegmentedUkrainian: Story = {
  globals: { locale: 'uk' },
  render: () => (
    <Tabs defaultValue="all">
      <TabsList variant="segmented" aria-label="Статус учня">
        <TabsTrigger value="all" count={48}>
          Усі
        </TabsTrigger>
        <TabsTrigger value="active" count={39}>
          Активні
        </TabsTrigger>
        <TabsTrigger value="hold" count={6}>
          На паузі
        </TabsTrigger>
        <TabsTrigger value="archived" count={3}>
          В архіві
        </TabsTrigger>
      </TabsList>
      <TabsContent value="all">Усі учні</TabsContent>
      <TabsContent value="active">Активні учні</TabsContent>
      <TabsContent value="hold">Учні на паузі</TabsContent>
      <TabsContent value="archived">Учні в архіві</TabsContent>
    </Tabs>
  ),
};
