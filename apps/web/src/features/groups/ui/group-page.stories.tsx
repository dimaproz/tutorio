import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { NEW_GROUP_ID, storyGroupId } from '@/stories/group-story-backend';
import { StoryBackend } from '@/stories/story-backend';
import { StoryAppShell } from '@/stories/story-shell';
import { GroupDetailView } from './group-detail';

type Args = {
  scenario: 'full' | 'new' | 'archived' | 'empty-lessons';
  role: 'OWNER' | 'TEACHER';
  /** `mixed`: Mark pays his own price; `group`: everyone the group's; `saving`: a save hangs. */
  memberPrices: 'mixed' | 'group' | 'saving';
};

const GROUP_FOR = {
  full: storyGroupId(1),
  new: NEW_GROUP_ID,
  archived: storyGroupId(7),
  'empty-lessons': storyGroupId(2),
} as const;

/**
 * The group page against the in-memory backend. `full` is the design's B2
 * group — schedule, lessons, attendance, roster, package and notes; `new` is
 * the page right after create (no schedule, zero metrics, an empty roster);
 * `archived` is read-only with "Restore"; `empty-lessons` has a schedule and
 * students but no lessons in view. The viewport toolbar gives the phone page.
 */
function GroupPageScreen({ scenario, role, memberPrices }: Args) {
  return (
    <StoryBackend withNewGroup role={role} memberPrices={memberPrices}>
      <StoryAppShell pathname={`/app/groups/${GROUP_FOR[scenario]}`}>
        <GroupDetailView groupId={GROUP_FOR[scenario]} />
      </StoryAppShell>
    </StoryBackend>
  );
}

const meta = {
  title: 'Groups/Screens/Page',
  component: GroupPageScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
  args: { scenario: 'full', role: 'OWNER', memberPrices: 'mixed' },
  argTypes: {
    scenario: { control: 'inline-radio', options: ['full', 'new', 'archived', 'empty-lessons'] },
    role: { control: 'inline-radio', options: ['OWNER', 'TEACHER'] },
    memberPrices: { control: 'inline-radio', options: ['mixed', 'group', 'saving'] },
  },
} satisfies Meta<typeof GroupPageScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'B2 prep · evening' }),
    ).toBeVisible();
    // The schedule card leads with the week and the next lesson.
    await expect(await canvas.findByText('Tuesday')).toBeVisible();
    // The lessons scroll inside their own box, with the counter under it.
    const region = await canvas.findByRole('region', { name: 'Group lessons' });
    await expect(region).toBeVisible();
    await expect(canvas.getByText('Showing 7 of 36')).toBeVisible();
    // Attendance: the student with two absences in a row is first.
    await expect(await canvas.findByText(/2 absences in a row/)).toBeVisible();
    // Every member pays with their own package; the metric counts the paid ones.
    await expect(await canvas.findByText("Members' packages")).toBeVisible();
    await expect((await canvas.findAllByText('3 of 4'))[0]).toBeVisible();
  },
};

/** Removing a student asks in the neutral tone and saves the whole roster. */
export const RemoveFromRoster: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Actions for Denys Koval' }));
    const menu = within(await within(document.body).findByRole('menu'));
    await userEvent.click(menu.getByRole('menuitem', { name: 'Remove from group' }));
    const dialog = within(await within(document.body).findByRole('alertdialog'));
    await expect(dialog.getByText('Remove Denys Koval from the group?')).toBeVisible();
    await userEvent.click(dialog.getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(canvas.queryByRole('link', { name: 'Open profile · Denys Koval' })).toBeNull(),
    );
  },
};

/** "+ Add student" opens the picker: search, checkboxes, "Add · N". */
export const AddStudents: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Add student' }));
    const dialog = within(await within(document.body).findByRole('dialog'));
    await expect(dialog.getByText('Add students to the group')).toBeVisible();
    await expect(await dialog.findByRole('button', { name: 'Create a new student' })).toBeVisible();
  },
};

/** "Show more" fills the same scrolling box. */
export const LessonsLoadMore: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Show 12 more' }));
    await expect(await canvas.findByText('Showing 19 of 36')).toBeVisible();
  },
};

