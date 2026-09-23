import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { NotesCard } from '@/components/shared/notes-card';

type Args = { withNotes: boolean; readOnly: boolean; saveFails: boolean };

/**
 * A profile's notes, edited in place. `withNotes` switches the empty card
 * with its add command and a filled one with its edit command; `readOnly`
 * drops both; `saveFails` keeps the editor open after a failed save.
 */
function NotesCardStory({ withNotes, readOnly, saveFails }: Args) {
  const [notes, setNotes] = useState<string | null>(
    withNotes ? 'Payment questions by Telegram only, calls after 6 pm.' : null,
  );
  const [pending, setPending] = useState(false);

  return (
    <div className="w-115 max-w-full">
      <NotesCard
        notes={notes}
        updatedLabel="Updated 9 Sep"
        labels={{
          title: 'Notes',
          edit: 'Edit notes',
          add: 'Add a note',
          empty: 'No notes yet.',
          placeholder: 'e.g. call after 6 pm',
          save: 'Save',
          cancel: 'Cancel',
        }}
        maxLength={2000}
        readOnly={readOnly}
        pending={pending}
        onSave={async (next) => {
          setPending(true);
          await new Promise((resolve) => setTimeout(resolve, 150));
          setPending(false);
          if (saveFails) return false;
          setNotes(next);
          return true;
        }}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Cards/NotesCard',
  component: NotesCardStory,
  args: { withNotes: true, readOnly: false, saveFails: false },
} satisfies Meta<typeof NotesCardStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A saved note closes the editor and focus returns to the card's title. */
export const EditAndSave: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Edit notes' }));
    const field = canvas.getByRole('textbox', { name: 'Notes' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Prefers mornings.');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(await canvas.findByText('Prefers mornings.')).toBeVisible();
    await waitFor(() => expect(canvas.getByRole('heading', { name: 'Notes' })).toHaveFocus());
  },
};

/** A failed save keeps the editor and the typed text. */
export const SaveFails: Story = {
  args: { saveFails: true },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Edit notes' }));
    await userEvent.type(canvas.getByRole('textbox', { name: 'Notes' }), ' More.');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Save' })).toBeEnabled());
    await expect(canvas.getByRole('textbox', { name: 'Notes' })).toHaveValue(
      'Payment questions by Telegram only, calls after 6 pm. More.',
    );
  },
};
