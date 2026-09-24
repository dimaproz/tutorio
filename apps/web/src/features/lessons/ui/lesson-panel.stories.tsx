import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test';
import { GroupDetailView } from '@/features/groups';
import { StudentDetailView } from '@/features/students';
import { storyGroupId } from '@/stories/group-story-backend';
import {
  LESSON_STATES,
  kyiv,
  lessonStateClock,
  type LessonState,
} from '@/stories/lesson-story-backend';
import { SAMPLE_STUDENTS, StoryBackend } from '@/stories/story-backend';
import { StoryAppShell } from '@/stories/story-shell';
import { LessonPanel } from './lesson-panel';

const STUDENT_ID = SAMPLE_STUDENTS[0].id;
const GROUP_ID = storyGroupId(1);
const LINKS = {
  studentHref: (id: string) => `/app/students/${id}`,
  groupHref: (id: string) => `/app/groups/${id}`,
};

type Args = {
  state: LessonState;
  /** Pins the clock, e.g. three hours before the lesson for a late cancellation. */
  clock: 'story' | 'lateCancel';
  onClose: () => void;
  onOpenLesson: (lessonId: string) => void;
};

/**
 * The lesson window of S01 (layout A: one 640px column under the indigo
 * band) over the page that opened it: the student profile for an individual
 * lesson, the group page for a group lesson. `state` picks every state of
 * boards 01 (individual) and 02 (group); the dialogs and the edit mode are
 * reached by the named stories. Writes run against the in-memory backend; a
 * move answers with a conflict until it is forced.
 */
function LessonPanelScreen({ state, clock, onClose, onOpenLesson }: Args) {
  const group = state.startsWith('group');
  const nowMs = clock === 'lateCancel' ? Date.parse(kyiv(11, 14)) : lessonStateClock(state);
  return (
    <StoryBackend lessonConflicts>
      <StoryAppShell pathname={group ? `/app/groups/${GROUP_ID}` : `/app/students/${STUDENT_ID}`}>
        {group ? (
          <GroupDetailView groupId={GROUP_ID} />
        ) : (
          <StudentDetailView studentId={STUDENT_ID} />
        )}
        <LessonPanel
          lessonId={LESSON_STATES[state]}
          onClose={onClose}
          onOpenLesson={onOpenLesson}
          links={LINKS}
          nowMs={nowMs}
        />
      </StoryAppShell>
    </StoryBackend>
  );
}

const meta = {
  title: 'Lessons/Screens/Panel',
  component: LessonPanelScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
  args: {
    state: 'scheduledPackage',
    clock: 'story',
    onClose: fn(),
    onOpenLesson: fn(),
  },
  argTypes: {
    state: { control: 'select', options: Object.keys(LESSON_STATES) },
    clock: { control: 'inline-radio', options: ['story', 'lateCancel'] },
  },
} satisfies Meta<typeof LessonPanelScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const screen = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body);
/** Dialogs fade in: wait until the element is fully shown. */
const visible = (element: HTMLElement) => waitFor(() => expect(element).toBeVisible());
const panel = async (canvasElement: HTMLElement) =>
  within(await screen(canvasElement).findByRole('dialog'));

export const Playground: Story = {
  play: async ({ canvasElement }) => {
    const view = await panel(canvasElement);
    await visible(await view.findByRole('heading', { name: /11/ }));
    await visible(await view.findByText('Payment · package'));
    await visible(await view.findByText(/lessons left after this one/));
  },
};

/** The «⋯» menu of a scheduled lesson: a no-show waits for the start. */
export const Menu: Story = {
  play: async ({ canvasElement }) => {
    const view = await panel(canvasElement);
    await userEvent.click(await view.findByRole('button', { name: 'More actions' }));
    const noShow = await screen(canvasElement).findByRole('menuitem', { name: /no-show/ });
    await expect(noShow).toHaveAttribute('aria-disabled', 'true');
    await visible(screen(canvasElement).getByRole('menuitem', { name: 'Delete lesson' }));
  },
};

/** A long history expands in place and collapses again. */
export const HistoryExpanded: Story = {
  args: { state: 'cancelledChargedWithMakeup' },
  play: async ({ canvasElement }) => {
    const view = await panel(canvasElement);
    await userEvent.click(await view.findByRole('button', { name: /Show the whole history/ }));
    await visible(await view.findByRole('button', { name: 'Collapse the history' }));
  },
};

/** Edit in the panel: the price of a paid lesson is locked (board 03). */
export const Edit: Story = {
  args: { state: 'heldPaid' },
  play: async ({ canvasElement }) => {
    const view = await panel(canvasElement);
    await userEvent.click(await view.findByRole('button', { name: 'Edit' }));
    await visible(await view.findByRole('heading', { name: 'Edit lesson' }));
    await expect(view.getByLabelText('Price')).toBeDisabled();
    await visible(view.getByText('The lesson is paid — its price can no longer change'));
  },
};

/** Edit a group lesson (board 03, the group state): the group card is locked; no price (S01). */
export const EditGroup: Story = {
  args: { state: 'groupScheduled' },
  play: async ({ canvasElement }) => {
    const view = await panel(canvasElement);
    await userEvent.click(await view.findByRole('button', { name: 'Edit' }));
    await visible(await view.findByRole('heading', { name: 'Edit lesson' }));
    await visible(view.getByRole('img', { name: "The lesson's group can't change" }));
    await expect(view.queryByLabelText('Price')).toBeNull();
    await expect(view.getByRole('combobox', { name: 'Length' })).toHaveValue('90');
  },
};

