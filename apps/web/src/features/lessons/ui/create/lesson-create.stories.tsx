import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { GroupDetailView } from '@/features/groups';
import { StudentDetailView } from '@/features/students';
import {
  CREATE_CLOCK,
  CREATE_GROUP_ID,
  CREATE_STUDENT_ID,
  type CreateBilling,
} from '@/stories/lesson-create-story-backend';
import { StoryBackend } from '@/stories/story-backend';
import { StoryAppShell } from '@/stories/story-shell';
import { LessonCreateDialog, type LessonCreateInitial } from './lesson-create-dialog';

type Scenario = {
  page: 'student' | 'group';
  billing?: CreateBilling;
  schedule?: boolean;
  conflict?: boolean;
  solo?: boolean;
  search?: boolean;
  initial: LessonCreateInitial;
};

const anna = { studentId: CREATE_STUDENT_ID, date: '2026-10-01', time: '17:00' };

/** Every state of board 01 «NewLesson», by the scenario it needs. */
const STATES = {
  studentOneDate: { page: 'student', billing: 'package', schedule: true, initial: anna },
  studentSeveralDates: {
    page: 'student',
    billing: 'package',
    schedule: true,
    initial: {
      studentId: CREATE_STUDENT_ID,
      dates: [
        { date: '2026-10-01', time: '17:00' },
        { date: '2026-10-05', time: '17:00' },
        { date: '2026-10-08', time: '18:30' },
      ],
    },
  },
  packageRunningOut: {
    page: 'student',
    billing: 'runningOut',
    schedule: true,
    initial: {
      studentId: CREATE_STUDENT_ID,
      dates: [
        { date: '2026-10-01', time: '17:00' },
        { date: '2026-10-05', time: '17:00' },
        { date: '2026-10-08', time: '18:30' },
      ],
    },
  },
  group: {
    page: 'group',
    initial: { groupId: CREATE_GROUP_ID, date: '2026-10-06', time: '18:00' },
  },
  emptyForm: { page: 'student', initial: { date: '2026-10-01', time: '17:00' } },
  pickStudent: { page: 'student', search: true, initial: { date: '2026-10-01', time: '17:00' } },
  oneOff: { page: 'student', billing: 'noPackage', initial: anna },
  pastDate: {
    page: 'student',
    billing: 'package',
    schedule: true,
    initial: { studentId: CREATE_STUDENT_ID, date: '2026-09-22', time: '17:00' },
  },
  weeklyNewSchedule: { page: 'student', billing: 'package', initial: anna },
  weeklyExistingSchedule: { page: 'student', billing: 'package', schedule: true, initial: anna },
  errors: { page: 'student', initial: { date: '', time: '' } },
  solo: { page: 'student', billing: 'noPackage', solo: true, initial: anna },
  conflictOnSave: {
    page: 'student',
    billing: 'package',
    schedule: true,
    conflict: true,
    initial: { studentId: CREATE_STUDENT_ID, date: '2026-10-01', time: '18:30' },
  },
} satisfies Record<string, Scenario>;

type State = keyof typeof STATES;

type Args = { state: State; onOpenChange: (open: boolean) => void };

/**
 * The lesson form of S02 over the page it opens from: the student profile,
 * or the group page for a group. `state` picks the scenario of each board
 * state; the states reached by acting on the form (the search, another
 * teacher, the time list, a typed length, «Щотижня», the errors and the
 * conflict on save) are the named stories. Writes run against the in-memory
 * backend. The clock is noon on 30 September 2026.
 */
