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
  /**
   * S08: the B2 group's schedule — as it is, with a change or a stop planned
   * from 1 October, or none.
   */
  schedule: 'active' | 'planned' | 'stopping' | 'none';
  /** S08: `fails` refuses the sale to members, so nothing is sold. */
  memberSale: 'sells' | 'fails';
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
function GroupPageScreen({ scenario, role, memberPrices, schedule, memberSale }: Args) {
  return (
    <StoryBackend
      withNewGroup
      role={role}
      memberPrices={memberPrices}
      groupSchedule={schedule}
      memberSale={memberSale}
    >
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
  args: {
    scenario: 'full',
    role: 'OWNER',
    memberPrices: 'mixed',
    schedule: 'active',
    memberSale: 'sells',
  },
  argTypes: {
    scenario: { control: 'inline-radio', options: ['full', 'new', 'archived', 'empty-lessons'] },
    role: { control: 'inline-radio', options: ['OWNER', 'TEACHER'] },
    memberPrices: { control: 'inline-radio', options: ['mixed', 'group', 'saving'] },
    schedule: { control: 'inline-radio', options: ['active', 'planned', 'stopping', 'none'] },
    memberSale: { control: 'inline-radio', options: ['sells', 'fails'] },
  },
} satisfies Meta<typeof GroupPageScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas, canvasElement }) => {
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
    // The metric counts the members' packages that are paid.
    await expect((await canvas.findAllByText('3 of 4'))[0]).toBeVisible();
    // S08: the roster carries each member's billing; «Members' packages» is gone.
    const card = await roster(canvasElement);
    await expect(await card.findByText('Owes 800 ₴')).toBeVisible();
    await expect(card.getByText('4 need payment')).toBeVisible();
    await expect(canvas.queryByText("Members' packages")).toBeNull();
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
    await waitFor(() => expect(dialog.getByText('Add students to the group')).toBeVisible());
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
    const rows = await within(region).findAllByRole('button', { name: /^Open the lesson of/ });
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
      '[data-slot="group-roster"]',
    ) as HTMLElement,
  );

const openPriceDialog = async (canvasElement: HTMLElement, name: string) => {
  const card = await roster(canvasElement);
  // The cards take their order once the members' billing is in: open the menu after.
  await card.findByText(/need payment/);
  await userEvent.click(await card.findByRole('button', { name: `Actions for ${name}` }));
  const menu = within(await within(document.body).findByRole('menu'));
  await userEvent.click(menu.getByRole('menuitem', { name: 'Change price' }));
  const dialog = within(await within(document.body).findByRole('dialog'));
  // The price takes the focus on open; typing starts after it has.
  await waitFor(() => expect(dialog.getByLabelText('Own price')).toHaveFocus());
  return dialog;
};

/** 01 · Everyone pays the group price: nobody's meta says «own price». */
export const PricesAllGroup: Story = {
  args: { memberPrices: 'group' },
  play: async ({ canvasElement }) => {
    const card = await roster(canvasElement);
    await expect(
      await card.findByRole('link', { name: 'Open profile · Mark Shevchenko' }),
    ).toBeVisible();
    await expect(card.queryByText('own price')).toBeNull();
  },
};

/** 02 · Group price and an own price: Mark's meta reads «350 ₴ own price» (S08 card). */
export const PricesMixed: Story = {
  play: async ({ canvasElement }) => {
    const card = await roster(canvasElement);
    await expect(await card.findByText('350 ₴')).toBeVisible();
    await expect(card.getByRole('button', { name: 'own price' })).toBeVisible();
    await expect(card.getAllByText('400 ₴').length).toBeGreaterThan(0);
  },
};

