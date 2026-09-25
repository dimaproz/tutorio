import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { CALENDAR_CLOCK } from '@/stories/calendar-story-backend';
import { forceMobileMediaQuery, MOBILE_VIEWPORT } from '@/stories/story-helpers';
import { StoryBackend } from '@/stories/story-backend';
import { StoryAppShell } from '@/stories/story-shell';
import type { CalendarView } from '../model/period';
import { CalendarPage } from './calendar-page';

type Args = {
  view: CalendarView;
  teachers: 'school' | 'solo';
  lessons: 'ready' | 'empty' | 'pending' | 'error';
};

/**
 * The calendar (S03) against the story backend: the boards' week of 21–27
 * September 2026 with the clock on Thursday 24th at 18:40. `view` is the
 * remembered view, `teachers` a studio with Dmytro alone, `lessons` the empty,
 * loading and failed reads. The phone stories force the phone layout.
 */
function CalendarScreen({ view, teachers, lessons }: Args) {
  try {
    window.localStorage.setItem('tutorio.calendar.view', view);
    window.localStorage.setItem('tutorio.calendar.view.phone', view);
  } catch {
    // Storage may be blocked; the calendar falls back to its default view.
  }
  return (
    <StoryBackend calendar={{ lessons, teachers }} lessonCreate={{}}>
      <StoryAppShell pathname="/app/calendar">
        <CalendarPage nowMs={CALENDAR_CLOCK} />
      </StoryAppShell>
    </StoryBackend>
  );
}

const meta = {
  title: 'Calendar/Screens/Calendar',
  component: CalendarScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
  args: { view: 'week', teachers: 'school', lessons: 'ready' },
  argTypes: {
    view: { control: 'inline-radio', options: ['day', 'week', 'month'] },
    teachers: { control: 'inline-radio', options: ['school', 'solo'] },
    lessons: { control: 'inline-radio', options: ['ready', 'empty', 'pending', 'error'] },
  },
} satisfies Meta<typeof CalendarScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const HOUR = 44;

async function lessonCard(canvasElement: HTMLElement, name: RegExp) {
  return within(canvasElement).findByRole('button', { name });
}

/** Presses a lesson and drags it onto a weekday column at `minutes`. */
async function dragLesson(
  canvasElement: HTMLElement,
  card: HTMLElement,
  dayIndex: number,
  minutes: number,
  release: boolean,
) {
  const column = canvasElement.querySelector<HTMLElement>(`[data-day="${dayIndex}"]`)!;
  const from = card.getBoundingClientRect();
  const to = column.getBoundingClientRect();
  const startX = from.left + 12;
  const startY = from.top + 5;
  const x = to.left + to.width / 2;
  const y = to.top + (minutes / 60) * HOUR + 5;
  await userEvent.pointer([
    { keys: '[MouseLeft>]', target: card, coords: { clientX: startX, clientY: startY } },
    { coords: { clientX: startX + 12, clientY: startY + 12 } },
    { coords: { clientX: x, clientY: y } },
    ...(release ? [{ keys: '[/MouseLeft]' }] : []),
  ]);
}

/** 01 · The week for Dmytro: held, a no-show, a cancelled one, a group running now. */
export const Week: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
    await expect(await canvas.findByText('Dmytro Tutor · 15 lessons this week')).toBeVisible();
    await expect(
      await lessonCard(canvasElement, /^18:00–19:30, B2 prep · evening, group, running now/),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: /Sofiia Melnyk, individual, cancelled/ }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: /Maksym Tkachenko, individual, held, unpaid/ }),
    ).toBeVisible();
    await expect(canvas.getByRole('list', { name: 'Legend' })).toBeVisible();
  },
};

/** 02 · Three teachers: the colour stays the type, the teacher is a mark and a legend. */
export const SeveralTeachers: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Dmytro Tutor' }));
    const menu = within(await within(document.body).findByRole('dialog'));
    await userEvent.click(menu.getByLabelText('Iryna Bondar'));
    await userEvent.click(menu.getByLabelText('Oleh Marchenko'));
    await userEvent.keyboard('{Escape}');
    await expect(await canvas.findByText('3 teachers · 23 lessons this week')).toBeVisible();
    await expect(canvas.getByRole('button', { name: /Olha Savchuk/ })).toBeVisible();
    const legend = within(canvas.getByRole('list', { name: 'Legend' }));
    await expect(legend.getByText('Iryna')).toBeVisible();
  },
};

/** 03 · The status menu with the week's counts; cancelled lessons hidden. */
export const StatusFilter: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: /^Status/ }));
    const menu = within(await within(document.body).findByRole('dialog'));
    await userEvent.click(menu.getByLabelText('Cancelled'));
    await userEvent.click(menu.getByRole('button', { name: 'Done' }));
    await expect(
      await canvas.findByText('Dmytro Tutor · 14 lessons · cancelled hidden'),
    ).toBeVisible();
    await expect(
      canvas.queryByRole('button', { name: /Sofiia Melnyk, individual, cancelled/ }),
    ).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: /^Status/ }));
    const show = await within(document.body).findByText('Show');
    // The menu fades in: wait for it rather than catch it mid-animation.
    await waitFor(() => expect(show).toBeVisible());
  },
};

