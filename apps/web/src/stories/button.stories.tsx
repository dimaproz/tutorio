import type { Meta, StoryObj } from '@storybook/nextjs-vite';
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

export const LongUkrainianCopy: Story = {
  args: {
    children: ukMessages.students.empty.description,
  },
  globals: {
    locale: 'uk',
  },
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
