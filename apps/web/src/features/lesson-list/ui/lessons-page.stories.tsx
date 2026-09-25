import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { getRouter } from '@storybook/nextjs-vite/navigation.mock';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { LESSON_LIST_CLOCK } from '@/stories/lesson-list-story-backend';
import { forceMobileMediaQuery, MOBILE_VIEWPORT } from '@/stories/story-helpers';
import { StoryBackend } from '@/stories/story-backend';
import { StoryAppShell } from '@/stories/story-shell';
import { LessonsPage } from './lessons-page';

type Args = {
  lessons: 'ready' | 'empty' | 'pending' | 'error';
  teachers: 'school' | 'solo';
};

const IRYNA = '55555555-5555-4555-8555-555555555556';
const SOFIIA = 'd6bf671d-7a0f-4cf3-8a67-000000000002';

/**
 * The Lessons page (S04) against the story backend: September 2026 of a
 * studio with three teachers, the clock on Thursday 24 September at 18:40,
 * and a Wednesday 14 October full of lessons for the bulk cancel. `lessons`
 * switches to a studio with none, the loading and the failed read;
 * `teachers` to a solo tutor. The URL states come as `nextjs.navigation`.
 */
function LessonsScreen({ lessons, teachers }: Args) {
  return (
    <StoryBackend
      lessonList={{ lessons, teachers }}
      mode={teachers === 'solo' ? 'SOLO' : 'SCHOOL'}
      lessonCreate={{}}
    >
      <StoryAppShell pathname="/app/lessons">
        <LessonsPage nowMs={LESSON_LIST_CLOCK} />
      </StoryAppShell>
    </StoryBackend>
  );
}

const at = (query: Record<string, string>) => ({
  nextjs: { appDirectory: true, navigation: { pathname: '/app/lessons', query } },
});

const meta = {
  title: 'Lessons/Screens/LessonsList',
  component: LessonsScreen,
  parameters: { layout: 'fullscreen', fullBleed: true, ...at({}) },
  args: { lessons: 'ready', teachers: 'school' },
  argTypes: {
    lessons: { control: 'inline-radio', options: ['ready', 'empty', 'pending', 'error'] },
    teachers: { control: 'inline-radio', options: ['school', 'solo'] },
  },
} satisfies Meta<typeof LessonsScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);
const visible = (element: HTMLElement) => waitFor(() => expect(element).toBeVisible());
const lastUrl = () => {
  const calls = getRouter().replace.mock.calls;
  return String(calls.at(-1)?.[0] ?? '');
};

/** 01 · The list: this month, newest first, the quick filters' counts. */
export const Playground: Story = {
  play: async ({ canvas }) => {
    await visible(await canvas.findByRole('heading', { level: 1, name: 'Lessons' }));
    const table = await canvas.findByRole('table');
    await visible(
      within(table).getByRole('button', { name: /Open the lesson: Kids A1 · weekend/ }),
    );
    await expect(within(table).getAllByText('Paid after').length).toBeGreaterThan(0);
    // A package-paid direction shows what is left of its package now.
    await expect(within(table).getAllByText('Package · 3 of 8').length).toBeGreaterThan(0);
    await visible(canvas.getByRole('radio', { name: /Unpaid/ }));
    await visible(canvas.getByRole('button', { name: 'Period: September 2026' }));
  },
};

/** 02 · A quick filter writes the URL and keeps the other counts. */
export const QuickFilter: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('radio', { name: /Unpaid/ }));
    await waitFor(() => expect(lastUrl()).toBe('/app/lessons?quick=unpaid'));
  },
};

/** 02 · «Без оплати» as it arrives in the URL. */
export const QuickUnpaid: Story = {
  parameters: at({ quick: 'unpaid' }),
  play: async ({ canvas }) => {
    await visible(await canvas.findByRole('radio', { name: /Unpaid/, checked: true }));
    const table = await canvas.findByRole('table');
    await expect(within(table).getAllByText(/Unpaid|Debt|of \d paid/).length).toBeGreaterThan(0);
    await expect(within(table).queryByText('Paid after')).toBeNull();
  },
};

/** 03 · «Без відпрацювання»: the payment cell becomes «Призначити». */
export const QuickNeedsMakeup: Story = {
  parameters: at({ quick: 'needs_makeup' }),
  play: async ({ canvas }) => {
    const table = await canvas.findByRole('table');
    const assign = await within(table).findAllByRole('button', { name: 'Assign' });
    await expect(assign.length).toBe(3);
    await userEvent.click(assign[0]!);
    await waitFor(() => expect(lastUrl()).toMatch(/lesson=/));
  },
};

