import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { getRouter } from '@storybook/nextjs-vite/navigation.mock';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ScheduleCreateDialog } from '@/features/lessons';
import { CREATE_GROUP_ID, CREATE_STUDENT_ID } from '@/stories/lesson-create-story-backend';
import { SCHEDULES_CLOCK } from '@/stories/schedules-story-backend';
import { forceMobileMediaQuery, MOBILE_VIEWPORT } from '@/stories/story-helpers';
import { StoryBackend } from '@/stories/story-backend';
import { StoryAppShell } from '@/stories/story-shell';
import { SchedulesPage } from './schedules-page';

type Args = {
  schedules: 'ready' | 'empty' | 'pending' | 'error';
  teachers: 'school' | 'solo';
  /** New schedules and changes overlap other lessons until forced. */
  conflicts: boolean;
  /** Anna already has a schedule with Dmytro. */
  exists: boolean;
  /** The new schedule form open over the page, for a student or a group. */
  form: 'none' | 'student' | 'group';
};

/**
 * The Schedules page (S05) against the story backend: the boards' sixteen
 * active schedules and three ended ones, the clock on Thursday 24 September
 * at noon. `form` opens «Новий розклад» for Anna or for B2 prep, `exists`
 * gives Anna a schedule with Dmytro already, `conflicts` makes new lessons
 * and Sofiia's change overlap others. The phone stories force the phone.
 */
function SchedulesScreen({ schedules, teachers, conflicts, exists, form }: Args) {
  const [open, setOpen] = useState(form !== 'none');
  return (
    <StoryBackend
      schedulesList={{ schedules, conflicts }}
      lessonCreate={{ billing: 'package', schedule: exists }}
      mode={teachers === 'solo' ? 'SOLO' : 'SCHOOL'}
    >
      <StoryAppShell pathname="/app/schedules">
        <SchedulesPage nowMs={SCHEDULES_CLOCK} />
        {form !== 'none' ? (
          <ScheduleCreateDialog
            open={open}
            onOpenChange={setOpen}
            nowMs={SCHEDULES_CLOCK}
            initial={
              form === 'group' ? { groupId: CREATE_GROUP_ID } : { studentId: CREATE_STUDENT_ID }
            }
          />
        ) : null}
      </StoryAppShell>
    </StoryBackend>
  );
}

const meta = {
  title: 'Schedules/Screens/Schedules',
  component: SchedulesScreen,
  parameters: {
    layout: 'fullscreen',
    fullBleed: true,
    nextjs: { appDirectory: true, navigation: { pathname: '/app/schedules', query: {} } },
  },
  args: { schedules: 'ready', teachers: 'school', conflicts: false, exists: false, form: 'none' },
  argTypes: {
    schedules: { control: 'inline-radio', options: ['ready', 'empty', 'pending', 'error'] },
    teachers: { control: 'inline-radio', options: ['school', 'solo'] },
    form: { control: 'inline-radio', options: ['none', 'student', 'group'] },
  },
} satisfies Meta<typeof SchedulesScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);
const lastUrl = () => String(getRouter().replace.mock.calls.at(-1)?.[0] ?? '');
const visible = (element: HTMLElement) => waitFor(() => expect(element).toBeVisible());

async function rowAction(canvasElement: HTMLElement, name: string, action: string) {
  const table = within(await within(canvasElement).findByRole('table'));
  await userEvent.click(
    await table.findByRole('button', { name: `Actions for the schedule of ${name}` }),
  );
  const menu = within(await body().findByRole('menu'));
  await waitFor(() => expect(menu.getByRole('menuitem', { name: action })).toBeVisible());
  await userEvent.click(menu.getByRole('menuitem', { name: action }));
}

/** 01 · Active schedules by the next lesson: slots, state, next lesson. */
export const Playground: Story = {
  play: async ({ canvas }) => {
    await visible(await canvas.findByRole('heading', { level: 1, name: 'Schedules' }));
    const table = await canvas.findByRole('table');
    await waitFor(() =>
      expect(canvas.getByRole('radio', { name: /^Active/ })).toHaveTextContent('16'),
    );
    await visible(within(table).getByText('today 18:00'));
    await visible(within(table).getByText('Changes Oct 1'));
    await visible(within(table).getByText('Until Oct 31'));
  },
};

/** 02 · «Зі змінами» writes the URL. */
export const ChangingTab: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('radio', { name: /^Changing/ }));
    await waitFor(() => expect(lastUrl()).toBe('/app/schedules?state=CHANGING'));
  },
};

/** 03 · Ended schedules as they arrive in the URL: muted, no next lesson. */
export const Ended: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: '/app/schedules', query: { state: 'ENDED' } },
    },
  },
  play: async ({ canvas }) => {
    const table = await canvas.findByRole('table');
    await expect(await within(table).findAllByText('Ended')).toHaveLength(3);
    await visible(within(table).getByText('Summer intensive'));
  },
};

