import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Args = {
  variant: 'default' | 'line' | 'segmented' | 'segmented-subtle';
  counts: boolean;
};

const SECTIONS = [
  { value: 'lessons', label: 'Lessons', count: 12 },
  { value: 'packages', label: 'Packages', count: 2 },
  { value: 'payments', label: 'Payments', count: 5 },
  { value: 'history', label: 'History', count: 31 },
];

/**
 * Tabs with Tutorio's list variants: `segmented` is the filter and section
 * switcher on paper, `segmented-subtle` the same control on a white card (the
 * student profile sections). A trigger can show a result count.
 */
function TabsStory({ variant, counts }: Args) {
  return (
    <div
      className={`w-fit rounded-card p-6 ${variant === 'segmented-subtle' ? 'bg-card' : 'bg-background'}`}
    >
      <Tabs defaultValue="lessons" className="gap-3">
        <TabsList variant={variant} aria-label="Profile sections">
          {SECTIONS.map((section) => (
            <TabsTrigger
              key={section.value}
              value={section.value}
              count={counts ? section.count : undefined}
            >
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {SECTIONS.map((section) => (
          <TabsContent key={section.value} value={section.value}>
            {section.label} content
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

const meta = {
  title: 'Foundation/Tabs',
  component: TabsStory,
  args: { variant: 'segmented-subtle', counts: false },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['default', 'line', 'segmented', 'segmented-subtle'],
    },
  },
} satisfies Meta<typeof TabsStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('tab', { name: 'Packages' }));
    await expect(canvas.getByRole('tab', { name: 'Packages' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(within(canvas.getByRole('tabpanel')).getByText('Packages content')).toBeVisible();
  },
};
