import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { SAMPLE_STUDENTS, StoryBackend } from '@/stories/story-backend';
import { StoryAppShell } from '@/stories/story-shell';
import { StudentCreatePage } from './student-create-page';
import { StudentEditPage } from './student-edit-page';

type Args = {
  mode: 'create' | 'edit';
  student: 'active' | 'archived';
  load: 'ready' | 'pending' | 'error';
  saveFails: boolean;
};

/**
 * The full-page student form in the app frame. `mode` switches create and
 * edit; for edit, `student` opens an active or an archived (read-only) record
 * and `load` shows the loading skeleton or the load error. `saveFails` makes
 * the request fail so the error banner with retry appears on submit.
 */
function StudentFormScreen({ mode, student, load, saveFails }: Args) {
  const record = student === 'archived' ? SAMPLE_STUDENTS[7] : SAMPLE_STUDENTS[0];
  const pathname = mode === 'create' ? '/app/students/new' : `/app/students/${record.id}/edit`;
  return (
    <StoryBackend detail={load} saveFails={saveFails}>
      <StoryAppShell pathname={pathname}>
        {mode === 'create' ? <StudentCreatePage /> : <StudentEditPage studentId={record.id} />}
      </StoryAppShell>
    </StoryBackend>
  );
}

const meta = {
  title: 'Students/Screens/Form',
  component: StudentFormScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
  args: { mode: 'create', student: 'active', load: 'ready', saveFails: false },
  argTypes: {
    mode: { control: 'inline-radio', options: ['create', 'edit'] },
    student: {
      control: 'inline-radio',
      options: ['active', 'archived'],
      if: { arg: 'mode', eq: 'edit' },
    },
    load: {
      control: 'inline-radio',
      options: ['ready', 'pending', 'error'],
      if: { arg: 'mode', eq: 'edit' },
    },
  },
  beforeEach: () => {
    // Each story starts without a leftover local draft.
    window.localStorage.removeItem('tutorio.student-create-draft');
  },
} satisfies Meta<typeof StudentFormScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Submitting empty marks the name, flags its section and turns the bar red. */
export const Validation: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Create student' }));
    const name = await canvas.findByRole('textbox', { name: /Full name/ });
    await waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'));
    await expect(canvas.getAllByRole('img', { name: 'Has an error' }).length).toBeGreaterThan(0);
    await expect(canvas.getByText(/Fix 1 field to save/)).toBeVisible();
  },
};

/** A dirty form asks before it is discarded. */
export const DiscardChanges: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(await canvas.findByRole('textbox', { name: /Full name/ }), 'Sofiia');
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    const dialog = within(await within(document.body).findByRole('alertdialog'));
    await expect(dialog.getByText('Discard changes?')).toBeVisible();
  },
};

export const RequestError: Story = {
  args: { saveFails: true },
  play: async ({ canvas }) => {
    await userEvent.type(
      await canvas.findByRole('textbox', { name: /Full name/ }),
      'Sofiia Melnyk',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Create student' }));
    await expect(await canvas.findByText('Couldn’t save the student')).toBeVisible();
  },
};

export const Edit: Story = {
  args: { mode: 'edit' },
  play: async ({ canvas }) => {
    const name = await canvas.findByRole('textbox', { name: /Full name/ });
    await expect(name).toHaveValue('Anna Shevchenko');
    await expect(canvas.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await userEvent.type(name, ' K');
    await expect(await canvas.findByText('1 unsaved change')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  },
};

/** An in-app link away from unsaved edits asks first instead of dropping them. */
export const EditLeaveGuard: Story = {
  args: { mode: 'edit' },
  play: async ({ canvas, canvasElement }) => {
    const name = await canvas.findByRole('textbox', { name: /Full name/ });
    await expect(name).toHaveValue('Anna Shevchenko');
    await userEvent.type(name, ' K');
    await userEvent.click(canvas.getByRole('link', { name: 'Calendar' }));
    const dialog = within(canvasElement.ownerDocument.body);
    await expect(await dialog.findByText('Discard changes?')).toBeVisible();
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    await expect(name).toHaveValue('Anna Shevchenko K');
  },
};

export const EditArchived: Story = {
  args: { mode: 'edit', student: 'archived' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Student is archived')).toBeVisible();
    await expect(canvas.getByRole('textbox', { name: /Full name/ })).toBeDisabled();
    await expect(canvas.queryByRole('button', { name: 'Save changes' })).toBeNull();
  },
};

export const EditLoadError: Story = {
  args: { mode: 'edit', load: 'error' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Couldn’t load the profile')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Create student' })).toBeNull();
  },
};
