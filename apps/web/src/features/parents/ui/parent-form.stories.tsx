import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { StoryBackend, storyParentId } from '@/stories/story-backend';
import { StoryAppShell } from '@/stories/story-shell';
import { ParentCreatePage } from './parent-create-page';
import { ParentEditPage } from './parent-edit-page';

type Args = {
  mode: 'create' | 'edit';
  role: 'OWNER' | 'TEACHER';
  load: 'ready' | 'pending' | 'error';
  saveFails: boolean;
};

/**
 * The full-page parent form in the app frame. `mode` switches create and
 * edit; for edit, `load` shows the loading skeleton or the load error and
 * `role` shows that the danger zone is the owner's alone. `saveFails` makes
 * the request fail so the error banner with retry appears on submit. No
 * local draft is kept in either mode.
 */
function ParentFormScreen({ mode, role, load, saveFails }: Args) {
  const parentId = storyParentId(0);
  const pathname = mode === 'create' ? '/app/parents/new' : `/app/parents/${parentId}/edit`;
  return (
    <StoryBackend role={role} parentDetail={load} parentSaveFails={saveFails}>
      <StoryAppShell pathname={pathname}>
        {mode === 'create' ? <ParentCreatePage /> : <ParentEditPage parentId={parentId} />}
      </StoryAppShell>
    </StoryBackend>
  );
}

const meta = {
  title: 'Parents/Screens/Form',
  component: ParentFormScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
  args: { mode: 'create', role: 'OWNER', load: 'ready', saveFails: false },
  argTypes: {
    mode: { control: 'inline-radio', options: ['create', 'edit'] },
    role: {
      control: 'inline-radio',
      options: ['OWNER', 'TEACHER'],
      if: { arg: 'mode', eq: 'edit' },
    },
    load: {
      control: 'inline-radio',
      options: ['ready', 'pending', 'error'],
      if: { arg: 'mode', eq: 'edit' },
    },
  },
} satisfies Meta<typeof ParentFormScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'New parent' }),
    ).toBeVisible();
    // The caption sits under the bars, so the counter never wraps.
    await expect(canvas.getByText('0 of 4 filled')).toBeVisible();
    await expect(canvas.getByText('ready to create')).toBeVisible();
  },
};

/** Only the name is required: submitting empty marks it and turns the bar red. */
export const Validation: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Create record' }));
    const name = await canvas.findByRole('textbox', { name: /Full name/ });
    await waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'));
    await expect(canvas.getByText(/Fix 1 field to save/)).toBeVisible();
  },
};

/** Linking in the form: a picked student becomes a row with an ✕ that removes it without a dialog. */
export const LinkInForm: Story = {
  play: async ({ canvas }) => {
    const field = await canvas.findByRole('combobox', { name: 'Add a student' });
    await userEvent.click(field);
    const list = within(await within(document.body).findByRole('listbox'));
    await userEvent.click(await list.findByRole('option', { name: /Anna Shevchenko/ }));
    await expect(await canvas.findByText('Linked · 1')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Anna Shevchenko' }));
    await expect(await canvas.findByText('Nothing linked yet')).toBeVisible();
    await expect(within(document.body).queryByRole('alertdialog')).toBeNull();
  },
};

/** The edit form as the tutor finds it: every section filled, the danger zone last. */
export const Edit: Story = {
  args: { mode: 'edit' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByDisplayValue('iryna.sh@example.test')).toBeVisible();
    await expect(canvas.getByText('saved')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await expect(canvas.getByRole('heading', { name: 'Delete record' })).toBeVisible();
  },
};

/** Edit carries the danger zone at the end, and its confirmation is the red one. */
export const EditOwner: Story = {
  args: { mode: 'edit' },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'Edit record' }),
    ).toBeVisible();
    await expect(await canvas.findByDisplayValue('iryna.sh@example.test')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Delete' }));
    const dialog = within(await within(document.body).findByRole('alertdialog'));
    await expect(dialog.getByText('Delete this parent record?')).toBeVisible();
  },
};

export const EditTeacher: Story = {
  args: { mode: 'edit', role: 'TEACHER' },
  play: async ({ canvas }) => {
    await canvas.findByDisplayValue('iryna.sh@example.test');
    await expect(canvas.queryByRole('heading', { name: 'Delete record' })).toBeNull();
  },
};

export const RequestError: Story = {
  args: { saveFails: true },
  play: async ({ canvas }) => {
    await userEvent.type(
      await canvas.findByRole('textbox', { name: /Full name/ }),
      'Oleh Shevchenko',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Create record' }));
    await expect(await canvas.findByText('Couldn’t save the record')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Try again' })).toBeVisible();
  },
};