function NewLessonScreen({ state, onOpenChange }: Args) {
  const scenario: Scenario = STATES[state];
  const group = scenario.page === 'group';
  return (
    <StoryBackend
      key={state}
      mode={scenario.solo ? 'SOLO' : 'SCHOOL'}
      lessonCreate={{
        billing: scenario.billing,
        schedule: scenario.schedule,
        conflict: scenario.conflict,
      }}
    >
      <StoryAppShell
        pathname={group ? `/app/groups/${CREATE_GROUP_ID}` : `/app/students/${CREATE_STUDENT_ID}`}
      >
        {group ? (
          <GroupDetailView groupId={CREATE_GROUP_ID} />
        ) : (
          <StudentDetailView studentId={CREATE_STUDENT_ID} />
        )}
        <LessonCreateDialog
          open
          onOpenChange={onOpenChange}
          initial={scenario.initial}
          nowMs={CREATE_CLOCK}
          searchOnOpen={scenario.search}
        />
      </StoryAppShell>
    </StoryBackend>
  );
}

const meta = {
  title: 'Lessons/Screens/NewLesson',
  component: NewLessonScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
  args: { state: 'studentOneDate', onOpenChange: fn() },
  argTypes: {
    state: { control: 'select', options: Object.keys(STATES) },
    onOpenChange: { table: { disable: true } },
  },
} satisfies Meta<typeof NewLessonScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body);
const visible = (element: HTMLElement) => waitFor(() => expect(element).toBeVisible());
const dialog = async (canvasElement: HTMLElement) =>
  within(await body(canvasElement).findByRole('dialog', { name: 'New lesson' }));

/** Opened from Anna's profile: her package pays, one lesson leaves four of eight (state 01). */
export const Playground: Story = {
  play: async ({ canvasElement }) => {
    const form = await dialog(canvasElement);
    await visible(await form.findByText('4 of 8 left after this lesson'));
    await visible(form.getByRole('button', { name: 'Create the lesson' }));
  },
};

/** Three dates, each with its own time (state 02). */
export const SeveralDates: Story = {
  args: { state: 'studentSeveralDates' },
  play: async ({ canvasElement }) => {
    const form = await dialog(canvasElement);
    await visible(await form.findByRole('button', { name: 'Create 3 lessons' }));
    await visible(form.getByText('3 lessons from the package · 2 of 8 left'));
  },
};

/** The package covers the first date only; the rest go on its debt (state 03, L-82). */
export const PackageRunningOut: Story = {
  args: { state: 'packageRunningOut' },
  play: async ({ canvasElement }) => {
    const form = await dialog(canvasElement);
    await visible(await form.findByText('1 from the package + 2 on debt'));
  },
};

/** A group: the price per member is the group's, and who is paused is left out (state 04). */
export const Group: Story = {
  args: { state: 'group' },
  play: async ({ canvasElement }) => {
    const form = await dialog(canvasElement);
    await visible(await form.findByText(/will take part/));
    await expect(await form.findByLabelText('Price per member')).toBeDisabled();
  },
};

/** The search opens in the band: students with their package or pause (state 06). */
export const PickStudent: Story = {
  args: { state: 'pickStudent' },
  play: async ({ canvasElement }) => {
    const page = body(canvasElement);
    const input = await page.findByRole('combobox', { name: 'Name, phone or @telegram' });
    await userEvent.type(input, 'Anna');
    await userEvent.click(await page.findByRole('option', { name: /Anna Shevchenko/ }));
    const form = await dialog(canvasElement);
    await visible(await form.findByRole('button', { name: 'Change' }));
  },
};

/** Another teacher is a substitute; the price follows that teacher's rate (state 07). */
export const OtherTeacher: Story = {
  args: { state: 'oneOff' },
  play: async ({ canvasElement }) => {
    const form = await dialog(canvasElement);
    await userEvent.click(await form.findByRole('combobox', { name: 'Teacher' }));
    await userEvent.click(await body(canvasElement).findByRole('option', { name: /Iryna Bondar/ }));
    await visible(await form.findByText(/Substitute for/));
    await visible(await form.findByText('Updated'));
    await expect(form.getByLabelText('Price')).toHaveValue('450');
  },
};

/** The time list marks the slots B2 prep takes (state 08). */
export const TimeList: Story = {
  args: { state: 'studentOneDate' },
  play: async ({ canvasElement }) => {
    const form = await dialog(canvasElement);
    await userEvent.click(await form.findByRole('combobox', { name: 'Start' }));
    await visible(await body(canvasElement).findByRole('option', { name: /18:00.*B2 prep/ }));
  },
};