/** 04 · Dragging: the old slot stays as a ghost, the card shows the new date and time. */
export const Dragging: Story = {
  play: async ({ canvasElement }) => {
    const card = await lessonCard(
      canvasElement,
      /^17:00–18:00, Anna Shevchenko, individual, ahead/,
    );
    await dragLesson(canvasElement, card, 4, 14 * 60, false);
    await expect(await within(canvasElement).findByText(/Fri, September 25 · 14:00/)).toBeVisible();
    await expect(
      await within(canvasElement).findByText('Release to move · Esc to cancel'),
    ).toBeVisible();
  },
};

/** 05 · Over an occupied slot the card turns red and names the overlap. */
export const DraggingOntoConflict: Story = {
  play: async ({ canvasElement }) => {
    const card = await lessonCard(
      canvasElement,
      /^17:00–18:00, Anna Shevchenko, individual, ahead/,
    );
    await dragLesson(canvasElement, card, 4, 18 * 60, false);
    await expect(
      await within(canvasElement).findByText(/Overlaps Sofiia Melnyk · 18:30/),
    ).toBeVisible();
  },
};

/** Esc puts the lesson back. */
export const DragCancelled: Story = {
  play: async ({ canvasElement }) => {
    const card = await lessonCard(
      canvasElement,
      /^17:00–18:00, Anna Shevchenko, individual, ahead/,
    );
    await dragLesson(canvasElement, card, 4, 14 * 60, false);
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(within(canvasElement).queryByText('Release to move · Esc to cancel')).toBeNull(),
    );
    await userEvent.pointer({ keys: '[/MouseLeft]' });
  },
};

/** 06 · Dropping a schedule lesson asks «This lesson only / This and the following». */
export const MoveScope: Story = {
  play: async ({ canvasElement }) => {
    const card = await lessonCard(
      canvasElement,
      /^17:00–18:00, Anna Shevchenko, individual, ahead/,
    );
    await dragLesson(canvasElement, card, 4, 14 * 60, true);
    const dialog = within(await within(document.body).findByRole('dialog', {}, { timeout: 5000 }));
    await expect(dialog.getByText('Move a schedule lesson')).toBeVisible();
    await expect(dialog.getByRole('radio', { name: /This lesson only/ })).toBeChecked();
  },
};

/** 07 · A drop onto a conflict opens the S01 conflict dialog with «Save anyway». */
export const MoveConflict: Story = {
  play: async ({ canvasElement }) => {
    const card = await lessonCard(
      canvasElement,
      /^17:00–18:00, Anna Shevchenko, individual, ahead/,
    );
    await dragLesson(canvasElement, card, 4, 18 * 60, true);
    const scope = within(await within(document.body).findByRole('dialog', {}, { timeout: 5000 }));
    await userEvent.click(scope.getByRole('button', { name: 'Move the lesson' }));
    const conflict = within(
      await within(document.body).findByRole(
        'dialog',
        { name: /The time overlaps/ },
        { timeout: 5000 },
      ),
    );
    await expect(conflict.getByRole('button', { name: /Save anyway/ })).toBeVisible();
  },
};

/** A lesson outside a schedule moves at once, and the toast offers to undo it. */
export const MoveWithUndo: Story = {
  play: async ({ canvasElement }) => {
    const card = await lessonCard(canvasElement, /^12:00–12:45, Daryna Kravets, individual, ahead/);
    await dragLesson(canvasElement, card, 4, 13 * 60, true);
    const toastTitle = await within(document.body).findByText(/Daryna Kravets — Fri, September 25/);
    await waitFor(() => expect(toastTitle).toBeVisible());
    await expect(within(document.body).getByRole('button', { name: 'Undo' })).toBeVisible();
    await expect(await lessonCard(canvasElement, /^13:00–13:45, Daryna Kravets/)).toBeVisible();
  },
};

/** 08 · A click on empty time marks the slot and opens the lesson form at that time. */
export const PickSlot: Story = {
  play: async ({ canvasElement }) => {
    await lessonCard(canvasElement, /^15:00–16:00, Anna Shevchenko/);
    const column = canvasElement.querySelector<HTMLElement>('[data-day="4"]')!;
    const rect = column.getBoundingClientRect();
    await userEvent.pointer({
      keys: '[MouseLeft]',
      target: column,
      coords: { clientX: rect.left + 20, clientY: rect.top + 14 * HOUR + 10 },
    });
    const form = within(await within(document.body).findByRole('dialog', {}, { timeout: 5000 }));
    await expect(await form.findByText('New lesson')).toBeVisible();
    await expect(await form.findByDisplayValue('14:00')).toBeVisible();
  },
};

/** 09 · The day: wide cards with status badges, the week strip and the day's summary. */
export const Day: Story = {
  args: { view: 'day' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Running now')).toBeVisible();
    await expect(canvas.getByText('3 lessons · 3.5 h')).toBeVisible();
    await expect(canvas.getByText('Makeup at 19:45')).toBeVisible();
    await expect(canvas.getByText('Free 16:00–18:00')).toBeVisible();
  },
};