/** Cancel three hours before the start: the deadline suggests charging (board 04). */
export const CancelLate: Story = {
  args: { clock: 'lateCancel' },
  play: async ({ canvasElement }) => {
    const view = await panel(canvasElement);
    await userEvent.click(await view.findByRole('button', { name: 'Cancel lesson' }));
    const dialog = within(
      await screen(canvasElement).findByRole('dialog', { name: 'Cancel the lesson?' }),
    );
    await visible(await dialog.findByText('Late cancellation'));
    await expect(dialog.getByRole('radio', { name: /Charge the lesson/ })).toBeChecked();
    await userEvent.click(dialog.getByRole('radio', { name: 'Teacher' }));
    await expect(dialog.getByRole('radio', { name: /Don't charge/ })).toBeChecked();
  },
};

/** Correct a held lesson to a no-show, with what it changes (board 05). */
export const StatusFix: Story = {
  args: { state: 'heldPackage' },
  play: async ({ canvasElement }) => {
    const view = await panel(canvasElement);
    await userEvent.click(await view.findByRole('button', { name: 'Fix status' }));
    const dialog = within(await screen(canvasElement).findByRole('dialog', { name: 'Fix status' }));
    await expect(dialog.getByRole('radio', { name: /didn't come/ })).toBeChecked();
    await visible(await dialog.findByText('A miss appears in the statistics'));
  },
};

/** A new time for a schedule lesson asks what to move, with the numbers (board 06). */
export const Move: Story = {
  play: async ({ canvasElement }) => {
    const view = await panel(canvasElement);
    await userEvent.click(await view.findByRole('button', { name: 'Move' }));
    fireEvent.change(await view.findByLabelText('Start'), { target: { value: '18:30' } });
    await userEvent.click(view.getByRole('button', { name: 'Save changes' }));
    const dialog = within(
      await screen(canvasElement).findByRole('dialog', { name: 'Move a schedule lesson' }),
    );
    await visible(await dialog.findByText('14 lessons are rebuilt'));
    await expect(dialog.getByRole('button', { name: 'Move 14 lessons' })).toBeEnabled();
  },
};

/** The move overlaps two lessons: variant C, with "save anyway" (board 10). */
export const Conflict: Story = {
  play: async ({ canvasElement }) => {
    const view = await panel(canvasElement);
    await userEvent.click(await view.findByRole('button', { name: 'Move' }));
    fireEvent.change(await view.findByLabelText('Start'), { target: { value: '18:30' } });
    await userEvent.click(view.getByRole('button', { name: 'Save changes' }));
    const move = within(
      await screen(canvasElement).findByRole('dialog', { name: 'Move a schedule lesson' }),
    );
    await userEvent.click(await move.findByRole('button', { name: 'Move 14 lessons' }));
    const dialog = within(
      await screen(canvasElement).findByRole('dialog', { name: 'The time overlaps 2 lessons' }),
    );
    await visible(dialog.getByText('Dmytro Tutor teaches both'));
    await visible(dialog.getByText('Anna Shevchenko is in both'));
    await userEvent.click(dialog.getByRole('button', { name: 'Save anyway' }));
    await waitFor(() =>
      expect(screen(canvasElement).queryByRole('dialog', { name: /overlaps/ })).toBeNull(),
    );
  },
};

/** A makeup for a no-show is free (board 07). */
export const Makeup: Story = {
  args: { state: 'noShow' },
  play: async ({ canvasElement }) => {
    const view = await panel(canvasElement);
    await userEvent.click(await view.findByRole('button', { name: 'Assign a makeup' }));
    const dialog = within(
      await screen(canvasElement).findByRole('dialog', { name: 'Assign a makeup' }),
    );
    await visible(await dialog.findByText('The makeup is free'));
  },
};

/** Attendance of a running group lesson; the paused member is not marked (board 08). */
export const Attendance: Story = {
  args: { state: 'groupRunning' },
  play: async ({ canvasElement }) => {
    const view = await panel(canvasElement);
    await userEvent.click(await view.findByRole('button', { name: 'Mark attendance' }));
    const dialog = within(await screen(canvasElement).findByRole('dialog', { name: 'Attendance' }));
    await userEvent.click(await dialog.findByRole('button', { name: 'Everyone came' }));
    await visible(await dialog.findByText('Charging 5 of 5 members'));
    await visible(dialog.getByText('Not marked and not charged'));
  },
};

/** Deleting a charged lesson offers a free cancellation instead (board 09). */
export const DeleteCharged: Story = {
  args: { state: 'heldPackage' },
  play: async ({ canvasElement }) => {
    const view = await panel(canvasElement);
    await userEvent.click(await view.findByRole('button', { name: 'More actions' }));
    await userEvent.click(
      await screen(canvasElement).findByRole('menuitem', { name: 'Delete lesson' }),
    );
    const dialog = within(
      await screen(canvasElement).findByRole('dialog', { name: "Can't delete it" }),
    );
    await visible(dialog.getByRole('button', { name: 'Cancel free' }));
  },
};

/** A deleted lesson says so instead of an empty panel. */
export const NotFound: Story = {
  args: { state: 'notFound' },
  play: async ({ canvasElement }) => {
    const view = await panel(canvasElement);
    await visible(await view.findByRole('heading', { name: 'Lesson not found' }));
  },
};

/** The page opens the panel from its own `?lesson=` link. */
export const DeepLink: Story = {
  render: () => (
    <StoryBackend>
      <StoryAppShell pathname={`/app/students/${STUDENT_ID}`}>
        <StudentDetailView studentId={STUDENT_ID} />
      </StoryAppShell>
    </StoryBackend>
  ),
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: `/app/students/${STUDENT_ID}`,
        query: { lesson: LESSON_STATES.scheduledOneOff },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const view = await panel(canvasElement);
    await visible(await view.findByText('Payment · single lesson'));
  },
};