/** 03 · The badge names the group price (hover on desktop, a tap on phones). */
export const OwnPriceTooltip: Story = {
  play: async ({ canvasElement }) => {
    const card = await roster(canvasElement);
    await userEvent.hover(await card.findByRole('button', { name: 'own price' }));
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
    const field = dialog.getByLabelText('Own price');
    await waitFor(() => expect(field).toHaveFocus());
    await userEvent.clear(field);
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
    // The field takes the focus with its value selected: type only after that.
    await waitFor(() => expect(field).toHaveFocus());
    await userEvent.clear(field);
    await waitFor(() => expect(field).toHaveValue(''));
    // One input event: typing key by key races the field's own formatting under load.
    await userEvent.paste('-50');
    await waitFor(() => expect(field).toHaveValue('-50'));
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    // Under a full run the validation can take longer than the default second.
    await expect(
      await dialog.findByText("The price can't be negative", undefined, { timeout: 5000 }),
    ).toBeVisible();
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
    // The field takes the focus with its value selected: type only after that.
    await waitFor(() => expect(field).toHaveFocus());
    await userEvent.clear(field);
    await waitFor(() => expect(field).toHaveValue(''));
    await userEvent.paste('300');
    await waitFor(() => expect(field).toHaveValue('300'));
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    // The toast slides in; it is visible once it has.
    const toastTitle = await within(document.body).findByText(
      'Kateryna Shevchuk — 300 ₴ from the next lesson',
      undefined,
      { timeout: 5000 },
    );
    await waitFor(() => expect(toastTitle).toBeVisible());
    const card = await roster(canvasElement);
    await expect(await card.findByText('300 ₴')).toBeVisible();
    await waitFor(() =>
      expect(within(document.body).getByRole('button', { name: 'Undo' })).toBeVisible(),
    );
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
    await waitFor(() => expect(card.queryByRole('button', { name: 'own price' })).toBeNull());
  },
};

// ---------------------------------------------------------------------------
// S08 · Group operations (the «tutorio-s08-group-operations» handoff)
// ---------------------------------------------------------------------------

const scheduleCard = async (canvasElement: HTMLElement) =>
  within(
    (await within(canvasElement).findByRole('heading', { name: 'Schedule' })).closest(
      '[data-slot="group-schedule"]',
    ) as HTMLElement,
  );

const openScheduleMenu = async (canvasElement: HTMLElement) => {
  const card = await scheduleCard(canvasElement);
  await userEvent.click(await card.findByRole('button', { name: 'Schedule actions' }));
  return within(await within(document.body).findByRole('menu'));
};

/** Board 01 · 02 · A member's attendance cell: the lesson, came or missed, the run of misses. */
export const MemberAttendanceTooltip: Story = {
  play: async ({ canvas }) => {
    const row = await canvas.findByRole('group', { name: /Came to 4 of 6/ });
    const cells = within(row).getAllByRole('button');
    // Artem's first miss of the two in a row.
    await userEvent.hover(cells[6]!);
    const tip = await within(document.body).findByRole('tooltip');
    await expect(tip).toHaveTextContent('Artem missed');
    await expect(tip).toHaveTextContent('Miss 1 of 2 in a row');
  },
};

/** Board 01 · 03 · The metric's cell: how many came and who missed. */
export const MetricAttendanceTooltip: Story = {
  play: async ({ canvasElement }) => {
    const label = (await within(canvasElement).findAllByText('Attendance')).find((node) =>
      node.closest('[data-slot="stat-block"]'),
    )!;
    const metric = within(label.closest('[data-slot="stat-block"]') as HTMLElement);
    const cells = metric.getAllByRole('button');
    // The last lesson of the window: Artem and Anna missed it, Kateryna is paused.
    await userEvent.hover(cells.at(-1)!);
    const tip = await within(document.body).findByRole('tooltip');
    await expect(tip).toHaveTextContent('Came 3 of 5');
    await expect(tip).toHaveTextContent(/Missed: Artem Lysenko and Anna Shevchenko/);
  },
};