/** A taught lesson's menu marks who came. */
export const MarkAttendance: Story = {
  play: async ({ canvas }) => {
    // The first rows are all upcoming; one "show more" reaches taught lessons.
    await userEvent.click(await canvas.findByRole('button', { name: 'Show 12 more' }));
    const region = await canvas.findByRole('region', { name: 'Group lessons' });
    // A row opens the lesson panel; a held lesson changes its marks there.
    const rows = await within(region).findAllByRole('button', { name: /Open the lesson of/ });
    await userEvent.click(rows.at(-1)!);
    const panel = within(await within(document.body).findByRole('dialog'));
    await userEvent.click(await panel.findByRole('button', { name: 'Change' }));
    const dialog = within(await within(document.body).findByRole('dialog', { name: 'Attendance' }));
    await userEvent.click(await dialog.findByRole('button', { name: 'Everyone came' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(within(document.body).queryByRole('dialog', { name: 'Attendance' })).toBeNull(),
    );
  },
};

/** Right after create: no schedule, zero metrics with captions, an empty roster. */
export const JustCreated: Story = {
  args: { scenario: 'new' },
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: `/app/groups/${NEW_GROUP_ID}`, query: { created: '1' } },
    },
  },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { level: 2, name: 'No schedule yet' }),
    ).toBeVisible();
    await expect(canvas.getByText('Just created')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Add students' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Add existing' })).toBeVisible();
  },
};

/** An archived group reads the same, with "Restore" as its only command. */
export const Archived: Story = {
  args: { scenario: 'archived' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('This group is archived')).toBeVisible();
    await expect(canvas.queryByRole('link', { name: 'Edit' })).toBeNull();
    await userEvent.click(canvas.getAllByRole('button', { name: /Restore group/ })[0]!);
    await waitFor(() => expect(canvas.queryByText('This group is archived')).toBeNull());
  },
};

// ---------------------------------------------------------------------------
// Member prices (the «group-member-prices» handoff, board 01)
// ---------------------------------------------------------------------------

const roster = async (canvasElement: HTMLElement) =>
  within(
    (await within(canvasElement).findByRole('heading', { name: /^Roster/ })).closest(
      '[data-slot="linked-card"]',
    ) as HTMLElement,
  );

const openPriceDialog = async (canvasElement: HTMLElement, name: string) => {
  const card = await roster(canvasElement);
  await userEvent.click(await card.findByRole('button', { name: `Actions for ${name}` }));
  const menu = within(await within(document.body).findByRole('menu'));
  await userEvent.click(menu.getByRole('menuitem', { name: 'Change price' }));
  const dialog = within(await within(document.body).findByRole('dialog'));
  // The price takes the focus on open; typing starts after it has.
  await waitFor(() => expect(dialog.getByLabelText('Own price')).toHaveFocus());
  return dialog;
};

/** 01 · Everyone pays the group price: no price column, the menu still offers it. */
export const PricesAllGroup: Story = {
  args: { memberPrices: 'group' },
  play: async ({ canvasElement }) => {
    const card = await roster(canvasElement);
    await expect(
      await card.findByRole('link', { name: 'Open profile · Mark Shevchenko' }),
    ).toBeVisible();
    await expect(card.queryByText('Price per lesson')).toBeNull();
    await expect(card.queryByText('own price')).toBeNull();
  },
};

/** 02 · Group price and an own price: the column appears, Mark's price has its badge. */
export const PricesMixed: Story = {
  play: async ({ canvasElement }) => {
    const card = await roster(canvasElement);
    await expect(await card.findByText('Price per lesson')).toBeVisible();
    await expect(card.getByText('350 ₴')).toBeVisible();
    await expect(card.getByRole('button', { name: 'own price' })).toBeVisible();
    await expect(card.getAllByText('400 ₴').length).toBeGreaterThan(0);
  },
};

/** 03 · The badge names the group price (hover on desktop, a tap on phones). */
export const OwnPriceTooltip: Story = {
  play: async ({ canvasElement }) => {
    const card = await roster(canvasElement);
    await userEvent.click(await card.findByRole('button', { name: 'own price' }));
    await expect(
      await within(document.body).findByRole('tooltip', { name: 'Group price 400 ₴' }),
    ).toBeInTheDocument();
  },
};

