import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BellIcon, CalendarPlusIcon, MoreHorizontalIcon, PlusIcon } from 'lucide-react';
import { expect, fireEvent, fn } from 'storybook/test';
import ukMessages from '../../messages/uk.json';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

const meta = {
  title: 'Foundation/Button',
  component: Button,
  args: {
    children: 'Save changes',
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const Loading: Story = {
  args: {
    disabled: true,
    children: (
      <>
        <Spinner data-icon />
        Saving changes
      </>
    ),
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Archive student',
  },
};

/** Every fill the Studio theme ships, including the two for ink surfaces. */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">Primary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="white">White</Button>
      <Button variant="soft">Soft</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

/** The two variants that only make sense on the ink ticket. */
export const OnInkSurface: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3 rounded-hero bg-ink p-6">
      <Button variant="soft" leading={<PlusIcon />}>
        Schedule lesson
      </Button>
      <Button variant="dark-outline">Reschedule</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xl">Extra large</Button>
      <Button size="default">Default</Button>
      <Button size="sm">Small</Button>
      <Button size="xs">Extra small</Button>
    </div>
  ),
};

/** The leading slot renders its icon inside a sky bubble and re-pads the pill. */
export const LeadingBubble: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xl" leading={<PlusIcon />}>
        New student
      </Button>
      <Button leading={<CalendarPlusIcon />}>Schedule lesson</Button>
    </div>
  ),
};

export const IconButtons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" size="icon" aria-label="Notifications" indicator>
        <BellIcon />
      </Button>
      <Button variant="white" size="icon-md" aria-label="Call parent">
        <BellIcon />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Student actions">
        <MoreHorizontalIcon />
      </Button>
    </div>
  ),
};

export const LongUkrainianCopy: Story = {
  args: {
    children: ukMessages.students.empty.description,
  },
  globals: {
    locale: 'uk',
  },
};

export const Dark: Story = {
  globals: { theme: 'dark' },
};

export const DisabledDoesNotInvokeAction: Story = {
  args: {
    disabled: true,
    onClick: fn(),
  },
  play: async ({ canvas, userEvent, args }) => {
    const button = canvas.getByRole('button', { name: 'Save changes' });
    await expect(button).toBeDisabled();
    fireEvent.click(button);
    await userEvent.tab();
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
