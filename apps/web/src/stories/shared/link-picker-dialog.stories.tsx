import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { LinkPickerItem } from '@/components/shared/link-picker';
import { LinkPickerDialog } from '@/components/shared/link-picker-dialog';
import { Button } from '@/components/ui/button';

const PARENTS: LinkPickerItem[] = [
  {
    id: 'oleh',
    name: 'Oleh Shevchenko',
    meta: '+380 63 884 21 07 · father of Anna',
    avatarKey: 'user-8',
  },
  {
    id: 'natalia',
    name: 'Natalia Shevchuk',
    meta: '+380 97 220 55 14 · mother of Denys',
    avatarKey: 'user-10',
  },
  {
    id: 'olena',
    name: 'Olena Shevchenko',
    meta: '+380 50 447 09 12 · grandmother',
    avatarKey: null,
  },
];

type Args = {
  layout: 'modal' | 'sheet';
  busy: boolean;
  withCreate: boolean;
  onConfirm: (ids: string[]) => void;
};

/**
 * The picker as a 520px modal on desktop and a bottom sheet on phones. The
 * modal offers cancel and "Link · N"; the sheet has the grab handle and one
 * full-width confirm. Confirm stays disabled until something is picked.
 */
function LinkPickerDialogStory({ layout, busy, withCreate, onConfirm }: Args) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const results = PARENTS.filter((person) =>
    person.name.toLowerCase().includes(search.toLowerCase()),
  );
  const count = selected.length;

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Link parents
      </Button>
      <LinkPickerDialog
        open={open}
        onOpenChange={setOpen}
        layout={layout}
        title="Link parents"
        subtitle="Anna Shevchenko"
        searchLabel="Search to link"
        placeholder="Name, phone or Telegram"
        search={search}
        onSearchChange={setSearch}
        results={results}
        selected={selected}
        onToggle={(id) =>
          setSelected((current) =>
            current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
          )
        }
        listLabel="Search results"
        emptyTitle="Nothing found"
        emptyHint="Check the spelling or create a new record."
        chooseText="Pick from the list"
        selectedText={(value) => `${value} selected`}
        createLabel={withCreate ? 'Create a new contact' : undefined}
        onCreate={withCreate ? () => undefined : undefined}
        confirmLabel={layout === 'sheet' ? `Done · ${count}` : `Link · ${count}`}
        cancelLabel="Cancel"
        closeLabel="Close"
        busy={busy}
        onConfirm={onConfirm}
      />
    </>
  );
}

const meta = {
  title: 'Shared/Form/LinkPickerDialog',
  component: LinkPickerDialogStory,
  args: { layout: 'modal', busy: false, withCreate: true, onConfirm: fn() },
  argTypes: {
    layout: { control: 'inline-radio', options: ['modal', 'sheet'] },
    busy: { description: 'Saving: the picker and the confirm are disabled.' },
  },
} satisfies Meta<typeof LinkPickerDialogStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Picking one record enables the confirm, which sends exactly the picked set. */
export const PickAndConfirm: Story = {
  play: async ({ args }) => {
    const dialog = within(await within(document.body).findByRole('dialog'));
    const confirm = dialog.getByRole('button', { name: 'Link · 0' });
    await expect(confirm).toBeDisabled();
    await userEvent.click(dialog.getByRole('option', { name: /Oleh Shevchenko/ }));
    await userEvent.click(dialog.getByRole('button', { name: 'Link · 1' }));
    await expect(args.onConfirm).toHaveBeenCalledWith(['oleh']);
  },
};

export const Sheet: Story = {
  args: { layout: 'sheet' },
  play: async () => {
    const dialog = within(await within(document.body).findByRole('dialog'));
    await expect(dialog.getByRole('button', { name: 'Done · 0' })).toBeDisabled();
    await expect(dialog.queryByRole('button', { name: 'Cancel' })).toBeNull();
  },
};