/** 04 · The period menu: a quick choice writes the URL. */
export const PeriodMenu: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Period: September 2026' }));
    const menu = within(await body().findByRole('dialog', { name: 'Period' }));
    await userEvent.click(menu.getByRole('menuitemradio', { name: 'Last month' }));
    await waitFor(() => expect(lastUrl()).toBe('/app/lessons?period=lastMonth'));
  },
};

/** 05 · The teacher menu. */
export const TeacherMenu: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Teacher' }));
    await userEvent.click(await body().findByRole('option', { name: 'Iryna Bondar' }));
    await waitFor(() => expect(lastUrl()).toBe(`/app/lessons?teacher=${IRYNA}`));
  },
};

/** 06 · Student or group: a search, students and groups, and what a student includes. */
export const WhoMenu: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Student or group' }));
    await userEvent.type(await body().findByPlaceholderText("Student's name or group"), 'So');
    await visible(await body().findByText(/their groups' lessons/));
    await userEvent.click(await body().findByRole('option', { name: 'Sofiia Melnyk' }));
    await waitFor(() => expect(lastUrl()).toBe(`/app/lessons?student=${SOFIIA}`));
  },
};

/** 07 · The status menu: several statuses, applied on «Готово». */
export const StatusMenu: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Status' }));
    const menu = within(await body().findByRole('dialog', { name: 'Status' }));
    await userEvent.click(menu.getByLabelText('Cancelled'));
    await userEvent.click(menu.getByLabelText('No-shows'));
    await userEvent.click(menu.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(lastUrl()).toBe('/app/lessons?status=CANCELLED%2CNO_SHOW'));
  },
};

/** 08 · Filters set: the pills name them, «Скинути» clears them. */
export const FiltersApplied: Story = {
  parameters: at({ teacher: IRYNA, student: SOFIIA }),
  play: async ({ canvas }) => {
    await visible(await canvas.findByText(/^\d+ lessons? match the filters · \d+ in all$/));
    await visible(await canvas.findByRole('button', { name: 'Sofiia Melnyk' }));
    await visible(canvas.getByRole('button', { name: 'Iryna Bondar' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(lastUrl()).toBe('/app/lessons'));
  },
};

/** 09 · The row menu: the panel's own commands for the lesson. */
export const RowMenu: Story = {
  play: async ({ canvas }) => {
    const table = await canvas.findByRole('table');
    const menus = await within(table).findAllByRole('button', { name: 'Lesson actions' });
    await userEvent.click(menus[0]!);
    const menu = within(await body().findByRole('menu'));
    await waitFor(() =>
      expect(menu.getByRole('menuitem', { name: 'Open the lesson' })).toBeVisible(),
    );
    await visible(menu.getByRole('menuitem', { name: 'Move' }));
    await visible(menu.getByRole('menuitem', { name: 'Cancel' }));
    await userEvent.click(menu.getByRole('menuitem', { name: 'Cancel' }));
    await waitFor(() => expect(lastUrl()).toMatch(/lesson=/));
  },
};

/** 10 · Nothing matches: what was asked for, and «Скинути фільтри». */
export const NoResults: Story = {
  parameters: at({ quick: 'unpaid', q: 'zzz' }),
  play: async ({ canvas }) => {
    await visible(await canvas.findByText('No lessons match these filters'));
    await visible(canvas.getByText(/unpaid · «zzz» · September 2026/));
    await userEvent.click(canvas.getByRole('button', { name: 'Reset the filters' }));
    await waitFor(() => expect(lastUrl()).toBe('/app/lessons'));
  },
};

/** 11 · A studio with no lessons yet: no toolbar, the calendar and «Нове заняття». */
export const Empty: Story = {
  args: { lessons: 'empty' },
  play: async ({ canvas }) => {
    await visible(await canvas.findByText('Every lesson will be here'));
    await visible(canvas.getByRole('link', { name: 'Open the calendar' }));
    await expect(canvas.queryByRole('button', { name: 'Cancel lessons' })).toBeNull();
  },
};

/** 12 · Loading. */
export const Loading: Story = { args: { lessons: 'pending' } };

/** 13 · The failed read with «Спробувати ще раз». */
export const LoadError: Story = {
  args: { lessons: 'error' },
  play: async ({ canvas }) => {
    await visible(await canvas.findByText('The lessons could not be loaded'));
    await visible(canvas.getByRole('button', { name: 'Try again' }));
  },
};

/** 14 · Solo: no teacher column and no teacher filter. */
export const Solo: Story = {
  args: { teachers: 'solo' },
  play: async ({ canvas }) => {
    const table = await canvas.findByRole('table');
    await expect(within(table).queryByRole('columnheader', { name: 'Teacher' })).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Teacher' })).toBeNull();
  },
};

// ---------------------------------------------------------------------------
// Bulk cancel (board 02)
// ---------------------------------------------------------------------------

async function openBulkCancel(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(
    (await canvas.findAllByRole('button', { name: 'Cancel lessons' })).find(
      (button) => button.offsetParent !== null,
    )!,
  );
  return within(await body().findByRole('dialog', { name: 'Cancel lessons' }));
}

/** Picks a day in a date field's calendar, a month ahead when asked. */
async function pickDay(dialog: ReturnType<typeof within>, field: string, day: RegExp) {
  await userEvent.click(dialog.getByRole('button', { name: field }));
  const calendar = within(await body().findByRole('dialog', { name: /Pick a date/ }));
  await userEvent.click(calendar.getByRole('button', { name: /next month/i }));
  await userEvent.click(calendar.getByRole('button', { name: day }));
}

/** 01–02 · The form: the whole studio, then one teacher with the picker. */
export const BulkCancelForm: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openBulkCancel(canvasElement);
    await expect(dialog.getByRole('radio', { name: /The whole studio/ })).toBeChecked();
    await expect(dialog.getByRole('radio', { name: 'Holiday' })).toHaveAttribute(
      'data-state',
      'on',
    );
    await userEvent.click(dialog.getByRole('radio', { name: /One teacher/ }));
    await visible(await dialog.findByText('Teacher'));
    await userEvent.click(dialog.getByRole('button', { name: 'Next' }));
    await visible(await dialog.findByText('Pick a teacher from the list'));
  },
};

