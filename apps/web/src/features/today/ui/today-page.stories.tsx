import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { forceMobileMediaQuery, MOBILE_VIEWPORT, StoryClock } from '@/stories/story-helpers';
import { StoryBackend } from '@/stories/story-backend';
import { StoryAppShell } from '@/stories/story-shell';
import { TODAY_CLOCK, TODAY_EVENING, type TodayStoryOptions } from '@/stories/today-story-backend';
import { TodayPage } from './today-page';

type Today = NonNullable<TodayStoryOptions['today']>;
type Args = {
  day: NonNullable<Today['day']>;
  owner: NonNullable<Today['owner']>;
  scope: 'mine' | 'studio';
  money: NonNullable<Today['money']>;
  attention: 'auto' | NonNullable<Today['attention']>;
  setup: 'auto' | NonNullable<Today['setup']>;
  lessons: NonNullable<Today['lessons']>;
};

/**
 * The owner's Today page (S11) against the story backend: Kyiv English
 * Studio on Saturday 26 September 2026 at 13:05 (19:45 for `day: end`).
 * `day` is the busy day, its end, a free day or a first run's three lessons;
 * `owner` the owner who teaches with colleagues, does not teach, or a solo
 * tutor; `scope` the remembered «Мої · Студія»; `money`, `attention`,
 * `setup` and `lessons` each block's data, loading and error. Boards 01 and
 * 06: desktop 1440 and phone 390 from the viewport toolbar.
 */
function TodayScreen({ day, owner, scope, money, attention, setup, lessons }: Args) {
  try {
    window.localStorage.setItem('tutorio.today.scope', scope);
  } catch {
    // Storage may be blocked; the page falls back to «Мої».
  }
  const now = day === 'end' ? TODAY_EVENING : TODAY_CLOCK;
  return (
    <StoryBackend
      mode={owner === 'solo' ? 'SOLO' : 'SCHOOL'}
      today={{
        day,
        owner,
        money,
        attention: attention === 'auto' ? undefined : attention,
        setup: setup === 'auto' ? undefined : setup,
        lessons,
      }}
      lessonCreate={{}}
    >
      <StoryClock now={now}>
        <StoryAppShell pathname="/app" solo={owner === 'solo'}>
          <TodayPage nowMs={now} />
        </StoryAppShell>
      </StoryClock>
    </StoryBackend>
  );
}

const meta = {
  title: 'Today/Screens/Today',
  component: TodayScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
  args: {
    day: 'busy',
    owner: 'teaches',
    scope: 'mine',
    money: 'one',
    attention: 'auto',
    setup: 'auto',
    lessons: 'ready',
  },
  argTypes: {
    day: { control: 'inline-radio', options: ['busy', 'end', 'free', 'partial'] },
    owner: { control: 'inline-radio', options: ['teaches', 'notTeaching', 'solo'] },
    scope: { control: 'inline-radio', options: ['mine', 'studio'] },
    money: { control: 'inline-radio', options: ['one', 'two', 'firstDay', 'pending', 'error'] },
    attention: {
      control: 'inline-radio',
      options: ['auto', 'typical', 'calm', 'many', 'free', 'pending', 'error'],
    },
    setup: { control: 'inline-radio', options: ['auto', 'done', 'fresh', 'partial'] },
    lessons: { control: 'inline-radio', options: ['ready', 'pending', 'error'] },
  },
} satisfies Meta<typeof TodayScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const visible = (element: HTMLElement) => waitFor(() => expect(element).toBeVisible());

export const Playground: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await visible(await canvas.findByRole('heading', { name: 'Good afternoon, Olena' }));
    await visible(
      (await canvas.findAllByRole('button', { name: /Open the lesson: Roman Kyrylenko/ }))[0]!,
    );
  },
};

