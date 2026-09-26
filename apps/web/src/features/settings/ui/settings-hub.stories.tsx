import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { SETTINGS_CLOCK } from '@/stories/settings-story-backend';
import { StoryBackend } from '@/stories/story-backend';
import { StoryClock } from '@/stories/story-helpers';
import { StoryAppShell } from '@/stories/story-shell';
import { SettingsHubPage } from './settings-hub';

/**
 * The settings overview (S10 board 01) in the app frame: Kyiv English Studio
 * with its current values, the later areas marked «Незабаром». The viewport
 * toolbar gives the phone (390), where each group is a list in one card.
 */
function SettingsHubScreen() {
  return (
    <StoryBackend settings={{}} teachers={{ scenario: 'studio' }}>
      <StoryClock now={SETTINGS_CLOCK}>
        <StoryAppShell pathname="/app/settings">
          <SettingsHubPage />
        </StoryAppShell>
      </StoryClock>
    </StoryBackend>
  );
}

const meta = {
  title: 'Settings/Screens/Hub',
  component: SettingsHubScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
} satisfies Meta<typeof SettingsHubScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Board 01-01: the groups, the values of the ready areas, the inert later ones. */
export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    const general = canvas.getAllByRole('link', { name: /General/ })[0]!;
    await expect(general).toHaveAttribute('href', '/app/settings/general');
    await expect(within(general).getByText('Kyiv English Studio')).toBeVisible();
    await expect(within(general).getByText('₴ UAH')).toBeVisible();
    const lessons = canvas.getAllByRole('link', { name: /Lessons and packages/ })[0]!;
    await expect(within(lessons).getByText('24 h')).toBeVisible();
    await expect(within(lessons).getByText('4 weeks')).toBeVisible();
    await expect(within(lessons).getByText('2 lessons')).toBeVisible();
    const log = canvas.getAllByRole('link', { name: /Change log/ })[0]!;
    await expect(await within(log).findByText('64 entries this week')).toBeVisible();
    // The later areas are not links.
    await expect(canvas.queryByRole('link', { name: /Telegram bot/ })).toBeNull();
    await expect(canvas.getAllByText('Coming soon')).toHaveLength(4);
  },
};
