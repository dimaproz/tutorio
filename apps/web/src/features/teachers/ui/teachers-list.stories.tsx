import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { StoryBackend } from '@/stories/story-backend';
import { StoryClock } from '@/stories/story-helpers';
import { StoryAppShell } from '@/stories/story-shell';
import { TEACHERS_CLOCK, type TeacherStoryOptions } from '@/stories/teachers-story-backend';
import { TeachersList } from './teachers-list';

type Scenario = NonNullable<TeacherStoryOptions['teachers']>['scenario'];
type Args = {
  scenario: Scenario;
  state: 'ready' | 'pending' | 'error';
};

/**
 * The teachers collection (S09 board 01) in the app frame, against the story
 * backend: Kyiv English Studio with six teachers, one archived. `scenario`
 * switches to the owner who stopped teaching, the owner alone and tutor mode;
 * `state` to loading and a failed read. The table/cards choice is the
 * toolbar's; the viewport toolbar gives the tablet (834) and phone (390)
 * boards, which show cards.
 */
function TeachersCollectionScreen({ scenario, state }: Args) {
  return (
    <StoryBackend
      teachers={{ scenario, list: state }}
      mode={scenario === 'solo' ? 'SOLO' : 'SCHOOL'}
    >
      <StoryClock now={TEACHERS_CLOCK}>
        <StoryAppShell pathname="/app/teachers">
          <TeachersList />
        </StoryAppShell>
      </StoryClock>
    </StoryBackend>
  );
}

const meta = {
  title: 'Teachers/Screens/Collection',
  component: TeachersCollectionScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
  // The table/cards choice is remembered per browser: every story starts on the table.
  beforeEach: () => {
    window.localStorage.removeItem('tutorio.teachers.view');
  },
  args: { scenario: 'studio', state: 'ready' },
  argTypes: {
    scenario: {
      control: 'inline-radio',
      options: ['studio', 'notTeaching', 'onlyMe', 'solo'],
    },
    state: { control: 'inline-radio', options: ['ready', 'pending', 'error'] },
  },
} satisfies Meta<typeof TeachersCollectionScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Board 01-01: the table, the owner first with «You» and the crown. */
export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Teachers' })).toBeVisible();
    await expect(await canvas.findByText('5 teachers · 1 archived')).toBeVisible();
    const table = await canvas.findByRole('table');
    const rows = within(table).getAllByRole('row');
    // The header row, then the owner first.
    await expect(within(rows[1]!).getByText('Olena Kovalenko')).toBeVisible();
    await expect(within(rows[1]!).getByText('You')).toBeVisible();
    await expect(within(rows[1]!).getByRole('img', { name: 'Runs the studio' })).toBeVisible();
    await expect(canvas.getByRole('radio', { name: /Archive/ })).toBeVisible();
  },
};

/** Board 01-02: the switch shows the same teachers as cards, and back. */
export const Cards: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('radio', { name: 'Cards' }));
    await waitFor(() => expect(canvas.queryByRole('table')).toBeNull());
    const cards = canvasCards(canvas);
    await expect(cards.length).toBe(5);
    await expect(
      await canvas.findByRole('link', { name: 'Add teacher Name, subjects, rate and colour' }),
    ).toBeVisible();
    await expect(window.localStorage.getItem('tutorio.teachers.view')).toBe('grid');
    await userEvent.click(canvas.getByRole('radio', { name: 'Table' }));
    await expect(await canvas.findByRole('table')).toBeVisible();
  },
};

function canvasCards(canvas: ReturnType<typeof within>) {
  return canvas.getAllByRole('article');
}

/** Board 01-03: the owner who stopped teaching sits above the list and comes back. */
export const OwnerNotTeaching: Story = {
  args: { scenario: 'notTeaching' },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText(
        "You don't teach — you are not in the teacher picker for lessons and groups",
      ),
    ).toBeVisible();
    await expect(canvas.getByText('4 teachers · 1 archived')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'I teach too' }));
    await waitFor(() => expect(canvas.queryByRole('button', { name: 'I teach too' })).toBeNull());
    await expect(await canvas.findByText('5 teachers · 1 archived')).toBeVisible();
  },
};

/** Board 01-04: the archive tab. */
export const Archive: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/app/teachers', query: { status: 'archived' } },
    },
  },
  play: async ({ canvas }) => {
    const table = await canvas.findByRole('table');
    await expect(within(table).getByText('Andrii Savchuk')).toBeVisible();
    await expect(within(table).queryByText('Olena Kovalenko')).toBeNull();
  },
};

/** Board 01-05: the owner alone, with the invitation to add colleagues. */
export const OnlyOwner: Story = {
  args: { scenario: 'onlyMe' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('So far you are the only teacher')).toBeVisible();
    await expect(canvas.getByText('1 teacher — you')).toBeVisible();
    await expect(canvas.queryByRole('searchbox', { name: 'Search teachers' })).toBeNull();
    // Alone and teaching: tutor mode is one click away.
    await userEvent.click(canvas.getByRole('button', { name: 'Actions: Olena Kovalenko' }));
    const menu = within(await within(document.body).findByRole('menu'));
    await userEvent.click(await menu.findByRole('menuitem', { name: 'Switch to tutor mode' }));
    const toast = await within(document.body).findByText('Tutor mode is on');
    await waitFor(() => expect(toast).toBeVisible());
  },
};

/** Board 01-06: tutor mode, one teacher and the way to a studio. */
export const TutorMode: Story = {
  args: { scenario: 'solo' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('You work on your own')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Switch to studio mode' })).toBeVisible();
    await expect(canvas.queryByRole('link', { name: 'Add teacher' })).toBeNull();
    // A solo tutor is the teacher: no turning teaching off, no tutor mode to switch to.
    await userEvent.click(await canvas.findByRole('button', { name: 'Actions: Olena Kovalenko' }));
    const menu = within(await within(document.body).findByRole('menu'));
    await waitFor(() => expect(menu.getByRole('menuitem', { name: 'Open profile' })).toBeVisible());
    await expect(menu.queryByRole('menuitem', { name: 'Turn teaching off' })).toBeNull();
    await expect(menu.queryByRole('menuitem', { name: 'Switch to tutor mode' })).toBeNull();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(document.body).queryByRole('menu')).toBeNull());
  },
};

/**
 * Board 01-07 is superseded (the owner's answer, 2026-09-26): with colleagues
 * teaching, the owner's menu does not offer tutor mode at all.
 */
export const NoTutorModeWithColleagues: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Actions: Olena Kovalenko' }));
    const menu = within(await within(document.body).findByRole('menu'));
    await waitFor(() =>
      expect(menu.getByRole('menuitem', { name: 'Turn teaching off' })).toBeVisible(),
    );
    await expect(menu.queryByRole('menuitem', { name: 'Switch to tutor mode' })).toBeNull();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(document.body).queryByRole('menu')).toBeNull());
  },
};

export const Loading: Story = { args: { state: 'pending' } };

export const Failed: Story = {
  args: { state: 'error' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Couldn't load the teachers")).toBeVisible();
  },
};