/** 04 · The row menu. */
export const RowMenu: Story = {
  play: async ({ canvasElement }) => {
    const table = within(await within(canvasElement).findByRole('table'));
    await userEvent.click(
      await table.findByRole('button', { name: 'Actions for the schedule of Anna Shevchenko' }),
    );
    const menu = within(await body().findByRole('menu'));
    await waitFor(() =>
      expect(menu.getByRole('menuitem', { name: 'Change the schedule' })).toBeVisible(),
    );
    await visible(menu.getByRole('menuitem', { name: 'Weeks ahead' }));
    await visible(menu.getByRole('menuitem', { name: 'Open the student' }));
    await visible(menu.getByRole('menuitem', { name: 'Stop the schedule' }));
    // Closed again, so the page is checked without the menu's modal layer.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body().queryByRole('menu')).toBeNull());
  },
};

/** 05 · Nothing matches: the search named, «Скинути фільтри». */
export const NoResults: Story = {
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/app/schedules', query: { q: 'zzz' } } },
  },
  play: async ({ canvas }) => {
    await visible(await canvas.findByText('No schedules match these filters'));
    await userEvent.click(canvas.getByRole('button', { name: 'Reset the filters' }));
    await waitFor(() => expect(lastUrl()).toBe('/app/schedules'));
  },
};

/** 06 · A studio with no schedule. */
export const Empty: Story = {
  args: { schedules: 'empty' },
  play: async ({ canvas }) => {
    await visible(await canvas.findByText('No schedules yet'));
  },
};

/** 07 · Loading. */
export const Loading: Story = { args: { schedules: 'pending' } };

/** 08 · The failed read. */
export const LoadError: Story = {
  args: { schedules: 'error' },
  play: async ({ canvas }) => {
    await visible(await canvas.findByText('The schedules could not be loaded'));
  },
};

/** 09 · Solo: no teacher column and no teacher filter. */
export const Solo: Story = {
  args: { teachers: 'solo' },
  play: async ({ canvas }) => {
    const table = await canvas.findByRole('table');
    await expect(within(table).queryByRole('columnheader', { name: 'Teacher' })).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Teacher' })).toBeNull();
  },
};

// ---------------------------------------------------------------------------
// New schedule (board 02)
// ---------------------------------------------------------------------------

async function formDialog() {
  return within(await body().findByRole('dialog', { name: 'New schedule' }));
}

async function pickDays(form: ReturnType<typeof within>, days: RegExp[]) {
  for (const day of days) await userEvent.click(await form.findByRole('button', { name: day }));
}

/** 01 · For Anna: days with a time each, length, weeks ahead, first day; the footer counts. */
export const NewForStudent: Story = {
  args: { form: 'student' },
  play: async () => {
    const form = await formDialog();
    await visible(await form.findByText('Anna Shevchenko'));
    await pickDays(form, [/^Mon/, /^Thu/]);
    await visible(await form.findByText(/Creates/));
    await expect(form.getAllByText('4 weeks').length).toBeGreaterThan(0);
  },
};

/** 02 · For a group: its teacher runs the schedule. */
export const NewForGroup: Story = {
  args: { form: 'group' },
  play: async () => {
    const form = await formDialog();
    await visible(await form.findByText("The group's teacher runs its schedule"));
  },
};

/** 04 · Errors under their fields. */
export const NewErrors: Story = {
  args: { form: 'student' },
  play: async () => {
    const form = await formDialog();
    await visible(await form.findByText('Anna Shevchenko'));
    await userEvent.click(form.getByRole('button', { name: 'Next' }));
    await visible(await form.findByText(/at least one weekday/));
  },
};

/** 05 · The check: the dates and what comes next; the create saves. */
export const NewCreate: Story = {
  args: { form: 'student' },
  play: async () => {
    const form = await formDialog();
    await visible(await form.findByText('Anna Shevchenko'));
    await pickDays(form, [/^Mon/, /^Thu/]);
    await visible(await form.findByText(/Creates/));
    await userEvent.click(form.getByRole('button', { name: 'Next' }));
    const check = within(await body().findByRole('dialog', { name: 'Check the schedule' }));
    await visible(check.getByText('Then — automatically'));
    await visible(check.getByText("Paid from Anna's package"));
    await userEvent.click(check.getByRole('button', { name: 'Create the schedule' }));
    await visible(await body().findByText('The schedule of Anna Shevchenko is created'));
  },
};