/** 10 · The month: up to three chips a day, then «+N more». */
export const Month: Story = {
  args: { view: 'month' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { level: 2, name: 'September 2026' }),
    ).toBeVisible();
    await expect(
      (await canvas.findAllByRole('button', { name: /\+1 more/ })).length,
    ).toBeGreaterThan(0);
  },
};

/** 11 · «+N more» lists the whole day and opens it. */
export const MonthMore: Story = {
  args: { view: 'month' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click((await canvas.findAllByRole('button', { name: /\+1 more/ }))[0]!);
    const list = within(await within(document.body).findByRole('dialog'));
    // The day list fades in: wait for it rather than catch it mid-animation.
    await waitFor(() => expect(list.getByRole('button', { name: 'Open the day' })).toBeVisible());
    await userEvent.click(list.getByRole('button', { name: 'Open the day' }));
    await expect(await canvas.findByRole('radio', { name: 'Day', checked: true })).toBeVisible();
  },
};

/** 12 · An empty week names the next lesson and offers a new one. */
export const EmptyWeek: Story = {
  args: { lessons: 'empty' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No lessons this week')).toBeVisible();
    await expect(await canvas.findByText(/The next lesson is on Mon, October 5/)).toBeVisible();
    await expect(canvas.getByRole('button', { name: /To October 5/ })).toBeVisible();
  },
};

/** 13 · Loading: placeholder blocks in the grid. */
export const Loading: Story = {
  args: { lessons: 'pending' },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Loading…')).toBeVisible();
  },
};

/** 14 · A failed read, with «Try again». */
export const LoadError: Story = {
  args: { lessons: 'error' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Couldn’t load the lessons')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Try again' })).toBeVisible();
  },
};

/** The view switch and the arrows. */
export const SwitchViews: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('radio', { name: 'Month' }));
    await expect(
      await canvas.findByRole('heading', { level: 2, name: 'September 2026' }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Next month' }));
    await expect(
      await canvas.findByRole('heading', { level: 2, name: 'October 2026' }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Today' }));
    await userEvent.click(canvas.getByRole('radio', { name: 'Week' }));
    await expect(await canvas.findByText('Dmytro Tutor · 15 lessons this week')).toBeVisible();
  },
};

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

/** Phone 01 · The day: week strip with dots, the day line, the grid and «+». */
export const PhoneDay: Story = {
  args: { view: 'day' },
  globals: MOBILE_VIEWPORT,
  beforeEach: forceMobileMediaQuery,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { level: 2, name: 'Thu, September 24' }),
    ).toBeVisible();
    await expect(await canvas.findByText('3 lessons · 3.5 h')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'New lesson' })).toBeVisible();
  },
};

/** Phone 02 · A free day: «New lesson on …» and «To the next lesson». */
export const PhoneFreeDay: Story = {
  args: { view: 'day' },
  globals: MOBILE_VIEWPORT,
  beforeEach: forceMobileMediaQuery,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: /Sunday, September 27/ }));
    await expect(await canvas.findByText('A free day')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'New lesson on September 27' })).toBeVisible();
  },
};

/** Phone 03 · The week as an agenda grouped by day. */
export const PhoneWeek: Story = {
  args: { view: 'week' },
  globals: MOBILE_VIEWPORT,
  beforeEach: forceMobileMediaQuery,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('heading', { level: 2, name: /Mon, September 21/ }),
    ).toBeVisible();
    await expect(canvas.getAllByText('60 min · individual').length).toBeGreaterThan(0);
  },
};

/** Phone 04 · The month as dots, the picked day's lessons under it. */
export const PhoneMonth: Story = {
  args: { view: 'month' },
  globals: MOBILE_VIEWPORT,
  beforeEach: forceMobileMediaQuery,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/Thursday, September 24 · 3 lessons/)).toBeVisible();
  },
};

/** Phone 05 · Filters in a sheet, «Show N lessons» applies them. */
export const PhoneFilters: Story = {
  args: { view: 'day' },
  globals: MOBILE_VIEWPORT,
  beforeEach: forceMobileMediaQuery,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: /^Filters/ }));
    const sheet = within(await within(document.body).findByRole('dialog'));
    await expect(sheet.getByText('Teachers')).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Show 3 lessons' })).toBeVisible();
  },
};

/** Phone 07 · Loading. */
export const PhoneLoading: Story = {
  args: { view: 'day', lessons: 'pending' },
  globals: MOBILE_VIEWPORT,
  beforeEach: forceMobileMediaQuery,
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole('heading', { level: 1, name: 'Calendar' }),
    ).toBeVisible();
  },
};

/** Phone 08 · A failed read. */
export const PhoneError: Story = {
  args: { view: 'day', lessons: 'error' },
  globals: MOBILE_VIEWPORT,
  beforeEach: forceMobileMediaQuery,
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Couldn’t load the lessons')).toBeVisible();
  },
};
