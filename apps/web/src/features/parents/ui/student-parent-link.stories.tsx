import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { StudentDetailView } from '@/features/students';
import { SAMPLE_STUDENTS, StoryBackend } from '@/stories/story-backend';
import { StoryAppShell } from '@/stories/story-shell';

type Args = { saveDelayMs: number };

/**
 * The student side of the parent relationship, on Anna's profile. It is the
 * same `LinkedCard` and `LinkPickerDialog` as the parent side. `saveDelayMs`
 * slows every save so the in-flight state can be seen: the controls stay
 * disabled until the refreshed profile arrives, which is what keeps two quick
 * edits from undoing each other.
 */
function StudentParentLinkScreen({ saveDelayMs }: Args) {
  const studentId = SAMPLE_STUDENTS[0].id;
  return (
    <StoryBackend saveDelayMs={saveDelayMs}>
      <StoryAppShell pathname={`/app/students/${studentId}`}>
        <StudentDetailView studentId={studentId} />
      </StoryAppShell>
    </StoryBackend>
  );
}

const meta = {
  title: 'Parents/Screens/Student side',
  component: StudentParentLinkScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
  args: { saveDelayMs: 0 },
  argTypes: { saveDelayMs: { control: { type: 'range', min: 0, max: 2000, step: 100 } } },
} satisfies Meta<typeof StudentParentLinkScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Parents · 1' })).toBeVisible();
    await expect(
      canvas.getByRole('link', { name: 'Open profile · Iryna Shevchenko' }),
    ).toHaveAttribute('href', expect.stringContaining('/app/parents/'));
  },
};

/**
 * A link and then an unlink in quick succession. The second edit starts from
 * the set the first one sent, so Oleh stays linked when Iryna is removed.
 */
export const TwoQuickEdits: Story = {
  args: { saveDelayMs: 300 },
  play: async ({ canvas }) => {
    const link = await canvas.findByRole('button', { name: 'Link' });
    await userEvent.click(link);
    const dialog = within(await within(document.body).findByRole('dialog'));
    await userEvent.click(await dialog.findByRole('option', { name: /Oleh Lysenko/ }));
    const confirmLink = dialog.getByRole('button', { name: 'Link · 1' });
    await userEvent.click(confirmLink);
    // In flight: nothing can edit the set again until the profile has refreshed.
    await waitFor(() => expect(confirmLink).toBeDisabled());
    // The sent set is already the one the picker builds on: Oleh is no longer offered.
    await expect(dialog.queryByRole('option', { name: /Oleh Lysenko/ })).toBeNull();
    await expect(await canvas.findByRole('heading', { name: 'Parents · 2' })).toBeVisible();
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Link' })).toBeEnabled());

    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Iryna Shevchenko' }));
    const menu = within(await within(document.body).findByRole('menu'));
    await userEvent.click(menu.getByRole('menuitem', { name: 'Unlink from student' }));
    const confirm = within(await within(document.body).findByRole('alertdialog'));
    await expect(confirm.getByText('Unlink this contact?')).toBeVisible();
    await userEvent.click(confirm.getByRole('button', { name: 'Unlink' }));

    await expect(await canvas.findByRole('heading', { name: 'Parents · 1' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Open profile · Oleh Lysenko' })).toBeVisible();
    await expect(
      canvas.queryByRole('link', { name: 'Open profile · Iryna Shevchenko' }),
    ).toBeNull();
  },
};
