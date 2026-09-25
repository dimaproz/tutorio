import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { getRouter } from '@storybook/nextjs-vite/navigation.mock';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { PACKAGES_CLOCK } from '@/stories/packages-story-backend';
import { StoryBackend } from '@/stories/story-backend';
import { forceMobileMediaQuery, MOBILE_VIEWPORT, StoryClock } from '@/stories/story-helpers';
import { StoryAppShell } from '@/stories/story-shell';
import { PackagesPage } from './packages-page';

type Args = { list: 'ready' | 'empty' | 'pending' | 'error'; tab: string };

/**
 * «Пакети» (S07 board 04) against the story backend: nine packages of the
 * studio — Anna's paid English, Sofiia's running low and paid in part,
 * Maksym's unpaid group period, Daryna's three a week, Mark's 480 zł, Artem's
 * new unpaid one, Yuliia's window closing, and two finished ones. `tab`
 * opens a tab through the URL; `list` gives the empty, loading and error
 * states. The clock is Friday 25 September 2026.
 */
function PackagesScreen({ list }: Args) {
  return (
    <StoryBackend key={list} profileBilling={{ state: 'three' }} packagesStory={{ list }}>
      <StoryClock now={PACKAGES_CLOCK}>
        <StoryAppShell pathname="/app/packages">
          <PackagesPage nowMs={PACKAGES_CLOCK} />
        </StoryAppShell>
      </StoryClock>
    </StoryBackend>
  );
}

const meta = {
  title: 'Packages/Screens/Packages',
  component: PackagesScreen,
  parameters: {
    layout: 'fullscreen',
    fullBleed: true,
    nextjs: { appDirectory: true, navigation: { pathname: '/app/packages', query: {} } },
  },
  args: { list: 'ready', tab: 'ACTIVE' },
  argTypes: {
    list: { control: 'inline-radio', options: ['ready', 'empty', 'pending', 'error'] },
    tab: { table: { disable: true } },
  },
} satisfies Meta<typeof PackagesScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);
const lastUrl = () => String(getRouter().replace.mock.calls.at(-1)?.[0] ?? '');

/** 01 · Active: the table with credits, windows, payments and prices in their own currency. */
export const Playground: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = within(await canvas.findByRole('table', {}, { timeout: 5000 }));
    await expect(await table.findByText('Sofiia Melnyk')).toBeVisible();
    await expect(table.getByText('480 zł')).toBeVisible();
    await expect(table.getByText('2,000 ₴ of 3,600 ₴')).toBeVisible();
    await expect(canvas.getByText(/unpaid for 8,750 ₴/)).toBeVisible();
  },
};

/** 02 · Running out: few credits left or a window closing. */
export const Ending: Story = {
  parameters: {
    nextjs: { navigation: { pathname: '/app/packages', query: { tab: 'ENDING' } } },
  },
  play: async ({ canvasElement }) => {
    const table = within(await within(canvasElement).findByRole('table', {}, { timeout: 5000 }));
    await expect(await table.findByText('Sofiia Melnyk')).toBeVisible();
    await expect(table.queryByText('Anna Shevchenko')).toBeNull();
  },
};

/** 03 · Unpaid: partly and not paid, across currencies. */
export const Unpaid: Story = {
  parameters: {
    nextjs: { navigation: { pathname: '/app/packages', query: { tab: 'UNPAID' } } },
  },
  play: async ({ canvasElement }) => {
    const table = within(await within(canvasElement).findByRole('table', {}, { timeout: 5000 }));
    await expect(await table.findByText('Maksym Tkachenko')).toBeVisible();
    await expect(table.getAllByText('Unpaid').length).toBeGreaterThan(0);
  },
};

/** 04 · A row's menu; «Відкрити пакет» opens the ticket over the list (`?package=`). */
export const RowMenu: Story = {
  play: async ({ canvasElement }) => {
    const table = within(await within(canvasElement).findByRole('table', {}, { timeout: 5000 }));
    await userEvent.click(
      await table.findByRole('button', { name: "Actions for Maksym Tkachenko's package" }),
    );
    const menu = within(await body().findByRole('menu'));
    for (const item of ['Open package', 'Record payment', 'Extend', 'Transfer', 'Refund']) {
      await waitFor(() => expect(menu.getByRole('menuitem', { name: item })).toBeVisible());
    }
    await userEvent.click(menu.getByRole('menuitem', { name: 'Open package' }));
    await waitFor(() => expect(lastUrl()).toContain('package='));
  },
};

/** 05 · No packages yet. */
export const Empty: Story = {
  args: { list: 'empty' },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('No packages yet', {}, { timeout: 5000 }),
    ).toBeVisible();
  },
};

/** The filters write to the URL: the tab and the search. */
export const Filters: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('radio', { name: /Unpaid/ }, { timeout: 5000 }));
    await waitFor(() => expect(lastUrl()).toContain('tab=UNPAID'));
  },
};

/** The phone: one card per package. */
export const Phone: Story = {
  globals: MOBILE_VIEWPORT,
  beforeEach: forceMobileMediaQuery,
  play: async ({ canvasElement }) => {
    const cards = await within(canvasElement).findAllByRole(
      'button',
      { name: "Open Sofiia Melnyk's package" },
      { timeout: 5000 },
    );
    await waitFor(() => expect(cards.some((card) => card.checkVisibility())).toBe(true));
  },
};
