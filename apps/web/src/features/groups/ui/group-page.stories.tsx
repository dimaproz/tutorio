import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { NEW_GROUP_ID, storyGroupId } from '@/stories/group-story-backend';
import { StoryBackend } from '@/stories/story-backend';
import { StoryAppShell } from '@/stories/story-shell';
import { GroupDetailView } from './group-detail';

type Args = {
  scenario: 'full' | 'new' | 'archived' | 'empty-lessons';
  role: 'OWNER' | 'TEACHER';
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
function GroupPageScreen({ scenario, role }: Args) {
  return (
    <StoryBackend withNewGroup role={role}>
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
  args: { scenario: 'full', role: 'OWNER' },
  argTypes: {
    scenario: { control: 'inline-radio', options: ['full', 'new', 'archived', 'empty-lessons'] },
    role: { control: 'inline-radio', options: ['OWNER', 'TEACHER'] },
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
    const menus = await within(region).findAllByRole('button', { name: /Actions for the lesson/ });
    await userEvent.click(menus.at(-1)!);
    const menu = within(await within(document.body).findByRole('menu'));
    await userEvent.click(menu.getByRole('menuitem', { name: 'Mark attendance' }));
    const dialog = within(await within(document.body).findByRole('dialog'));
    await userEvent.click(await dialog.findByRole('button', { name: 'Everyone came' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(within(document.body).queryByRole('dialog')).toBeNull());
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