/** 04 → 06 → 07 · The check lists the day's lessons; the cancel applies and the toast shows them. */
export const BulkCancelApply: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openBulkCancel(canvasElement);
    await pickDay(dialog, 'From', /October 14th/);
    await pickDay(dialog, 'To', /October 14th/);
    await userEvent.click(dialog.getByRole('button', { name: 'Next' }));
    const check = within(await body().findByRole('dialog', { name: 'Cancel 14 lessons?' }));
    await visible(check.getByText('10 individual · 4 group'));
    await visible(check.getByText(/10 individual lessons appear under “No makeup”/));
    await visible(check.getByText('Kids A1'));
    await userEvent.click(check.getByRole('button', { name: 'Cancel 14 lessons' }));
    await visible(await body().findByText('Cancelled 14 lessons on October 14 · free'));
    await userEvent.click(body().getByRole('button', { name: 'Show' }));
    await waitFor(() => expect(lastUrl()).toBe('/app/lessons?from=2026-10-14'));
  },
};

/** 05 · Nothing scheduled in the period: only «Назад» and «Закрити». */
export const BulkCancelNothing: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openBulkCancel(canvasElement);
    await pickDay(dialog, 'From', /October 20th/);
    await pickDay(dialog, 'To', /October 20th/);
    await userEvent.click(dialog.getByRole('button', { name: 'Next' }));
    const nothing = within(await body().findByRole('dialog', { name: 'Nothing to cancel' }));
    await visible(nothing.getByText('No lessons are scheduled on these days'));
    await userEvent.click(nothing.getByRole('button', { name: 'Back' }));
    await visible(await body().findByRole('dialog', { name: 'Cancel lessons' }));
  },
};

/** 03 · Errors sit under their fields. */
export const BulkCancelErrors: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await openBulkCancel(canvasElement);
    await pickDay(dialog, 'From', /October 14th/);
    await userEvent.click(dialog.getByRole('button', { name: 'Next' }));
    await visible(await dialog.findByText('The end is before the start'));
  },
};

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

/** Phone 01 · Cards with the date tile, paging under them. */
export const PhoneList: Story = {
  globals: MOBILE_VIEWPORT,
  beforeEach: forceMobileMediaQuery,
};

/** Phone 03 · The filter sheet counts the draft before applying it. */
export const PhoneFilters: Story = {
  globals: MOBILE_VIEWPORT,
  beforeEach: forceMobileMediaQuery,
  play: async ({ canvas }) => {
    const open = (await canvas.findAllByRole('button', { name: 'Filters' })).find(
      (button) => button.offsetParent !== null,
    );
    if (!open) return;
    await userEvent.click(open);
    const sheet = within(await body().findByRole('dialog', { name: 'Filters' }));
    await userEvent.click(sheet.getByLabelText('Iryna Bondar'));
    await visible(await sheet.findByRole('button', { name: /Show \d+ lessons?/ }));
  },
};