/** 06 · Conflicts name what they overlap; the save goes through with force (L-111). */
export const NewConflicts: Story = {
  args: { form: 'student', conflicts: true },
  play: async () => {
    const form = await formDialog();
    await visible(await form.findByText('Anna Shevchenko'));
    await pickDays(form, [/^Mon/, /^Thu/]);
    await visible(await form.findByText(/Creates/));
    await userEvent.click(form.getByRole('button', { name: 'Next' }));
    const check = within(await body().findByRole('dialog', { name: 'Check the schedule' }));
    await visible(check.getByText('2 new lessons overlap others'));
    await expect(check.getAllByText('B2 prep · evening').length).toBeGreaterThan(0);
    await userEvent.click(check.getByRole('button', { name: 'Create despite overlaps' }));
    await visible(await body().findByText('The schedule of Anna Shevchenko is created'));
  },
};

/** 03 · A schedule already exists (L-20): the callout opens it, «Далі» is off. */
export const NewExists: Story = {
  args: { form: 'student', exists: true },
  play: async () => {
    const form = await formDialog();
    await visible(
      await form.findByText('Anna Shevchenko already has a schedule with Dmytro Tutor'),
    );
    await expect(form.getByRole('button', { name: 'Next' })).toBeDisabled();
    await userEvent.click(form.getByRole('button', { name: 'Open the schedule' }));
    await visible(await body().findByRole('dialog', { name: 'Change the schedule' }));
  },
};

// ---------------------------------------------------------------------------
// Change, stop, horizon (board 03)
// ---------------------------------------------------------------------------

/** 01 → 02 · The change form, then its consequences, then the save and the toast. */
export const Change: Story = {
  play: async ({ canvasElement }) => {
    await rowAction(canvasElement, 'Sofiia Melnyk', 'Change the schedule');
    const change = within(await body().findByRole('dialog', { name: 'Change the schedule' }));
    await visible(change.getByText('Changes take effect from'));
    await userEvent.click(change.getByRole('button', { name: 'Next' }));
    const result = within(
      await body().findByRole('dialog', { name: 'What changes from October 1' }),
    );
    await visible(result.getByText('4 Tuesdays — to 18:00'));
    await visible(result.getByText('1 loses its topic and notes'));
    await userEvent.click(result.getByRole('button', { name: 'Save the changes' }));
    await visible(
      await body().findByText(
        'The schedule of Sofiia Melnyk changes from October 1 · 4 moved, 3 removed',
      ),
    );
  },
};

/** 04 · A change that overlaps: the pair, and «Зберегти попри накладку». */
export const ChangeConflict: Story = {
  args: { conflicts: true },
  play: async ({ canvasElement }) => {
    await rowAction(canvasElement, 'Sofiia Melnyk', 'Change the schedule');
    const change = within(await body().findByRole('dialog', { name: 'Change the schedule' }));
    await userEvent.click(await change.findByRole('button', { name: 'Next' }));
    const result = within(
      await body().findByRole('dialog', { name: 'What changes from October 1' }),
    );
    await visible(result.getByText('1 new lesson overlaps another one'));
    // The booked lesson is a makeup, and the pair says so.
    await visible(result.getByText('Already booked · makeup'));
    await userEvent.click(result.getByRole('button', { name: 'Save despite the overlap' }));
    await visible(await body().findByText(/changes from October 1/));
  },
};

/** 05 · Stop: what goes and what stays; the stop is destructive. */
export const Stop: Story = {
  play: async ({ canvasElement }) => {
    await rowAction(canvasElement, 'Anna Shevchenko', 'Stop the schedule');
    const stop = within(await body().findByRole('dialog', { name: 'Stop the schedule' }));
    await visible(await stop.findByText('7 lessons are removed'));
    await visible(stop.getByText('1 stays — moved by hand'));
    await userEvent.click(stop.getByRole('button', { name: 'Stop the schedule' }));
    await visible(await body().findByText(/The schedule of Anna Shevchenko stops from/));
  },
};

/** 06 · Weeks ahead: a longer horizon says what it adds. */
export const Horizon: Story = {
  play: async ({ canvasElement }) => {
    await rowAction(canvasElement, 'B2 prep · evening', 'Weeks ahead');
    const horizon = within(await body().findByRole('dialog', { name: 'Weeks ahead' }));
    await userEvent.click(horizon.getByRole('radio', { name: '8 weeks' }));
    await visible(await horizon.findByText('8 lessons are added'));
    await userEvent.click(horizon.getByRole('button', { name: 'Save' }));
    await visible(await body().findByText('B2 prep · evening: lessons 8 weeks ahead'));
  },
};

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

/** Phone 01 · Cards with the slot chips, the state and the next lesson. */
export const PhoneList: Story = {
  globals: MOBILE_VIEWPORT,
  beforeEach: forceMobileMediaQuery,
};

/** Phone 06 · The new schedule form full screen. */
export const PhoneNew: Story = {
  args: { form: 'student' },
  globals: MOBILE_VIEWPORT,
  beforeEach: forceMobileMediaQuery,
};
