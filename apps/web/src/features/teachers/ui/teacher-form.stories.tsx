import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { StoryBackend } from '@/stories/story-backend';
import { StoryClock } from '@/stories/story-helpers';
import { StoryAppShell } from '@/stories/story-shell';
import { TEACHER_IDS, TEACHERS_CLOCK } from '@/stories/teachers-story-backend';
import { TeacherCreatePage } from './teacher-create-page';
import { TeacherEditPage } from './teacher-edit-page';

type Args = {
  mode: 'create' | 'edit' | 'own';
  saveFails: boolean;
};

/**
 * The full-page teacher form (S09 board 03) in the app frame: `create` (the
 * progress meter, the first free colour), `edit` (Iryna Bondar) and `own`
 * (Olena's «My teacher profile» with «I teach»). `saveFails` makes the save
 * fail so the error banner appears. The phone board is the viewport
 * toolbar's 390.
 */
function TeacherFormScreen({ mode, saveFails }: Args) {
  const id = mode === 'own' ? TEACHER_IDS.olena : TEACHER_IDS.iryna;
  const pathname = mode === 'create' ? '/app/teachers/new' : `/app/teachers/${id}/edit`;
  return (
    <StoryBackend teachers={{ scenario: 'studio', saveFails }}>
      <StoryClock now={TEACHERS_CLOCK}>
        <StoryAppShell pathname={pathname}>
          {mode === 'create' ? <TeacherCreatePage /> : <TeacherEditPage teacherId={id} />}
        </StoryAppShell>
      </StoryClock>
    </StoryBackend>
  );
}

const meta = {
  title: 'Teachers/Screens/Form',
  component: TeacherFormScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
  args: { mode: 'create', saveFails: false },
  argTypes: {
    mode: { control: 'inline-radio', options: ['create', 'edit', 'own'] },
  },
} satisfies Meta<typeof TeacherFormScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);

/** Board 03-01: a new teacher, the progress under the navigation. */
export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'New teacher' }),
    ).toBeVisible();
    await expect(await canvas.findByText('ready to create')).toBeVisible();
    // Olena, Dmytro, Iryna, Oleh and Kateryna have the first five colours.
    await expect(canvas.getByRole('radio', { name: 'Colour 6', checked: true })).toBeVisible();
    await expect(
      canvas.getByRole('radio', { name: 'Colour 1 — another teacher has it' }),
    ).toBeVisible();
  },
};

/** Board 03-02: the subjects popover — pick a studio subject, then type a new one. */
export const SubjectsPopover: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Add subject' }));
    const search = await body().findByRole('combobox', { name: 'Find or type a new one' });
    await expect(body().getByText('Studio subjects')).toBeVisible();
    await expect(body().getByRole('option', { name: /English 3 teachers/ })).toBeVisible();
    await userEvent.click(body().getByRole('option', { name: /Français Kateryna/ }));
    await userEvent.type(search, 'DELF{Enter}');
    await userEvent.keyboard('{Escape}');
    await expect(await canvas.findByRole('button', { name: 'Remove Français' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Remove DELF' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove DELF' }));
    await waitFor(() => expect(canvas.queryByRole('button', { name: 'Remove DELF' })).toBeNull());
  },
};

/** The colour choice moves the check and the calendar preview. */
export const ColourChoice: Story = {
  play: async ({ canvas }) => {
    const purple = await canvas.findByRole('radio', { name: 'Colour 6', checked: true });
    await userEvent.click(canvas.getByRole('radio', { name: 'Colour 7' }));
    await expect(canvas.getByRole('radio', { name: 'Colour 7' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(purple).toHaveAttribute('aria-checked', 'false');
    await expect(canvas.getByText('In the calendar')).toBeVisible();
  },
};

/** Board 03-03: the name missing marks the field and its section. */
export const NameMissing: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Create teacher' }));
    const name = await canvas.findByRole('textbox', { name: /Full name/ });
    await waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'));
    await expect(canvas.getByText('Fix 1 field to save')).toBeVisible();
  },
};

/** Board 03-04: the owner's own profile — «I teach», «Save», no progress meter. */
export const OwnProfile: Story = {
  args: { mode: 'own' },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'My teacher profile' }),
    ).toBeVisible();
    await expect(canvas.getByRole('switch')).toBeChecked();
    await expect(canvas.queryByText('ready to create')).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeDisabled();
  },
};

export const EditSaved: Story = {
  args: { mode: 'edit' },
  play: async ({ canvas }) => {
    const name = await canvas.findByRole('textbox', { name: /Full name/ });
    await userEvent.clear(name);
    await userEvent.type(name, 'Iryna Bondar-Koval');
    await expect(canvas.getByText('1 unsaved change')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeEnabled();
  },
};
