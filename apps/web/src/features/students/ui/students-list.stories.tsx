import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { SAMPLE_STUDENTS, STORY_CLOCK, StoryBackend } from '@/stories/story-backend';
import { StoryAppShell } from '@/stories/story-shell';
import { StudentsList } from './students-list';

type Args = { state: 'populated' | 'empty' | 'loading' | 'error' };

/**
 * The students collection in the app frame, against the in-memory story
 * backend. `state` switches between the populated list, a workspace with no
 * students, loading and a failed request. Use the viewport toolbar
 * (Handoff mobile 390) for the phone layout.
 */
function StudentsCollectionScreen({ state }: Args) {
  return (
    <StoryBackend
      students={state === 'empty' ? [] : SAMPLE_STUDENTS}
      packages={state === 'empty' ? [] : undefined}
      lessons={state === 'empty' ? [] : undefined}
      list={state === 'loading' ? 'pending' : state === 'error' ? 'error' : 'ready'}
    >
      <StoryAppShell pathname="/app/students">
        <StudentsList nowMs={STORY_CLOCK} />
      </StoryAppShell>
    </StoryBackend>
  );
}

const meta = {
  title: 'Students/Screens/Collection',
  component: StudentsCollectionScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
  args: { state: 'populated' },
  argTypes: {
    state: { control: 'inline-radio', options: ['populated', 'empty', 'loading', 'error'] },
  },
} satisfies Meta<typeof StudentsCollectionScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Students' })).toBeVisible();
    const table = await canvas.findByRole('table');
    await expect(
      await within(table).findByRole('link', { name: 'Anna Shevchenko' }),
    ).toHaveAttribute('href', `/app/students/${SAMPLE_STUDENTS[0].id}`);
    // Rows carry the rollups: credits, the next lesson and the balance.
    await expect(await within(table).findByText('6 of 8 left')).toBeVisible();
    await expect(within(table).getAllByText('Paid').length).toBeGreaterThan(0);
  },
};

export const EmptyWorkspace: Story = {
  args: { state: 'empty' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No students yet')).toBeVisible();
    // KPI cards show zeros, never dashes.
    await expect((await canvas.findAllByText('0')).length).toBeGreaterThan(0);
  },
};

/** A set filter offers "Reset", as on the parents list; search stays as typed. */
export const ResetFilters: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/app/students', query: { status: 'ON_HOLD' } },
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Reset' })).toBeVisible();
    await expect(canvas.getByRole('searchbox', { name: 'Search students' })).toBeVisible();
  },
};

/** The archived facet, as it arrives in the URL: rows dim and offer Restore. */
export const ArchivedFilter: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/app/students', query: { status: 'ARCHIVED' } },
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('link', { name: 'Kateryna Bondarenko' })).toBeVisible();
  },
};
