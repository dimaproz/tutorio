import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { StoryBackend } from '@/stories/story-backend';
import { StoryClock } from '@/stories/story-helpers';
import { StoryAppShell } from '@/stories/story-shell';
import { TEACHER_IDS, TEACHERS_CLOCK } from '@/stories/teachers-story-backend';
import { TeacherDetailView } from './teacher-detail';

type Args = {
  teacher: 'iryna' | 'olena';
  archived: boolean;
};

/**
 * A teacher's profile (S09 board 02) in the app frame: Iryna Bondar's by
 * default, Olena Kovalenko's own with `teacher`, Iryna archived with
 * `archived`. The header in the teacher's colour, the four metrics, the
 * week, the groups and schedules, the students and the notes; the viewport
 * toolbar gives the tablet (834) and phone (390) boards.
 */
function TeacherProfileScreen({ teacher, archived }: Args) {
  const id = TEACHER_IDS[teacher];
  return (
    <StoryBackend teachers={{ scenario: 'studio', irynaArchived: archived }}>
      <StoryClock now={TEACHERS_CLOCK}>
        <StoryAppShell pathname={`/app/teachers/${id}`}>
          <TeacherDetailView teacherId={id} />
        </StoryAppShell>
      </StoryClock>
    </StoryBackend>
  );
}

const meta = {
  title: 'Teachers/Screens/Profile',
  component: TeacherProfileScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
  args: { teacher: 'iryna', archived: false },
  argTypes: {
    teacher: { control: 'inline-radio', options: ['iryna', 'olena'] },
    archived: { control: 'boolean' },
  },
} satisfies Meta<typeof TeacherProfileScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);

/** Board 02-01: Iryna's profile on the «Groups» tab. */
export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'Iryna Bondar' }),
    ).toBeVisible();
    await expect(await canvas.findByText('13 h')).toBeVisible();
    await expect(canvas.getByText('Held in September')).toBeVisible();
    await expect(await canvas.findByText('15 lessons · 7 held · 8 ahead')).toBeVisible();
    await expect(await canvas.findByRole('link', { name: /Kids A1/ })).toBeVisible();
    await expect(await canvas.findByText('Students · 11')).toBeVisible();
  },
};

/** Board 02-02: the schedules tab, and «Show more» filling the same box. */
export const SchedulesTab: Story = {
  play: async ({ canvas }) => {
    const card = within(await canvas.findByRole('region', { name: 'Groups and schedules' }));
    await userEvent.click(card.getByRole('radio', { name: /Schedules/ }));
    await expect(await card.findByText('Showing 6 of 9')).toBeVisible();
    await expect(card.getByText(/Change from/)).toBeVisible();
    await expect(card.getByText(/Until/)).toBeVisible();
    await userEvent.click(card.getByRole('button', { name: 'Show 3 more' }));
    await expect(await card.findByText('Showing 9 of 9')).toBeVisible();
  },
};

/** The students' «Show more» loads the rest into the same box. */
export const MoreStudents: Story = {
  play: async ({ canvas }) => {
    const card = within(await canvas.findByRole('region', { name: 'Students' }));
    await expect(await card.findByText('Showing 8 of 11')).toBeVisible();
    await expect(card.getAllByText('B1 · one-to-one · English')).toHaveLength(2);
    await expect(card.getAllByText('A2 · group Kids A2')).toHaveLength(2);
    await userEvent.click(card.getByRole('button', { name: 'Show 3 more' }));
    await expect(await card.findByText('Showing 11 of 11')).toBeVisible();
  },
};

/** Board 02-03: the owner's own profile with «I teach». */
export const OwnProfile: Story = {
  args: { teacher: 'olena' },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { level: 1, name: /Olena Kovalenko/ }),
    ).toBeVisible();
    await expect(canvas.getByText('Runs the studio · teaches')).toBeVisible();
    await expect(await canvas.findByRole('switch')).toBeChecked();
  },
};

/** Board 02-04: turning teaching off shows what it hands over, then does it. */
export const TurnTeachingOff: Story = {
  args: { teacher: 'olena' },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('switch'));
    const dialog = within(await body().findByRole('dialog'));
    await waitFor(() => expect(dialog.getByText('Not teaching any more?')).toBeVisible());
    await expect(
      await dialog.findByText('You teach 12 future lessons and 2 schedules'),
    ).toBeVisible();
    await expect(dialog.getByText('You leave the teacher picker')).toBeVisible();
    await expect(dialog.getByRole('combobox')).toHaveTextContent('Dmytro Tutor');
    await userEvent.click(dialog.getByRole('button', { name: 'Turn off and hand over' }));
    await waitFor(() => expect(body().queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(canvas.getByRole('switch')).not.toBeChecked());
    await expect(canvas.getByText("Runs the studio · doesn't teach")).toBeVisible();
  },
};

/** Board 02-05: archive with a hand-over; an overlapping pick asks to hand over anyway. */
export const ArchiveWithTransfer: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Actions: Iryna Bondar' }));
    const menu = within(await body().findByRole('menu'));
    await userEvent.click(menu.getByRole('menuitem', { name: 'Archive' }));
    const dialog = within(await body().findByRole('dialog'));
    await waitFor(() => expect(dialog.getByText('Archive Iryna Bondar?')).toBeVisible());
    await expect(await dialog.findByText('3 schedules move to Dmytro')).toBeVisible();
    await expect(dialog.getByText('15 future lessons')).toBeVisible();
    await expect(dialog.getByText("History doesn't change")).toBeVisible();

    // Kateryna has a lesson at one of the handed-over times.
    await userEvent.click(dialog.getByRole('combobox'));
    await userEvent.click(await body().findByRole('option', { name: /Kateryna Rudenko/ }));
    await expect(await dialog.findByText(/overlaps Kateryna's lessons/)).toBeVisible();
    await userEvent.click(dialog.getByRole('button', { name: 'Hand over anyway' }));
    await waitFor(() => expect(body().queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(canvas.getAllByText(/Archived since/).length).toBeGreaterThan(0));
  },
};

/** Board 02-06: an archived teacher, restored behind a confirmation. */
export const ArchivedAndRestore: Story = {
  args: { archived: true },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Archived since August 12')).toBeVisible();
    await expect(canvas.queryByText('Week')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Restore' }));
    const dialog = within(await body().findByRole('alertdialog'));
    await waitFor(() => expect(dialog.getByText('Restore Iryna Bondar?')).toBeVisible());
    await userEvent.click(dialog.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(canvas.queryByText('Archived since August 12')).toBeNull());
    await expect(await canvas.findByRole('link', { name: 'Edit' })).toBeVisible();
  },
};