/** Board 01 · 04 · A change planned from 1 October, and «Cancel the change». */
export const PlannedChange: Story = {
  args: { schedule: 'planned' },
  play: async ({ canvasElement }) => {
    const card = await scheduleCard(canvasElement);
    const from = /^From (1 October|October 1)$/;
    await expect(await card.findByText(from)).toBeVisible();
    await expect(card.getByText(/move to 18:00 – 19:00/)).toBeVisible();
    await userEvent.click(card.getByRole('button', { name: 'Cancel the change' }));
    await expect(
      await within(document.body).findByText(
        'Change cancelled — the lessons are back at their time',
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(card.queryByText(from)).toBeNull());
  },
};

/** A stop set for 1 October (no board; composed from the planned change): «Cancel the stop». */
export const PlannedStop: Story = {
  args: { schedule: 'stopping' },
  play: async ({ canvasElement }) => {
    const card = await scheduleCard(canvasElement);
    const from = /^Stops from (1 October|October 1)$/;
    await expect(await card.findByText(from)).toBeVisible();
    await expect(card.getByText(/^Last lesson — /)).toBeVisible();
    await userEvent.click(card.getByRole('button', { name: 'Cancel the stop' }));
    await expect(
      await within(document.body).findByText(
        'Stop cancelled — the lessons are back in the calendar',
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(card.queryByText(from)).toBeNull());
  },
};

/** Board 01 · 05 · The ⋯ menu opens the S05 change dialog, and the stop dialog. */
export const ScheduleMenu: Story = {
  play: async ({ canvasElement }) => {
    let menu = await openScheduleMenu(canvasElement);
    await expect(menu.getByText("We'll show which lessons move")).toBeInTheDocument();
    await expect(menu.getByRole('menuitem', { name: /Add a day/ })).toBeInTheDocument();
    await userEvent.click(menu.getByRole('menuitem', { name: /Change days or time/ }));
    const change = await within(document.body).findByRole('dialog', {
      name: 'Change the schedule',
    });
    await waitFor(() => expect(change).toBeVisible());
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        within(document.body).queryByRole('dialog', { name: 'Change the schedule' }),
      ).toBeNull(),
    );
    menu = await openScheduleMenu(canvasElement);
    await userEvent.click(menu.getByRole('menuitem', { name: /Stop the schedule/ }));
    const stop = await within(document.body).findByRole('dialog', { name: 'Stop the schedule' });
    await waitFor(() => expect(stop).toBeVisible());
  },
};

/** Board 01 · 06 · No schedule yet: the art, and «Create a schedule» (the S05 form). */
export const NoSchedule: Story = {
  args: { schedule: 'none' },
  play: async ({ canvasElement }) => {
    const card = within(
      (await within(canvasElement).findByRole('heading', { name: 'No schedule yet' })).closest(
        '[data-slot="group-schedule"]',
      ) as HTMLElement,
    );
    await userEvent.click(card.getByRole('button', { name: 'Create a schedule' }));
    const form = await within(document.body).findByRole('dialog', { name: 'New schedule' });
    await waitFor(() => expect(form).toBeVisible());
  },
};

/** «Mark» on a held lesson nobody marked opens the panel's attendance sheet (S01). */
export const MarkUnmarkedLesson: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Show 12 more' }));
    const region = await canvas.findByRole('region', { name: 'Group lessons' });
    const row = await within(region).findByRole('button', { name: /^Mark attendance of/ });
    const item = within(row.closest('li') as HTMLElement);
    await expect(item.getByText('Mark')).toBeVisible();
    await expect(item.getAllByText(/attendance not marked/).length).toBeGreaterThan(0);
    await userEvent.click(row);
    const sheet = within(await within(document.body).findByRole('dialog', { name: 'Attendance' }));
    await expect(await sheet.findByRole('button', { name: 'Everyone came' })).toBeInTheDocument();
  },
};

const openMemberSale = async (canvasElement: HTMLElement) => {
  const card = await roster(canvasElement);
  await userEvent.click(
    await card.findByRole('button', { name: /Sell packages to several students/ }),
  );
  const dialog = within(
    await within(document.body).findByRole('dialog', { name: 'Sell a package to members' }),
  );
  // The preview answers once the form is complete: every ticked member has a line.
  await waitFor(() => expect(dialog.getAllByText('3,600 ₴')).toHaveLength(3));
  return dialog;
};

