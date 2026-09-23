import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { StoryBackend } from '@/stories/story-backend';
import { StoryAppShell } from '@/stories/story-shell';
import { GroupsList } from './groups-list';

type Args = {
  state: 'populated' | 'empty' | 'loading' | 'error';
  role: 'OWNER' | 'TEACHER';
};

/**
 * The groups collection in the app frame, against the in-memory story
 * backend: the four metrics, the state tabs, the filters and the groups as
 * cards (the default) or rows. `state` switches between the populated list,
 * a workspace with no groups, loading and a failed read. Use the viewport
 * toolbar (Handoff mobile 390) for the phone cards.
 */
function GroupsCollectionScreen({ state, role }: Args) {
  return (
    <StoryBackend
      groupList={
        state === 'empty'
          ? 'empty'
          : state === 'loading'
            ? 'pending'
            : state === 'error'
              ? 'error'
              : 'ready'
      }
      role={role}
    >
      <StoryAppShell pathname="/app/groups">
        <GroupsList />
      </StoryAppShell>
    </StoryBackend>
  );
}

const meta = {
  title: 'Groups/Screens/Collection',
  component: GroupsCollectionScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
  // The cards/rows choice is remembered per browser: every story starts on cards.
  beforeEach: () => {
    window.localStorage.removeItem('tutorio.groups.view');
  },
  args: { state: 'populated', role: 'OWNER' },
  argTypes: {
    state: { control: 'inline-radio', options: ['populated', 'empty', 'loading', 'error'] },
    role: { control: 'inline-radio', options: ['OWNER', 'TEACHER'] },
  },
} satisfies Meta<typeof GroupsCollectionScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Groups' })).toBeVisible();
    await expect(
      await canvas.findByText('6 groups · 8 students · 9 lessons this week'),
    ).toBeVisible();
    const card = (
      await canvas.findAllByRole('link', { name: 'Open group · B2 prep · evening' })
    )[0]!;
    await expect(card).toBeVisible();
    // The tabs carry the summary's counts, archive included for the owner.
    await expect(canvas.getByRole('radio', { name: /Archive/ })).toBeVisible();
  },
};

/** The rows view shows the same data as the cards. */
export const Rows: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('radio', { name: 'Rows' }));
    const table = await canvas.findByRole('table');
    await expect(within(table).getByRole('link', { name: 'IELTS intensive' })).toBeVisible();
    await expect(within(table).getAllByText('6 of 8').length).toBeGreaterThan(0);
    await expect(within(table).getByText('No schedule yet')).toBeVisible();
  },
};

/** The unpaid filter ("Review" on its metric) as it arrives in the URL. */
export const UnpaidFilter: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/app/groups', query: { payment: 'unpaid' } },
    },
  },
  play: async ({ canvas }) => {
    await expect(
      (await canvas.findAllByRole('link', { name: 'Open group · IELTS intensive' }))[0],
    ).toBeVisible();
    await expect(
      canvas.queryAllByRole('link', { name: /Open group · Speaking club/ }),
    ).toHaveLength(0);
    await expect(canvas.getByRole('button', { name: 'Unpaid', pressed: true })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Reset' })).toBeVisible();
  },
};

/** A search with no hits keeps the toolbar and offers to clear the search. */
export const EmptySearch: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/app/groups', query: { search: 'ielts morning' } },
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Nothing found')).toBeVisible();
    await expect(canvas.getByText(/No group matches “ielts morning”/)).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Clear search' })).toBeVisible();
    await expect(canvas.getAllByRole('link', { name: 'Create group' })).toHaveLength(1);
  },
};

/** The archive tab lists archived groups, each with a restore in its menu. */
export const Archive: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/app/groups', query: { archive: '1' } },
    },
  },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('radio', { name: 'Rows' }));
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Actions for group Summer camp 2026' }),
    );
    const menu = within(await within(document.body).findByRole('menu'));
    // The menu fades in: wait for it rather than catch it mid-animation.
    await waitFor(() => expect(menu.getByRole('menuitem', { name: 'Restore' })).toBeVisible());
    await expect(menu.queryByRole('menuitem', { name: 'Edit' })).toBeNull();
    // Closed again, so the page is checked without the menu's modal layer.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(document.body).queryByRole('menu')).toBeNull());
  },
};

/** Archiving asks in the neutral tone and says how many lessons stop. */
export const ArchiveFromRow: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('radio', { name: 'Rows' }));
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Actions for group B2 prep · evening' }),
    );
    const menu = within(await within(document.body).findByRole('menu'));
    await userEvent.click(menu.getByRole('menuitem', { name: 'Archive' }));
    const dialog = within(await within(document.body).findByRole('alertdialog'));
    // The dialog fades in, and the count arrives with the group read.
    await waitFor(() => expect(dialog.getByText('Archive “B2 prep · evening”?')).toBeVisible());
    await waitFor(() =>
      expect(dialog.getByText(/12 upcoming lessons are cancelled/)).toBeVisible(),
    );
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
  },
};

export const EmptyWorkspace: Story = {
  args: { state: 'empty' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No groups yet')).toBeVisible();
    await expect(canvas.getByText('No groups yet.')).toBeVisible();
    await expect(canvas.queryByRole('searchbox', { name: 'Search groups' })).toBeNull();
  },
};

/** The rows view is remembered: a reload opens the list as rows again. */
export const RemembersView: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('radio', { name: 'Rows' }));
    await expect(window.localStorage.getItem('tutorio.groups.view')).toBe('rows');
    await expect(await canvas.findByRole('table')).toBeVisible();
  },
};
