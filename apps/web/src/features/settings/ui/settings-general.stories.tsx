import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { SETTINGS_CLOCK } from '@/stories/settings-story-backend';
import { StoryBackend } from '@/stories/story-backend';
import { forceMobileMediaQuery, MOBILE_VIEWPORT, StoryClock } from '@/stories/story-helpers';
import { StoryAppShell } from '@/stories/story-shell';
import { SettingsGeneralPage } from './settings-general';

type Args = { saveFails: boolean };

/**
 * «Загальне» (S10 board 02) in the app frame: the read-only name and
 * timezone, the currency and mode tiles and the save bar. The stories walk
 * the boards: a changed currency, the save and its toast, «Скасувати», the
 * refusal of tutor mode while four colleagues teach (a sheet on phones) and
 * the confirm when leaving with unsaved changes.
 */
function SettingsGeneralScreen({ saveFails }: Args) {
  return (
    <StoryBackend settings={{ saveFails }} teachers={{ scenario: 'studio' }}>
      <StoryClock now={SETTINGS_CLOCK}>
        <StoryAppShell pathname="/app/settings/general">
          <SettingsGeneralPage />
        </StoryAppShell>
      </StoryClock>
    </StoryBackend>
  );
}

const meta = {
  title: 'Settings/Screens/General',
  component: SettingsGeneralScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
  args: { saveFails: false },
} satisfies Meta<typeof SettingsGeneralScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

type Canvas = ReturnType<typeof within>;

const currency = (canvas: Canvas, name: RegExp) => canvas.findByRole('radio', { name });

/** Board 02-01: saved, the read-only fields and five active teachers. */
export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { level: 1, name: 'General' })).toBeVisible();
    await expect(canvas.getByRole('textbox', { name: 'Studio name' })).toHaveValue(
      'Kyiv English Studio',
    );
    await expect(canvas.getByDisplayValue(/Kyiv · UTC\+3/)).toBeDisabled();
    await expect(await currency(canvas, /UAH/)).toHaveAttribute('aria-checked', 'true');
    await expect(canvas.getByRole('radio', { name: /Studio/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(await canvas.findByText('5 active teachers')).toBeVisible();
    await expect(canvas.getByRole('status')).toHaveTextContent('All changes saved');
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeDisabled();
  },
};

/** Boards 02-02 and 02-03: PLN is marked «changed», counted, saved with a toast. */
export const SaveCurrency: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await currency(canvas, /PLN/));
    await expect(await canvas.findByText('changed')).toBeVisible();
    await expect(canvas.getByRole('status')).toHaveTextContent('1 change not saved');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    const toast = await within(document.body).findByText('Settings saved');
    // The toast fades in.
    await waitFor(() => expect(toast).toBeVisible());
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('All changes saved'));
    await expect(canvas.queryByText('changed')).toBeNull();
    await expect(canvas.getByRole('radio', { name: /PLN/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  },
};

/** The name is a setting too: too short is refused, a new one is saved. */
export const RenameStudio: Story = {
  play: async ({ canvas }) => {
    const name = await canvas.findByRole('textbox', { name: 'Studio name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'K');
    await expect(await canvas.findByText('changed')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(
      await canvas.findByText('The studio name needs at least 2 characters'),
    ).toBeVisible();
    await userEvent.type(name, 'yiv English Studio · Podil ');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    const toast = await within(document.body).findByText('Settings saved');
    await waitFor(() => expect(toast).toBeVisible());
    await expect(name).toHaveValue('Kyiv English Studio · Podil');
    await expect(canvas.getByRole('status')).toHaveTextContent('All changes saved');
  },
};

/** «Скасувати» puts back what was saved. */
export const CancelRestores: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await currency(canvas, /EUR/));
    await expect(canvas.getByRole('status')).toHaveTextContent('1 change not saved');
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(canvas.getByRole('radio', { name: /UAH/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(canvas.getByRole('status')).toHaveTextContent('All changes saved');
  },
};

/** Board 02-04: tutor mode is refused while four colleagues teach; nothing changes. */
export const SoloRefusal: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('5 active teachers')).toBeVisible();
    await userEvent.click(canvas.getByRole('radio', { name: /Tutor/ }));
    const dialog = await within(document.body).findByRole('dialog', {
      name: 'You cannot switch to tutor mode yet',
    });
    // The dialog fades in.
    await waitFor(() =>
      expect(within(dialog).getByText('The studio has 4 more active teachers')).toBeVisible(),
    );
    await expect(within(dialog).getByText('Nothing changes')).toBeVisible();
    await expect(within(dialog).getByRole('button', { name: 'Go to teachers' })).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(within(document.body).queryByRole('dialog')).toBeNull());
    await expect(canvas.getByRole('radio', { name: /Studio/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(canvas.getByRole('status')).toHaveTextContent('All changes saved');
  },
};

/** Board 02-04 on a phone: the refusal is a bottom sheet. */
export const PhoneSoloRefusal: Story = {
  globals: MOBILE_VIEWPORT,
  beforeEach: forceMobileMediaQuery,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('5 active teachers')).toBeVisible();
    await userEvent.click(canvas.getByRole('radio', { name: /Tutor/ }));
    const sheet = await within(document.body).findByRole('dialog', {
      name: 'You cannot switch to tutor mode yet',
    });
    await expect(sheet).toHaveAttribute('data-slot', 'drawer-content');
  },
};

/** Leaving with unsaved changes asks first; staying keeps them. */
export const LeaveConfirm: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await currency(canvas, /GBP/));
    await userEvent.click(canvas.getAllByRole('link', { name: 'Students' })[0]!);
    const confirm = await within(document.body).findByRole('alertdialog', {
      name: 'Leave without saving?',
    });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Stay' }));
    await waitFor(() => expect(within(document.body).queryByRole('alertdialog')).toBeNull());
    await expect(canvas.getByRole('radio', { name: /GBP/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(canvas.getByRole('status')).toHaveTextContent('1 change not saved');
  },
};

/** A failed save says so above the card and keeps the change. */
export const SaveFails: Story = {
  args: { saveFails: true },
  play: async ({ canvas }) => {
    await userEvent.click(await currency(canvas, /USD/));
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(await canvas.findByText('Could not save the settings')).toBeVisible();
    await expect(canvas.getByRole('status')).toHaveTextContent('1 change not saved');
  },
};