/** Board 02 · 01 · Who needs a package is ticked: Anna (low), Artem (owes) and Sofiia (none). */
export const SellToMembers: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openMemberSale(canvasElement);
    await expect(dialog.getByText('To whom · 3 of 6')).toBeInTheDocument();
    for (const name of ['Anna Shevchenko', 'Artem Lysenko', 'Sofiia Melnyk']) {
      await expect(dialog.getByRole('checkbox', { name: `Sell to ${name}` })).toBeChecked();
    }
    for (const name of ['Mark Shevchenko', 'Denys Koval', 'Kateryna Shevchuk']) {
      await expect(dialog.getByRole('checkbox', { name: `Sell to ${name}` })).not.toBeChecked();
    }
    // Nine lessons of the schedule in October at the group price, three times.
    await expect(dialog.getByText('3 packages · 9 lessons each · Oct 1 – 31')).toBeInTheDocument();
    await expect(dialog.getByRole('button', { name: 'Sell 3 packages · 10,800 ₴' })).toBeEnabled();
    // Artem's package closes his two unpaid lessons first (L-91).
    await expect(
      dialog.getByText('First covers 2 lessons on debt — 7 stay in the package'),
    ).toBeInTheDocument();
    // Mark's own rate is only a hint until applied.
    await expect(dialog.getByText('Own price 350 ₴ · 9 × 350 = 3,150 ₴')).toBeInTheDocument();
  },
};

/** Board 02 · 02 · Mark's own rate applied on a click: 3,150 ₴, back with «As the group». */
export const SellOwnRate: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openMemberSale(canvasElement);
    await userEvent.click(dialog.getByRole('button', { name: 'Apply' }));
    await expect(dialog.getByRole('checkbox', { name: 'Sell to Mark Shevchenko' })).toBeChecked();
    await expect(await dialog.findByText('Own price: 350 ₴ a lesson')).toBeInTheDocument();
    await expect(dialog.getByRole('button', { name: 'Sell 4 packages · 13,950 ₴' })).toBeEnabled();
    await userEvent.click(dialog.getByRole('button', { name: 'As the group' }));
    await expect(
      await dialog.findByRole('button', { name: 'Sell 4 packages · 14,400 ₴' }),
    ).toBeEnabled();
  },
};

/** Board 02 · 03 · A paused member ticked: the pause holds the package's first lessons back. */
export const SellPausedMember: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openMemberSale(canvasElement);
    await userEvent.click(dialog.getByRole('checkbox', { name: 'Sell to Kateryna Shevchuk' }));
    await expect(
      await dialog.findByText(/On pause until Oct 4 — the package's first lessons are charged/),
    ).toBeInTheDocument();
    await expect(dialog.getByRole('button', { name: 'Sell 4 packages · 14,400 ₴' })).toBeEnabled();
  },
};

/** Board 02 · 04 · «3 packages sold», with «Record payment» for each member. */
export const SellSold: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openMemberSale(canvasElement);
    await userEvent.click(dialog.getByRole('button', { name: 'Sell 3 packages · 10,800 ₴' }));
    const sold = within(
      await within(document.body).findByRole('dialog', { name: '3 packages sold' }),
    );
    await expect(sold.getByText('No payment recorded yet')).toBeInTheDocument();
    await expect(
      sold.getByRole('button', { name: 'Record payment · Artem Lysenko' }),
    ).toBeInTheDocument();
    await expect(sold.getAllByRole('button', { name: /^Record payment ·/ })).toHaveLength(3);
    await expect(sold.getByText('7 of 9 · 2 lessons on debt covered')).toBeInTheDocument();
  },
};

/** All or nothing (decision 9): a refused sale sells nobody and keeps the dialog as it was. */
export const SellAllOrNothing: Story = {
  args: { memberSale: 'fails' },
  play: async ({ canvasElement }) => {
    const dialog = await openMemberSale(canvasElement);
    await userEvent.click(dialog.getByRole('button', { name: 'Sell 3 packages · 10,800 ₴' }));
    await expect(
      await within(document.body).findByText('This enrollment no longer exists.'),
    ).toBeInTheDocument();
    await expect(within(document.body).queryByRole('dialog', { name: /packages sold/ })).toBeNull();
    await expect(dialog.getByText('To whom · 3 of 6')).toBeInTheDocument();
    await expect(dialog.getByRole('button', { name: 'Sell 3 packages · 10,800 ₴' })).toBeEnabled();
  },
};
