import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { SAMPLE_PARENTS, SAMPLE_STUDENTS, StoryBackend } from '@/stories/story-backend';
import { StoryAppShell } from '@/stories/story-shell';
import { ParentsList } from './parents-list';

type Args = {
  state: 'populated' | 'empty' | 'loading' | 'error';
  role: 'OWNER' | 'TEACHER';
};

/**
 * The parents collection in the app frame, against the in-memory story
 * backend. `state` switches between the populated list, a workspace with no
 * parents, loading and a failed request; `role` shows that the permanent
 * delete is the owner's alone. The filtered and empty-search boards are the
 * named stories below. Use the viewport toolbar (Handoff mobile 390) for the
 * card list.
 */
function ParentsCollectionScreen({ state, role }: Args) {
  return (
    <StoryBackend
      parents={state === 'empty' ? [] : SAMPLE_PARENTS}
      parentList={state === 'loading' ? 'pending' : state === 'error' ? 'error' : 'ready'}
      role={role}
    >
      <StoryAppShell pathname="/app/parents">
        <ParentsList />
      </StoryAppShell>
    </StoryBackend>
  );
}

const meta = {
  title: 'Parents/Screens/Collection',
  component: ParentsCollectionScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
  args: { state: 'populated', role: 'OWNER' },
  argTypes: {
    state: { control: 'inline-radio', options: ['populated', 'empty', 'loading', 'error'] },
    role: { control: 'inline-radio', options: ['OWNER', 'TEACHER'] },
  },
} satisfies Meta<typeof ParentsCollectionScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Parents' })).toBeVisible();
    const table = await canvas.findByRole('table');
    await expect(
      await within(table).findByRole('link', { name: 'Iryna Shevchenko' }),
    ).toHaveAttribute('href', `/app/parents/${SAMPLE_PARENTS[0].id}`);
    // The role line is derived from the linked students.
    await expect(within(table).getByText('Parent of Anna, Maksym')).toBeVisible();
    await expect(within(table).getAllByText('No students').length).toBeGreaterThan(0);
    await expect(
      await canvas.findByText('6 records — 5 linked to at least one student.'),
    ).toBeVisible();
  },
};

/** The row menu offers the permanent delete to the owner, behind the red confirmation. */
export const OwnerRowMenu: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Actions for Mariia Koval' }));
    const menu = within(await within(document.body).findByRole('menu'));
    await userEvent.click(menu.getByRole('menuitem', { name: 'Delete record' }));
    const dialog = within(await within(document.body).findByRole('alertdialog'));
    await expect(dialog.getByText('Delete this parent record?')).toBeVisible();
    await userEvent.click(dialog.getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => expect(canvas.queryByRole('link', { name: 'Mariia Koval' })).toBeNull());
  },
};

/** A non-owner never sees delete: it is hidden, not disabled on click. */
export const TeacherRowMenu: Story = {
  args: { role: 'TEACHER' },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Actions for Mariia Koval' }));
    const menu = within(await within(document.body).findByRole('menu'));
    await expect(await menu.findByRole('menuitem', { name: 'Open profile' })).toBeInTheDocument();
    await expect(menu.queryByRole('menuitem', { name: 'Delete record' })).toBeNull();
    // Closed again, so the page is checked without the menu's modal layer.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(document.body).queryByRole('menu')).toBeNull());
  },
};

/** The student filter as it arrives in the URL: an active pill, a reset and a narrowed subtitle. */
export const FilteredByStudent: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/app/parents', query: { studentId: SAMPLE_STUDENTS[0].id } },
    },
  },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('button', { name: 'Student: Anna Shevchenko' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      await canvas.findByText('Showing only those linked to Anna Shevchenko.'),
    ).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Reset' })).toBeVisible();
    await expect((await canvas.findAllByText('1 record')).length).toBeGreaterThan(0);
  },
};

/** "No students" is answered by the API, so it holds on every page. */
export const WithoutStudents: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/app/parents', query: { linked: 'none' } },
    },
  },
  play: async ({ canvas }) => {
    const table = await canvas.findByRole('table');
    await expect(await within(table).findByRole('link', { name: 'Mariia Koval' })).toBeVisible();
    await expect(within(table).queryByRole('link', { name: 'Iryna Shevchenko' })).toBeNull();
  },
};

/** A search with no hits offers to clear the search, never a second create. */
export const EmptySearch: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/app/parents', query: { search: 'kovalenko' } },
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Nothing found')).toBeVisible();
    await expect(canvas.getByText(/No record matches “kovalenko”/)).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Clear search' })).toBeVisible();
    // The header keeps its one create command; the empty state adds none.
    await expect(canvas.getAllByRole('link', { name: 'Add parent' })).toHaveLength(1);
  },
};

export const EmptyWorkspace: Story = {
  args: { state: 'empty' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No parents yet')).toBeVisible();
    await expect(canvas.getByText('No records yet.')).toBeVisible();
    // No toolbar until there is something to search.
    await expect(canvas.queryByRole('searchbox', { name: 'Search parents' })).toBeNull();
  },
};