/** 04 · The row menu: profile, «Change price», removal. */
export const PriceRowMenu: Story = {
  play: async ({ canvasElement }) => {
    const card = await roster(canvasElement);
    await userEvent.click(await card.findByRole('button', { name: 'Actions for Anna Shevchenko' }));
    const menu = within(await within(document.body).findByRole('menu'));
    const items = menu.getAllByRole('menuitem').map((item) => item.textContent);
    await expect(items).toEqual(['Open profile', 'Change price', 'Remove from group']);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(document.body).queryByRole('menu')).toBeNull());
  },
};

/** 05 · A member on the group price: the field opens on 400, selected. */
export const PriceDialogGroup: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openPriceDialog(canvasElement, 'Anna Shevchenko');
    await expect(dialog.getByText('Price for the student')).toBeVisible();
    const field = dialog.getByLabelText('Own price');
    await expect(field).toHaveValue('400');
    await waitFor(() => expect(field).toHaveFocus());
    await expect(dialog.queryByRole('button', { name: 'Back to the group price' })).toBeNull();
    await expect(dialog.getByText(/Applies from the next lesson/)).toBeVisible();
  },
};

/** 06 · An own price: the difference, and the way back to the group price. */
export const PriceDialogOwn: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openPriceDialog(canvasElement, 'Mark Shevchenko');
    await expect(dialog.getByLabelText('Own price')).toHaveValue('350');
    await expect(dialog.getByText('50 ₴ less than the group price')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Back to the group price' })).toBeVisible();
  },
};

/** 07 · An empty price asks for one, or for the group price. */
export const PriceDialogEmpty: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openPriceDialog(canvasElement, 'Mark Shevchenko');
    await userEvent.clear(dialog.getByLabelText('Own price'));
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await expect(
      await dialog.findByText('Enter a price or go back to the group price'),
    ).toBeVisible();
  },
};

/** 08 · A negative price is refused. */
export const PriceDialogNegative: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openPriceDialog(canvasElement, 'Mark Shevchenko');
    const field = dialog.getByLabelText('Own price');
    await userEvent.clear(field);
    await userEvent.type(field, '-50');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await expect(await dialog.findByText("The price can't be negative")).toBeVisible();
  },
};

/** 09 · Saving: the field and the actions wait. */
export const PriceDialogSaving: Story = {
  args: { memberPrices: 'saving' },
  play: async ({ canvasElement }) => {
    const dialog = await openPriceDialog(canvasElement, 'Mark Shevchenko');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await expect(await dialog.findByRole('button', { name: /Saving…/ })).toBeDisabled();
    await expect(dialog.getByLabelText('Own price')).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  },
};

/** 10 · After saving: the row shows the new price and a toast offers to undo. */
export const PriceSaved: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openPriceDialog(canvasElement, 'Kateryna Shevchuk');
    const field = dialog.getByLabelText('Own price');
    await userEvent.clear(field);
    await userEvent.type(field, '300');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    // The toast slides in; it is visible once it has.
    const toastTitle = await within(document.body).findByText(
      'Kateryna Shevchuk — 300 ₴ from the next lesson',
    );
    await waitFor(() => expect(toastTitle).toBeVisible());
    const card = await roster(canvasElement);
    await expect(await card.findByText('300 ₴')).toBeVisible();
    await expect(within(document.body).getByRole('button', { name: 'Undo' })).toBeVisible();
  },
};

/** «Back to the group price» drops the override: nobody has one, the column goes. */
export const PriceReverted: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openPriceDialog(canvasElement, 'Mark Shevchenko');
    await userEvent.click(dialog.getByRole('button', { name: 'Back to the group price' }));
    await expect(
      await within(document.body).findByText(
        'Mark Shevchenko — the group price from the next lesson',
      ),
    ).toBeInTheDocument();
    const card = await roster(canvasElement);
    await waitFor(() => expect(card.queryByText('Price per lesson')).toBeNull());
  },
};
