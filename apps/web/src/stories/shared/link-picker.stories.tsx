import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { LinkPicker, type LinkPickerItem } from '@/components/shared/link-picker';

const PEOPLE: LinkPickerItem[] = [
  { id: 'anna', name: 'Anna Shevchenko', meta: 'B2 · active', avatarKey: 'user-1' },
  { id: 'mark', name: 'Mark Shevchenko', meta: 'A2 · active', avatarKey: 'user-2' },
  { id: 'kateryna', name: 'Kateryna Shevchuk', meta: 'A2 · on a break', avatarKey: 'user-3' },
  { id: 'artem', name: 'Artem Lysenko', meta: 'B1 · on a break', avatarKey: null },
];

type Args = {
  linkedCount: number;
  open: boolean;
  noResults: boolean;
  loading: boolean;
  withCreate: boolean;
  framed: boolean;
  popover: boolean;
  hint: boolean;
};

/**
 * The relationship picker: the linked set with an ✕ on each row, the search
 * field and the multi-select results. Every control switches one of the
 * design states — nothing linked or a linked list, closed or open results,
 * no results, the create row, framed or bare, popover or inline, and the
 * phone variant without the keyboard hint.
 */
function LinkPickerStory({
  linkedCount,
  open: initiallyOpen,
  noResults,
  loading,
  withCreate,
  framed,
  popover,
  hint,
}: Args) {
  const [linked, setLinked] = useState(PEOPLE.slice(0, linkedCount));
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(initiallyOpen);
  const results = noResults
    ? []
    : PEOPLE.filter(
        (person) =>
          !linked.some((item) => item.id === person.id) &&
          person.name.toLowerCase().includes(search.toLowerCase()),
      );

  return (
    <div className="flex min-h-120 w-130 max-w-full flex-col rounded-card bg-card p-6">
      <LinkPicker
        title="Linked students"
        description="Which students they represent"
        tag={{ label: 'optional', tone: 'optional' }}
        framed={framed}
        linked={linked}
        linkedLabel={`Linked · ${linked.length}`}
        emptyText="Nothing linked yet"
        unlinkLabel={(name) => `Remove ${name}`}
        onUnlink={(id) => setLinked((current) => current.filter((item) => item.id !== id))}
        fieldLabel="Add a student"
        searchLabel="Add a student"
        placeholder="Name, phone or Telegram"
        search={search}
        onSearchChange={setSearch}
        open={open}
        onOpenChange={setOpen}
        results={results}
        loading={loading}
        selected={selected}
        onToggle={(id) =>
          setSelected((current) =>
            current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
          )
        }
        popover={popover}
        hint={hint}
        listLabel="Search results"
        emptyTitle="Nothing found"
        emptyHint="Check the spelling or create a new record."
        chooseText="Pick from the list"
        selectedText={(count) => `${count} selected`}
        createLabel={withCreate ? 'Create a new student' : undefined}
        onCreate={withCreate ? () => undefined : undefined}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Form/LinkPicker',
  component: LinkPickerStory,
  args: {
    linkedCount: 1,
    open: true,
    noResults: false,
    loading: false,
    withCreate: true,
    framed: true,
    popover: false,
    hint: true,
  },
  argTypes: {
    linkedCount: { control: { type: 'range', min: 0, max: 3 } },
    popover: { description: 'Results float over the page instead of sitting inline.' },
    hint: { description: 'The "N selected · ↑ ↓ Enter" footer; off on phones.' },
  },
} satisfies Meta<typeof LinkPickerStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** ↑ ↓ move through the results and Enter toggles, without leaving the field. */
export const Keyboard: Story = {
  play: async ({ canvas }) => {
    const field = await canvas.findByRole('combobox', { name: 'Add a student' });
    await userEvent.click(field);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    const list = within(await canvas.findByRole('listbox', { name: 'Search results' }));
    await waitFor(() =>
      expect(list.getByRole('option', { name: /Kateryna Shevchuk/ })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
    await expect(canvas.getByText('1 selected')).toBeVisible();
    await expect(field).toHaveFocus();
  },
};

/** The linked rows are removed with their ✕, and the removed record is offered again. */
export const Unlink: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Remove Anna Shevchenko' }));
    await expect(await canvas.findByText('Nothing linked yet')).toBeVisible();
    await expect(canvas.getByRole('option', { name: /Anna Shevchenko/ })).toBeVisible();
  },
};

export const NoResults: Story = {
  args: { noResults: true, linkedCount: 0 },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Nothing found')).toBeVisible();
    await expect(canvas.getByRole('option', { name: 'Create a new student' })).toBeVisible();
  },
};
