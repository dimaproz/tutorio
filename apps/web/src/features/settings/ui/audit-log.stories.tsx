import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { getRouter } from '@storybook/nextjs-vite/navigation.mock';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { IRYNA_COLORS, SETTINGS_CLOCK } from '@/stories/settings-story-backend';
import { StoryBackend } from '@/stories/story-backend';
import { forceMobileMediaQuery, MOBILE_VIEWPORT, StoryClock } from '@/stories/story-helpers';
import { StoryAppShell } from '@/stories/story-shell';
import { AuditLogPage } from './audit-log-page';

type Args = { audit: 'ready' | 'pending' | 'error' | 'empty' };

/**
 * The change log (S10 board 04) in the app frame: 64 entries of the last
 * seven days by day, the filters in the URL, a row opening into its diff and
 * «Показати ще». `audit` switches to loading, a failed read and an empty log.
 */
function AuditLogScreen({ audit }: Args) {
  return (
    <StoryBackend settings={{ audit }} teachers={{ scenario: 'studio' }}>
      <StoryClock now={SETTINGS_CLOCK}>
        <StoryAppShell pathname="/app/settings/audit">
          <AuditLogPage nowMs={SETTINGS_CLOCK} />
        </StoryAppShell>
      </StoryClock>
    </StoryBackend>
  );
}

const PATH = '/app/settings/audit';
const at = (query: Record<string, string>) => ({
  nextjs: { appDirectory: true, navigation: { pathname: PATH, query } },
});

/** Board 04-03: teachers changed by Olena from 1 to 26 September. */
const TEACHERS_BY_OLENA = {
  entity: 'TEACHER',
  action: 'UPDATE',
  actor: '66666666-6666-4666-8666-666666666666',
  period: 'custom',
  from: '2026-09-01',
  to: '2026-09-26',
};

const meta = {
  title: 'Settings/Screens/AuditLog',
  component: AuditLogScreen,
  parameters: { layout: 'fullscreen', fullBleed: true, ...at({}) },
  args: { audit: 'ready' },
  argTypes: {
    audit: { control: 'inline-radio', options: ['ready', 'pending', 'error', 'empty'] },
  },
} satisfies Meta<typeof AuditLogScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const lastUrl = () => String(getRouter().replace.mock.calls.at(-1)?.[0] ?? '');
const body = () => within(document.body);
const row = (canvas: ReturnType<typeof within>, name: RegExp) =>
  canvas.findByRole('button', { name });

/** Board 04-01: the last 7 days by day, who did it, and «Показати ще». */
export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'Change log' }),
    ).toBeVisible();
    await expect(await canvas.findByText('Today, September 26')).toBeVisible();
    await expect(canvas.getByText('Yesterday, September 25')).toBeVisible();
    await expect(
      canvas.getByText('Free cancellation 24 h → 12 h, package warning 2 lessons → 3 lessons'),
    ).toBeVisible();
    await expect(
      canvas.getByText(/^Bank transfer 3,200\s₴ for the “Жовтень” package$/),
    ).toBeVisible();
    await expect(canvas.getAllByText('Tutorio · automatically').length).toBeGreaterThan(0);
    await expect(canvas.getByText('Archived')).toBeVisible();
    await expect(canvas.getByText('Showing 20 of 64')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Show 20 more' }));
    await expect(await canvas.findByText('Showing 40 of 64')).toBeVisible();
  },
};

/** Board 04-02: Iryna's update opens into six fields: a rate, a colour, a long bio, empties. */
export const OpenDiff: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await row(canvas, /^Iryna Bondar/));
    const table = await canvas.findByRole('table');
    const cells = within(table);
    await expect(cells.getByRole('rowheader', { name: 'Rate per lesson' })).toBeVisible();
    await expect(cells.getByText(/^400\s₴$/).closest('span')).toHaveClass(/line-through/);
    await expect(cells.getByText(/^450\s₴$/)).toBeVisible();
    await expect(cells.getByText(IRYNA_COLORS.after)).toBeVisible();
    await expect(cells.getByText(/Cambridge YLE/)).toBeVisible();
    await expect(cells.getAllByText('—')).toHaveLength(2);
    await expect(cells.getAllByRole('row')).toHaveLength(7);
    await userEvent.click(await row(canvas, /^Iryna Bondar/));
    await waitFor(() => expect(canvas.queryByRole('table')).toBeNull());
  },
};

/** Board 04-03: the filtered log, with the ghost «Скинути» that clears it. */
export const FilteredTeachers: Story = {
  parameters: at(TEACHERS_BY_OLENA),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('3 entries')).toBeVisible();
    await expect(canvas.getByText('Oleh Marchenko')).toBeVisible();
    await expect(canvas.getByText(/^Rate per lesson 110\szł → 120\szł$/)).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(lastUrl()).toBe(PATH));
  },
};

/** Choosing what changed writes the filter to the URL. */
export const FilterByEntity: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'What changed' }));
    await userEvent.click(await body().findByRole('menuitemradio', { name: 'Teacher' }));
    await waitFor(() => expect(lastUrl()).toBe(`${PATH}?entity=TEACHER`));
    await waitFor(() => expect(body().queryByRole('menu')).toBeNull());
    await waitFor(() => expect(document.querySelector('[data-aria-hidden]')).toBeNull());
  },
};

/** Board 04-04: nothing matches; the empty state names the filters and resets them. */
export const NoResults: Story = {
  parameters: at({
    ...TEACHERS_BY_OLENA,
    actor: '66666666-6666-4666-8666-666666666667',
    to: '2026-09-07',
  }),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No changes match these filters')).toBeVisible();
    await expect(
      await canvas.findByText(
        'Dmytro Tutor · changed · teachers · September 1 – 7. Try another period or reset the filters.',
      ),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Reset filters' }));
    await waitFor(() => expect(lastUrl()).toBe(PATH));
  },
};

/** Phones: the cards, and one opens into «було» over «→ стало». */
export const PhoneCards: Story = {
  globals: MOBILE_VIEWPORT,
  beforeEach: forceMobileMediaQuery,
  play: async ({ canvas }) => {
    await userEvent.click(await row(canvas, /^Iryna Bondar/));
    await expect(await canvas.findByText(IRYNA_COLORS.after)).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
    await expect(canvas.getByText('20 of 64')).toBeVisible();
  },
};

/** Phones: «Фільтри» opens a sheet and counts what it sets. */
export const PhoneFilters: Story = {
  globals: MOBILE_VIEWPORT,
  beforeEach: forceMobileMediaQuery,
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Filters' }));
    const sheet = await body().findByRole('dialog', { name: 'Filters' });
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Teacher' }));
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Changed' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Show' }));
    await waitFor(() => expect(lastUrl()).toBe(`${PATH}?entity=TEACHER&action=UPDATE`));
  },
};

/** The count on «Фільтри» with three set (phone board 04-03). */
export const PhoneFiltered: Story = {
  globals: MOBILE_VIEWPORT,
  beforeEach: forceMobileMediaQuery,
  parameters: at(TEACHERS_BY_OLENA),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: /Filters/ })).toHaveTextContent('3');
    await expect(await canvas.findByText('Iryna Bondar')).toBeVisible();
  },
};

/** Loading. */
export const Loading: Story = { args: { audit: 'pending' } };

/** The failed read. */
export const LoadError: Story = {
  args: { audit: 'error' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Could not load the log')).toBeVisible();
  },
};

/** Nothing in the last seven days, no filters. */
export const Empty: Story = {
  args: { audit: 'empty' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No changes in this period')).toBeVisible();
  },
};
