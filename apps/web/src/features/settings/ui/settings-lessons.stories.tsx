import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { SETTINGS_CLOCK } from '@/stories/settings-story-backend';
import { StoryBackend } from '@/stories/story-backend';
import { StoryClock } from '@/stories/story-helpers';
import { StoryAppShell } from '@/stories/story-shell';
import { SettingsLessonsPage } from './settings-lessons';

/**
 * «Заняття й пакети» (S10 board 03) in the app frame: the three steppers with
 * their presets and pictures, 24 h / 4 weeks / 2 lessons saved. The stories
 * walk 12 h and 3 lessons unsaved, the save with its toast and «Скасувати».
 */
function SettingsLessonsScreen() {
  return (
    <StoryBackend settings={{}} teachers={{ scenario: 'studio' }}>
      <StoryClock now={SETTINGS_CLOCK}>
        <StoryAppShell pathname="/app/settings/lessons">
          <SettingsLessonsPage />
        </StoryAppShell>
      </StoryClock>
    </StoryBackend>
  );
}

const meta = {
  title: 'Settings/Screens/Lessons',
  component: SettingsLessonsScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
} satisfies Meta<typeof SettingsLessonsScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

type Canvas = ReturnType<typeof within>;

const field = (canvas: Canvas, name: string) => canvas.findByRole('spinbutton', { name });

/** Board 03-01: the defaults and what each one does. */
export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'Lessons and packages' }),
    ).toBeVisible();
    await expect(await field(canvas, 'Free cancellation')).toHaveValue('24');
    await expect(await field(canvas, 'Schedule ahead')).toHaveValue('4');
    await expect(await field(canvas, 'Package warning')).toHaveValue('2');
    await expect(canvas.getByText('24 h before the lesson')).toBeVisible();
    await expect(canvas.getByText(/Lessons are in the calendar until/)).toBeVisible();
    await expect(
      canvas.getByRole('img', { name: '2 of 8 lessons left in the package' }),
    ).toBeVisible();
    await expect(canvas.getByRole('button', { name: '24 h' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  },
};

/** Boards 03-02 and 03-03: 12 h and 3 lessons are marked and counted, then saved. */
export const SaveTwoChanges: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '12 h' }));
    await userEvent.click(canvas.getByRole('button', { name: 'More: Package warning' }));
    await expect(await field(canvas, 'Free cancellation')).toHaveValue('12');
    await expect(await field(canvas, 'Package warning')).toHaveValue('3');
    await expect(canvas.getAllByText('changed')).toHaveLength(2);
    await expect(canvas.getByText('12 h before the lesson')).toBeVisible();
    await expect(
      canvas.getByRole('img', { name: '3 of 8 lessons left in the package' }),
    ).toBeVisible();
    await expect(canvas.getByRole('status')).toHaveTextContent('2 changes not saved');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    const toast = await within(document.body).findByText('Settings saved');
    // The toast fades in.
    await waitFor(() => expect(toast).toBeVisible());
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('All changes saved'));
    await expect(await field(canvas, 'Free cancellation')).toHaveValue('12');
  },
};

/** A typed value is kept inside its range; «Скасувати» restores the saved ones. */
export const TypeAndCancel: Story = {
  play: async ({ canvas }) => {
    const weeks = await field(canvas, 'Schedule ahead');
    await userEvent.clear(weeks);
    await userEvent.type(weeks, '40{Enter}');
    await expect(weeks).toHaveValue('26');
    await userEvent.click(canvas.getByRole('button', { name: '2 wk' }));
    await expect(weeks).toHaveValue('2');
    await userEvent.click(canvas.getByRole('button', { name: 'Less: Package warning' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Less: Package warning' }));
    await expect(await canvas.findAllByText('No warnings')).not.toHaveLength(0);
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(weeks).toHaveValue('4');
    await expect(await field(canvas, 'Package warning')).toHaveValue('2');
    await expect(canvas.getByRole('status')).toHaveTextContent('All changes saved');
  },
};

/** Leaving with unsaved changes asks; leaving drops them. */
export const LeaveConfirm: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '48 h' }));
    await userEvent.click(canvas.getAllByRole('link', { name: 'Settings' })[0]!);
    const confirm = await within(document.body).findByRole('alertdialog', {
      name: 'Leave without saving?',
    });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Leave without saving' }));
    await waitFor(() => expect(within(document.body).queryByRole('alertdialog')).toBeNull());
    await expect(await field(canvas, 'Free cancellation')).toHaveValue('24');
  },
};
