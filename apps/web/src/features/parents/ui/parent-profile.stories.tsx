import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { StoryBackend, storyParentId } from '@/stories/story-backend';
import { StoryAppShell } from '@/stories/story-shell';
import { ParentDetailView } from './parent-detail';

const PROFILE = {
  two: storyParentId(0),
  one: storyParentId(1),
  none: storyParentId(5),
} as const;

type Args = {
  profile: keyof typeof PROFILE;
  role: 'OWNER' | 'TEACHER';
  request: 'ready' | 'pending' | 'error';
};

/**
 * The parent profile in the app frame: the hero, the linked students, the
 * contact details and the notes. `profile` picks a parent with two, one or no
 * linked students; `role` shows that the `…` delete is the owner's alone;
 * `request` shows loading and a failed load. Linking and unlinking run
 * against the in-memory backend.
 */
function ParentProfileScreen({ profile, role, request }: Args) {
  const parentId = PROFILE[profile];
  return (
    <StoryBackend role={role} parentDetail={request}>
      <StoryAppShell pathname={`/app/parents/${parentId}`}>
        <ParentDetailView parentId={parentId} />
      </StoryAppShell>
    </StoryBackend>
  );
}

const meta = {
  title: 'Parents/Screens/Profile',
  component: ParentProfileScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
  args: { profile: 'one', role: 'OWNER', request: 'ready' },
  argTypes: {
    profile: { control: 'inline-radio', options: ['one', 'two', 'none'] },
    role: { control: 'inline-radio', options: ['OWNER', 'TEACHER'] },
    request: { control: 'inline-radio', options: ['ready', 'pending', 'error'] },
  },
} satisfies Meta<typeof ParentProfileScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'Oleh Lysenko' }),
    ).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Linked students · 1' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Open profile · Artem Lysenko' })).toBeVisible();
    // No lifecycle: parents have no status control.
    await expect(canvas.queryByRole('button', { name: /status/i })).toBeNull();
  },
};

/** Two linked students: the layout check for the one-student default. */
export const TwoStudents: Story = {
  args: { profile: 'two' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Linked students · 2' })).toBeVisible();
    await expect(canvas.getByText('iryna.sh@example.test')).toBeVisible();
  },
};

/** The `…` menu carries only the permanent delete, behind the red confirmation. */
export const OwnerMenu: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Record actions' }));
    const menu = within(await within(document.body).findByRole('menu'));
    await expect(menu.getAllByRole('menuitem')).toHaveLength(1);
    await userEvent.click(menu.getByRole('menuitem', { name: 'Delete record' }));
    const dialog = within(await within(document.body).findByRole('alertdialog'));
    // The dialog fades in: wait until it is fully shown.
    await waitFor(() =>
      expect(dialog.getByRole('button', { name: 'Delete permanently' })).toBeVisible(),
    );
  },
};

export const TeacherView: Story = {
  args: { role: 'TEACHER' },
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { level: 1, name: 'Oleh Lysenko' });
    await expect(canvas.queryByRole('button', { name: 'Record actions' })).toBeNull();
  },
};

/**
 * Linking from the parent side: the picker leaves out who is already linked,
 * and the confirmed student appears on the card without a reload.
 */
export const LinkStudent: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Link a student' }));
    const dialog = within(await within(document.body).findByRole('dialog'));
    // The dialog fades in: wait until it is fully shown.
    await waitFor(() => expect(dialog.getByText('Oleh Lysenko')).toBeVisible());
    await expect(dialog.queryByRole('option', { name: /Artem Lysenko/ })).toBeNull();
    await userEvent.click(await dialog.findByRole('option', { name: /Sofiia Melnyk/ }));
    await userEvent.click(dialog.getByRole('button', { name: 'Link · 1' }));
    await expect(await canvas.findByRole('heading', { name: 'Linked students · 2' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Open profile · Sofiia Melnyk' })).toBeVisible();
  },
};

/**
 * Unlinking asks first, and the question is neutral: nothing is deleted, the
 * student stays in Students and can be linked again.
 */
export const UnlinkStudent: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Actions for Artem Lysenko' }));
    const menu = within(await within(document.body).findByRole('menu'));
    await userEvent.click(menu.getByRole('menuitem', { name: 'Unlink from parent' }));
    const dialog = within(await within(document.body).findByRole('alertdialog'));
    // The dialog fades in: wait until it is fully shown.
    await waitFor(() => expect(dialog.getByText('Unlink this student?')).toBeVisible());
    await expect(dialog.getByText(/stays in Students/)).toBeVisible();
    await userEvent.click(dialog.getByRole('button', { name: 'Unlink' }));
    await waitFor(() =>
      expect(canvas.queryByRole('link', { name: 'Open profile · Artem Lysenko' })).toBeNull(),
    );
    await expect(canvas.getByText('No students linked yet.')).toBeVisible();
  },
};
