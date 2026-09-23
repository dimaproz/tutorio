import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PlusIcon, SearchIcon, UserIcon, XIcon } from 'lucide-react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { LinkedCard, type LinkedCardItem } from '@/components/shared/linked-card';
import { RowActionsTrigger } from '@/components/shared/row-actions-trigger';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const STUDENTS = [
  { id: 'anna', name: 'Anna Shevchenko', meta: 'B2 · active', avatarKey: 'user-1' },
  { id: 'mark', name: 'Mark Shevchenko', meta: 'A2 · active', avatarKey: 'user-2' },
];

type Args = {
  count: number;
  readOnly: boolean;
  size: 'md' | 'sm';
  withEmptyActions: boolean;
  onAdd: () => void;
};

/**
 * The linked-records card shared by both profiles. `count` switches the
 * empty state and the one- and two-row layouts, `readOnly` drops the
 * "+ Link" command and the unlink item (an archived student), and `size`
 * is the phone density.
 */
function LinkedCardStory({ count, readOnly, size, withEmptyActions, onAdd }: Args) {
  const items: LinkedCardItem[] = STUDENTS.slice(0, count).map((student) => ({
    ...student,
    href: `/app/students/${student.id}`,
    hrefLabel: `Open profile · ${student.name}`,
    menu: (
      <DropdownMenu>
        <RowActionsTrigger label={`Actions for ${student.name}`} className="md:size-8" />
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <UserIcon data-icon />
              Open profile
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {readOnly ? null : (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem variant="destructive">
                  <XIcon data-icon />
                  Unlink from parent
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  }));

  return (
    <div className="w-135 max-w-full">
      <LinkedCard
        title="Linked students"
        items={items}
        addLabel={readOnly ? undefined : 'Link'}
        onAdd={onAdd}
        emptyText={readOnly ? 'No student relationship is recorded.' : 'No students linked yet.'}
        actions={
          withEmptyActions && !readOnly
            ? [
                { label: 'Link existing', icon: SearchIcon, onClick: onAdd },
                { label: 'Create new', icon: PlusIcon, variant: 'ghost', onClick: onAdd },
              ]
            : []
        }
        size={size}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Cards/LinkedCard',
  component: LinkedCardStory,
  args: { count: 1, readOnly: false, size: 'md', withEmptyActions: false, onAdd: fn() },
  argTypes: {
    count: { control: { type: 'range', min: 0, max: 2 } },
    size: { control: 'inline-radio', options: ['md', 'sm'] },
  },
} satisfies Meta<typeof LinkedCardStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole('heading', { name: 'Linked students · 1' })).toBeVisible();
    // The whole row is the link; the menu sits outside it.
    await expect(
      canvas.getByRole('link', { name: 'Open profile · Anna Shevchenko' }),
    ).toHaveAttribute('href', '/app/students/anna');
    await userEvent.click(canvas.getByRole('button', { name: 'Link' }));
    await expect(args.onAdd).toHaveBeenCalled();
  },
};

/** Read-only keeps the rows and their view action, and drops every command that links. */
export const ReadOnly: Story = {
  args: { readOnly: true, count: 2 },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button', { name: 'Link' })).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Anna Shevchenko' }));
    const menu = within(await within(document.body).findByRole('menu'));
    await expect(menu.queryByRole('menuitem', { name: /Unlink/ })).toBeNull();
    // Closed again, so the page is checked without the menu's modal layer.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(document.body).queryByRole('menu')).toBeNull());
  },
};

/** Nothing linked: the heading drops its count and the empty actions appear. */
export const Empty: Story = {
  args: { count: 0, withEmptyActions: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Linked students' })).toBeVisible();
    await expect(canvas.getByText('No students linked yet.')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Create new' })).toBeVisible();
  },
};
