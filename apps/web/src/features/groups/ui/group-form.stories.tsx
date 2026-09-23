import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { storyGroupId } from '@/stories/group-story-backend';
import { StoryBackend } from '@/stories/story-backend';
import { StoryAppShell } from '@/stories/story-shell';
import { GroupCreatePage } from './group-create-page';
import { GroupEditPage } from './group-edit-page';

type Args = { mode: 'create' | 'edit' | 'edit-no-schedule'; role: 'OWNER' | 'TEACHER' };

/**
 * The full-page group form against the in-memory backend. `create` is the
 * empty form, `edit` the B2 group (its schedule is kept on the patterns
 * screen, so the section shows it read-only) and `edit-no-schedule` a group
 * whose first schedule the form can still create. The danger zone archives,
 * and only for the owner.
 */
function GroupFormScreen({ mode, role }: Args) {
  const groupId = mode === 'edit' ? storyGroupId(1) : storyGroupId(6);
  return (
    <StoryBackend role={role}>
      <StoryAppShell
        pathname={mode === 'create' ? '/app/groups/new' : `/app/groups/${groupId}/edit`}
      >
        {mode === 'create' ? <GroupCreatePage /> : <GroupEditPage groupId={groupId} />}
      </StoryAppShell>
    </StoryBackend>
  );
}

const meta = {
  title: 'Groups/Screens/Form',
  component: GroupFormScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
  args: { mode: 'create', role: 'OWNER' },
  argTypes: {
    mode: { control: 'inline-radio', options: ['create', 'edit', 'edit-no-schedule'] },
    role: { control: 'inline-radio', options: ['OWNER', 'TEACHER'] },
  },
} satisfies Meta<typeof GroupFormScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { level: 1, name: 'New group' })).toBeVisible();
    await expect(canvas.getByText('Only the name is required')).toBeVisible();
  },
};

/** Only the name is required; the time and length appear with the first day. */
export const Validation: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Create group' }));
    await expect(await canvas.findByText('Enter the group name')).toBeVisible();
  },
};

/** The time and length appear with the first day; a school names who teaches it. */
export const ScheduleNeedsTeacher: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(await canvas.findByLabelText(/Group name/), 'B2 prep');
    await expect(canvas.queryByLabelText('Start')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: /^Tue/i }));
    await expect(await canvas.findByLabelText('Start')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Create group' }));
    await expect(
      await canvas.findByText('Choose a teacher to add students or a schedule'),
    ).toBeVisible();
  },
};

/** An existing schedule is changed on the recurring-lessons screen. */
export const EditWithSchedule: Story = {
  args: { mode: 'edit' },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText('The group already has a schedule'),
    ).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Open recurring lessons' })).toBeVisible();
    await expect(canvas.getByDisplayValue('B2 prep · evening')).toBeVisible();
  },
};

/** The danger zone archives in the neutral tone, and only for the owner. */
export const ArchiveFromForm: Story = {
  args: { mode: 'edit' },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Archive' }));
    const dialog = within(await within(document.body).findByRole('alertdialog'));
    await expect(dialog.getByText('Archive “B2 prep · evening”?')).toBeVisible();
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(within(document.body).queryByRole('alertdialog')).toBeNull());
  },
};

/** The archive confirmation, left open: neutral, with what stays and what stops. */
export const ArchiveDialog: Story = {
  args: { mode: 'edit' },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Archive' }));
    const dialog = within(await within(document.body).findByRole('alertdialog'));
    await expect(await dialog.findByText(/12 upcoming lessons are cancelled/)).toBeVisible();
  },
};

export const TeacherCannotArchive: Story = {
  args: { mode: 'edit', role: 'TEACHER' },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'Edit group' }),
    ).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Archive' })).toBeNull();
  },
};