/** «Мої · Студія» filters the day and the exceptions; the money stays the studio's. */
export const ScopeSwitch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('button', { name: /Open the lesson: Petro Ivanenko/ });
    expect(canvas.queryByRole('button', { name: /Open the lesson: Marta Lysak/ })).toBeNull();
    const received = await canvas.findByText('64,200 ₴');
    await userEvent.click(canvas.getByRole('radio', { name: 'Studio' }));
    await visible(await canvas.findByRole('button', { name: /Open the lesson: Marta Lysak/ }));
    // Each lesson now names its teacher.
    await visible((await canvas.findAllByText('Oleh Marchenko'))[0]!);
    expect(await canvas.findByText('64,200 ₴')).toBe(received);
  },
};

/** The accordion opens the first category with something in it, one at a time. */
export const AttentionAccordion: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const attendance = await canvas.findByRole('button', { name: /Attendance not marked/ });
    await waitFor(() => expect(attendance).toHaveAttribute('aria-expanded', 'true'));
    const makeups = canvas.getByRole('button', { name: /Makeup needed/ });
    await userEvent.click(makeups);
    await waitFor(() => expect(makeups).toHaveAttribute('aria-expanded', 'true'));
    expect(attendance).toHaveAttribute('aria-expanded', 'false');
    await visible(canvas.getByRole('link', { name: 'Anna Shevchenko' }));
    // A click on the open one closes it: everything collapsed.
    await userEvent.click(makeups);
    await waitFor(() => expect(makeups).toHaveAttribute('aria-expanded', 'false'));
  },
};

/** «Відмітити» on a finished group lesson opens the lesson panel (S01) on attendance. */
export const MarkAttendance: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('button', { name: /Open the lesson: Beginners/ });
    const [mark] = canvas.getAllByRole('button', { name: 'Mark' });
    await userEvent.click(mark!);
    const body = within(canvasElement.ownerDocument.body);
    await visible(await body.findByRole('dialog'));
  },
};

/** The row's «⋯»: the S04 row menu. */
export const RowMenu: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('button', { name: /Open the lesson: Iryna Moroz/ });
    const menus = canvas.getAllByRole('button', { name: 'Lesson actions' });
    await userEvent.click(menus[3]!);
    const body = within(canvasElement.ownerDocument.body);
    await visible(await body.findByRole('menuitem', { name: 'Open the lesson' }));
    await visible(body.getByRole('menuitem', { name: 'Move' }));
    await visible(body.getByRole('menuitem', { name: 'Cancel' }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(canvasElement.ownerDocument.querySelector('[data-aria-hidden]')).toBeNull(),
    );
  },
};

/** «Створити ▾» reaches the sale (S07) and the new student; «Записати оплату» the payment. */
export const CreateMenu: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByRole('button', { name: /^Create/ }));
    await visible(await body.findByRole('menuitem', { name: /New student/ }));
    await userEvent.click(body.getByRole('menuitem', { name: /Sell a package/ }));
    await visible(await body.findByRole('dialog'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(canvasElement.ownerDocument.querySelector('[data-aria-hidden]')).toBeNull(),
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Record a payment' }));
    await visible(await body.findByRole('dialog', { name: 'Record a payment' }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(canvasElement.ownerDocument.querySelector('[data-aria-hidden]')).toBeNull(),
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Add a lesson' }));
    await visible(await body.findByRole('dialog'));
  },
};

/** A block that fails shows its error; the rest of the page works. */
export const BlockFails: Story = {
  args: { money: 'error' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await visible(await canvas.findByRole('alert'));
    await visible(canvas.getByRole('button', { name: 'Try again' }));
    await visible(
      (await canvas.findAllByRole('button', { name: /Open the lesson: Roman Kyrylenko/ }))[0]!,
    );
  },
};

/** Board 06: the phone — the «+» sheet with the four actions. */
export const PhoneSheet: Story = {
  globals: MOBILE_VIEWPORT,
  beforeEach: () => forceMobileMediaQuery(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByRole('button', { name: 'Create' }));
    const sheet = await body.findByRole('dialog', { name: 'Create' });
    await visible(sheet);
    for (const action of ['Add a lesson', 'Record a payment', 'Sell a package', 'New student']) {
      await visible(within(sheet).getByRole('button', { name: new RegExp(action) }));
    }
  },
};