/** A typed length outside the list comes first; the hint gives hours and the end (state 09). */
export const CustomDuration: Story = {
  args: { state: 'oneOff' },
  play: async ({ canvasElement }) => {
    const form = await dialog(canvasElement);
    const length = await form.findByRole('combobox', { name: 'Length' });
    await userEvent.clear(length);
    await userEvent.type(length, '75');
    await userEvent.keyboard('{ArrowDown}');
    await visible(await body(canvasElement).findByRole('option', { name: /75 min/ }));
    await visible(form.getByText('1 h 15 min · until 18:15'));
  },
};

/** A past date records what happened, held by default (state 10, L-31). */
export const PastDate: Story = {
  args: { state: 'pastDate' },
  play: async ({ canvasElement }) => {
    const form = await dialog(canvasElement);
    await visible(await form.findByText('Date in the past'));
    await expect(form.getByRole('radio', { name: /Held/ })).toBeChecked();
    await visible(form.getByRole('button', { name: 'Record the lesson' }));
  },
};

/** «Щотижня» for a direction without a schedule: what the new one creates and overlaps (state 11). */
export const WeeklyNewSchedule: Story = {
  args: { state: 'weeklyNewSchedule' },
  play: async ({ canvasElement }) => {
    const form = await dialog(canvasElement);
    await userEvent.click(await form.findByRole('radio', { name: 'Weekly' }));
    await userEvent.click(form.getByRole('button', { name: /Mon/ }));
    await userEvent.click(form.getByRole('button', { name: /Fri/ }));
    await visible(await form.findByText(/New schedule:/));
    await visible(form.getByText("We'll create 8 lessons 4 weeks ahead"));
    await visible(await form.findByText('No conflicts'));
    await visible(form.getByRole('button', { name: 'Create the schedule' }));
  },
};

/** «Щотижня» adds the day to the direction's schedule, with what it becomes (state 12, L-23). */
export const WeeklyExistingSchedule: Story = {
  args: { state: 'weeklyExistingSchedule' },
  play: async ({ canvasElement }) => {
    const form = await dialog(canvasElement);
    await userEvent.click(await form.findByRole('radio', { name: 'Weekly' }));
    await userEvent.click(form.getByRole('button', { name: /Wed/ }));
    await visible(await form.findByText(/already has a schedule with Dmytro Tutor/));
    await visible(await form.findByText(/We'll add 4 lessons/));
    await visible(form.getByRole('button', { name: 'Add to the schedule' }));
  },
};

/** Saving with nothing picked names what is missing (state 13). */
export const Errors: Story = {
  args: { state: 'errors' },
  play: async ({ canvasElement }) => {
    const form = await dialog(canvasElement);
    await userEvent.click(await form.findByRole('button', { name: 'Create the lesson' }));
    await visible(await form.findByText('Pick a student to create the lesson'));
    await visible(form.getByText('Enter a date'));
  },
};

/** A solo studio has no teacher field (state 14). */
export const Solo: Story = {
  args: { state: 'solo' },
  play: async ({ canvasElement }) => {
    const form = await dialog(canvasElement);
    await visible(await form.findByText('Your rate for Anna'));
    await expect(form.queryByRole('combobox', { name: 'Teacher' })).toBeNull();
  },
};

/** A save that overlaps opens the S01 conflict dialog; «Save anyway» books it (state 15). */
export const ConflictOnSave: Story = {
  args: { state: 'conflictOnSave' },
  play: async ({ args, canvasElement }) => {
    const form = await dialog(canvasElement);
    await userEvent.click(await form.findByRole('button', { name: 'Create the lesson' }));
    const conflict = within(await body(canvasElement).findByRole('dialog', { name: /overlaps/ }));
    await visible(await conflict.findByText('Dmytro Tutor teaches both'));
    await userEvent.click(conflict.getByRole('button', { name: 'Save anyway' }));
    await waitFor(() => expect(args.onOpenChange).toHaveBeenCalledWith(false));
  },
};
