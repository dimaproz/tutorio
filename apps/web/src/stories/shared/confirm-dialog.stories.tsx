import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';

type Args = {
  title: string;
  text: string;
  confirm: string;
  cancel: string;
  tone: 'danger' | 'neutral';
  pending: boolean;
  onConfirm: () => void;
};

function ConfirmDialogStory({ title, text, confirm, cancel, tone, pending, onConfirm }: Args) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={text}
        confirmLabel={confirm}
        cancelLabel={cancel}
        tone={tone}
        pending={pending}
        onConfirm={onConfirm}
      />
    </>
  );
}

const meta = {
  title: 'Shared/Dialogs/ConfirmDialog',
  component: ConfirmDialogStory,
  args: {
    title: 'Discard changes?',
    text: 'Unsaved changes will be lost.',
    confirm: 'Discard changes',
    cancel: 'Cancel',
    tone: 'danger',
    pending: false,
    onConfirm: fn(),
  },
  argTypes: { tone: { control: 'inline-radio', options: ['danger', 'neutral'] } },
} satisfies Meta<typeof ConfirmDialogStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ args }) => {
    const dialog = within(await within(document.body).findByRole('alertdialog'));
    await userEvent.click(dialog.getByRole('button', { name: args.confirm }));
    await expect(args.onConfirm).toHaveBeenCalled();
  },
};

export const Neutral: Story = {
  args: {
    title: 'Move to archive?',
    text: 'The student leaves the active list. Their history is kept.',
    confirm: 'Archive',
    tone: 'neutral',
  },
};
