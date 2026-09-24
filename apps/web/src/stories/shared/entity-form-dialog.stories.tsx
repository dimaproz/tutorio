import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { EntityFormDialog } from '@/components/shared/entity-form-dialog';
import { FormActions } from '@/components/shared/form-actions';
import { Button } from '@/components/ui/button';

type Args = {
  width: 'sm' | 'md' | 'lg';
  loading: boolean;
  rows: number;
};

/**
 * The dialog shell with a fixed header, a scrolling body and a fixed action
 * footer (`FormActions`); the feature owns the body. The group page's
 * attendance marking opens in it. `rows` fills the body to show the scroll.
 */
function EntityFormDialogStory({ width, loading, rows }: Args) {
  const [open, setOpen] = useState(true);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <EntityFormDialog
        open={open}
        onOpenChange={setOpen}
        title="Dialog title"
        description="One line on what the dialog changes."
        width={width}
        isLoading={loading}
        footer={
          <FormActions>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button">Save</Button>
          </FormActions>
        }
      >
        <div className="flex flex-col gap-3">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="rounded-tile bg-muted px-4 py-3 text-sm">
              Body row {index + 1}
            </div>
          ))}
        </div>
      </EntityFormDialog>
    </>
  );
}

const meta = {
  title: 'Shared/Dialogs/EntityFormDialog',
  component: EntityFormDialogStory,
  args: { width: 'md', loading: false, rows: 4 },
  argTypes: {
    width: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    rows: { control: { type: 'range', min: 1, max: 24 } },
  },
} satisfies Meta<typeof EntityFormDialogStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async () => {
    const dialog = within(await within(document.body).findByRole('dialog'));
    await waitFor(() => expect(dialog.getByText('Dialog title')).toBeVisible());
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(within(document.body).queryByRole('dialog')).toBeNull());
  },
};
