import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  BILLING_CLOCK,
  BILLING_STUDENT_ID,
  type ProfileBillingState,
} from '@/stories/student-billing-story-backend';
import { SAMPLE_STUDENTS, StoryBackend } from '@/stories/story-backend';
import { StoryClock, forceMobileMediaQuery, MOBILE_VIEWPORT } from '@/stories/story-helpers';
import { StoryAppShell } from '@/stories/story-shell';
import { StudentDetailView } from '../student-detail';

const STATES: ProfileBillingState[] = [
  'package',
  'partial',
  'low',
  'debt',
  'advance',
  'two',
  'three',
  'pauseScheduled',
  'paused',
  'directionPaused',
];

type Args = {
  state: ProfileBillingState;
  returnConflicts: boolean;
  onWrite: (write: { method: string; path: string; body: unknown }) => void;
};

/**
 * The student profile of S06 (boards «ProfileLearning» and «ProfileDialogs»):
 * `state` picks each state of board 01 — a package, paid in part, running
 * low, a debt, an advance, two directions, three in two currencies, a pause
 * that is planned, a running pause and one paused direction. The dialogs of
 * board 02 are the named stories; their writes run against the in-memory
 * backend and reach `onWrite`. The clock is Thursday 24 September 2026.
 */
function LearningScreen({ state, returnConflicts, onWrite }: Args) {
  const students = SAMPLE_STUDENTS.map((student) =>
    student.id === BILLING_STUDENT_ID && state === 'paused'
      ? { ...student, status: 'ON_HOLD' as const }
      : student,
  );
  return (
    <StoryBackend
      key={`${state}-${returnConflicts}`}
      students={students}
      profileBilling={{ state, returnConflicts, onWrite }}
    >
      <StoryClock now={BILLING_CLOCK}>
        <StoryAppShell pathname={`/app/students/${BILLING_STUDENT_ID}`}>
          <StudentDetailView studentId={BILLING_STUDENT_ID} />
        </StoryAppShell>
      </StoryClock>
    </StoryBackend>
  );
}

const meta = {
  title: 'Students/Screens/Learning',
  component: LearningScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
  args: { state: 'package', returnConflicts: false, onWrite: fn() },
  argTypes: {
    state: { control: 'select', options: STATES },
    onWrite: { table: { disable: true } },
  },
} satisfies Meta<typeof LearningScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);
/** A dialog once it has faded in: `toBeVisible` fails during the fade. */
const dialog = async (name: string | RegExp) => {
  const element = await body().findByRole('dialog', { name }, { timeout: 5000 });
  await waitFor(() => expect(getComputedStyle(element).opacity).toBe('1'), { timeout: 5000 });
  return within(element);
};
/** Waits until no overlay hides the page any more, so the checks see it as a reader does. */
const overlaysClosed = () =>
  waitFor(() => expect(document.querySelector('[data-aria-hidden]')).toBeNull(), {
    timeout: 5000,
  });
const pass = async (canvas: ReturnType<typeof within>, name: string | RegExp) =>
  within(await canvas.findByRole('article', { name }, { timeout: 5000 }));

export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'Learning and payments' }),
    ).toBeVisible();
    const english = await pass(canvas, /English · package “B2 preparation”/);
    await expect(english.getByText('4,000 ₴ per package')).toBeVisible();
    await expect(english.getByText('Cancel 24 h ahead')).toBeVisible();
  },
};

/** Three directions in two currencies: chips per currency, «—» for the money metric. */
export const MultiCurrency: Story = {
  args: { state: 'three' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Debt 1,050 ₴')).toBeVisible();
    await expect(canvas.getByText('Advance 240 zł')).toBeVisible();
    await expect(await canvas.findByText('Several currencies')).toBeVisible();
    await expect(await pass(canvas, /Польська · pay per lesson/)).toBeDefined();
  },
};

/** The ⋯ of a direction (board 01, state 11). */
export const DirectionMenu: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Actions for English' }, { timeout: 5000 }),
    );
    const menu = within(await body().findByRole('menu'));
    for (const item of [
      'Record a payment',
      'Direction settings',
      'Change the schedule',
      'Pause this direction',
      'End learning',
    ]) {
      await waitFor(() => expect(menu.getByRole('menuitem', { name: item })).toBeVisible());
    }
    await userEvent.keyboard('{Escape}');
    await overlaysClosed();
  },
};

/** «Пакети»: the package history with its summary (board 01, state 12). */
export const PackagesTab: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('tab', { name: 'Packages' }));
    const list = within(await canvas.findByRole('list', { name: 'The student’s packages' }));
    await expect(list.getByText('Starter')).toBeVisible();
    await expect(list.getByText('Expired')).toBeVisible();
    await expect(list.getByText('300 ₴ of 600 ₴')).toBeVisible();
    await expect(canvas.getByText(/3 packages · 7 of 14 lessons used/)).toBeVisible();
  },
};

/** «Оплати»: the ledger by month with its tiles (board 01, state 13). */
export const PaymentsTab: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('tab', { name: 'Payments' }));
    await expect(await canvas.findByText('Paid in total')).toBeVisible();
    await expect(canvas.getByText('7,200 ₴')).toBeVisible();
    await expect(canvas.getByText('−300 ₴')).toBeVisible();
    await expect(canvas.getByText('2 lessons settled · English')).toBeVisible();
    await expect(canvas.getByRole('region', { name: 'September 2026' })).toBeVisible();
  },
};

/** A debt: the oldest lessons close first, the rest goes to the advance (L-90). */
export const Payment: Story = {
  args: { state: 'debt' },
  play: async ({ canvas, args }) => {
    const english = await pass(canvas, /English · pay per lesson/);
    await userEvent.click(english.getAllByRole('button', { name: 'Record a payment' })[0]!);
    const form = await dialog('Record a payment');
    await waitFor(() => expect(form.getByText('Settles 2 lessons')).toBeVisible());
    await expect(form.getByText('Debt becomes 0 ₴')).toBeVisible();
    await expect(form.getByRole('radio', { name: 'Transfer' })).toBeChecked();
    const amount = form.getByRole('textbox', { name: 'Amount' });
    await userEvent.clear(amount);
    await userEvent.type(amount, '2000');
    await expect(form.getByText('+1,000 ₴ goes to the advance')).toBeVisible();
    await userEvent.click(form.getByRole('button', { name: 'Record 2,000 ₴' }));
    await waitFor(() =>
      expect(args.onWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/payments',
          body: expect.objectContaining({
            amountMinor: 200000,
            currency: 'UAH',
            method: 'BANK_TRANSFER',
          }),
        }),
      ),
    );
    await overlaysClosed();
  },
};

/** Part of a package: what it pays for, «можна частинами» (decision 5). */
export const PaymentPackagePart: Story = {
  args: { state: 'partial' },
  play: async ({ canvas, args }) => {
    const english = await pass(canvas, /English · package/);
    await userEvent.click(english.getAllByRole('button', { name: 'Record a payment' })[0]!);
    const form = await dialog('Record a payment');
    await expect(form.getByRole('radio', { name: /Package “B2 preparation”/ })).toBeChecked();
    const amount = form.getByRole('textbox', { name: 'Amount' });
    await userEvent.clear(amount);
    await userEvent.type(amount, '1000');
    await expect(form.getByText('Package: 3,000 ₴ of 4,000 ₴ paid')).toBeVisible();
    await expect(form.getByText('1,000 ₴ left — state “Partial”')).toBeVisible();
    await userEvent.click(form.getByRole('button', { name: 'Record 1,000 ₴' }));
    await waitFor(() =>
      expect(args.onWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            packageId: 'abababab-0000-4000-8000-000000000001',
            amountMinor: 100000,
          }),
        }),
      ),
    );
    await overlaysClosed();
  },
};

/** No amount: «Вкажіть суму» under the field (board 02, state 04). */
export const PaymentError: Story = {
  args: { state: 'debt' },
  play: async ({ canvas, args }) => {
    const english = await pass(canvas, /English · pay per lesson/);
    await userEvent.click(english.getAllByRole('button', { name: 'Record a payment' })[0]!);
    const form = await dialog('Record a payment');
    await userEvent.clear(form.getByRole('textbox', { name: 'Amount' }));
    await userEvent.click(form.getByRole('button', { name: 'Record' }));
    await expect(await form.findByText('Enter an amount')).toBeVisible();
    await expect(args.onWrite).not.toHaveBeenCalled();
  },
};

/** The mode switch explains itself before it is saved (board 02, states 05–06). */
export const DirectionSettings: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Actions for English' }, { timeout: 5000 }),
    );
    await userEvent.click(
      within(await body().findByRole('menu')).getByRole('menuitem', { name: 'Direction settings' }),
    );
    const form = await dialog('Direction settings');
    await userEvent.click(form.getByRole('radio', { name: /Per lesson/ }));
    await expect(form.getByText('Package “B2 preparation” stays')).toBeVisible();
    await expect(form.getByText('Held lessons do not change')).toBeVisible();
    await userEvent.click(form.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(args.onWrite).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'PATCH', body: { billingType: 'PER_LESSON' } }),
      ),
    );
  },
};

/** «На паузі» in the status menu opens the pause of the whole student (board 02, states 07–08). */
export const PauseWholeStudent: Story = {
  args: { state: 'two' },
  play: async ({ canvas, args }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: /Student status: Active/ }, { timeout: 5000 }),
    );
    const menu = within(await body().findByRole('menu'));
    const paused = menu.getByRole('menuitemradio', { name: /Paused/ });
    await waitFor(() => expect(paused).toBeVisible());
    await userEvent.click(paused);
    const form = await dialog('Pause');
    await expect(form.getByRole('radio', { name: /All learning/ })).toBeChecked();
    await expect(await form.findByText('8 lessons will come off')).toBeVisible();
    await expect(form.getByText('Group B1 English goes on without Anna')).toBeVisible();
    await userEvent.click(form.getByRole('button', { name: 'Pause' }));
    await waitFor(() =>
      expect(args.onWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/pauses',
          body: expect.objectContaining({ enrollmentId: null, reason: 'HOLIDAY' }),
        }),
      ),
    );
    await overlaysClosed();
  },
};

/** One direction from its ⋯: the others go on, the status stays (board 02, state 09). */
export const PauseOneDirection: Story = {
  args: { state: 'two' },
  play: async ({ canvas, args }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Actions for B1 English' }, { timeout: 5000 }),
    );
    await userEvent.click(
      within(await body().findByRole('menu')).getByRole('menuitem', {
        name: 'Pause this direction',
      }),
    );
    const form = await dialog('Pause');
    await expect(form.getByRole('radio', { name: /One direction/ })).toBeChecked();
    await expect(await form.findByText('4 lessons of B1 English without Anna')).toBeVisible();
    await expect(form.getByText('English goes on as usual')).toBeVisible();
    await expect(form.getByText('The student’s status does not change')).toBeVisible();
    await userEvent.click(form.getByRole('button', { name: 'Pause' }));
    await waitFor(() =>
      expect(args.onWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/pauses',
          body: expect.objectContaining({ enrollmentId: expect.stringMatching(/^e6e6e6e6/) }),
        }),
      ),
    );
    await overlaysClosed();
  },
};

/** An end before the start is named under its field (board 02, state 10). */
export const PauseErrors: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Actions for English' }, { timeout: 5000 }),
    );
    await userEvent.click(
      within(await body().findByRole('menu')).getByRole('menuitem', {
        name: 'Pause this direction',
      }),
    );
    const form = await dialog('Pause');
    await userEvent.click(form.getByRole('button', { name: 'Until' }));
    await userEvent.click(await body().findByRole('button', { name: /September 20/ }));
    await userEvent.click(form.getByRole('button', { name: 'Pause' }));
    await expect(await form.findByText('The end is before the start')).toBeVisible();
    await expect(args.onWrite).not.toHaveBeenCalled();
  },
};

/** A pause that has not begun is cancelled from its banner (board 02, state 11). */
export const CancelPause: Story = {
  args: { state: 'pauseScheduled' },
  play: async ({ canvas, args }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Cancel the pause' }, { timeout: 5000 }),
    );
    const confirm = await dialog('Cancel the pause?');
    await expect(await confirm.findByText('8 lessons stay on the schedule')).toBeVisible();
    await expect(confirm.getByText('The package is not extended')).toBeVisible();
    await userEvent.click(confirm.getByRole('button', { name: 'Cancel the pause' }));
    await waitFor(() =>
      expect(args.onWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringMatching(/\/pauses\/.+\/end$/),
          body: { force: null, skipConflicts: null },
        }),
      ),
    );
    await overlaysClosed();
  },
};

/** Back now: the lessons that return and the shorter extension (board 02, state 12). */
export const ReturnNow: Story = {
  args: { state: 'paused' },
  play: async ({ canvas, args }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Bring back now' }, { timeout: 5000 }),
    );
    const confirm = await dialog('Bring back from the pause now?');
    await expect(await confirm.findByText('3 lessons come back')).toBeVisible();
    await expect(confirm.getByText('The package extension gets shorter')).toBeVisible();
    await userEvent.click(confirm.getByRole('button', { name: 'Bring back' }));
    await waitFor(() =>
      expect(args.onWrite).toHaveBeenCalledWith(
        expect.objectContaining({ body: { force: null, skipConflicts: null } }),
      ),
    );
  },
};

/**
 * Two returning lessons' time is taken: the pairs, then «Повернути без них»,
 * which brings back only the free one (board 02, state 13).
 */
export const ReturnConflicts: Story = {
  args: { state: 'paused', returnConflicts: true },
  play: async ({ canvas, args }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Bring back now' }, { timeout: 5000 }),
    );
    const confirm = await dialog('Bring back from the pause now?');
    await expect(
      await confirm.findByText('2 lessons cannot come back — the time is taken'),
    ).toBeVisible();
    await expect(confirm.getByText('Sofiia Melnyk')).toBeVisible();
    await expect(confirm.getByText('1 lesson comes back')).toBeVisible();
    await expect(confirm.getByText('2 lessons do not come back')).toBeVisible();
    await userEvent.click(confirm.getByRole('button', { name: 'Bring back without them' }));
    await waitFor(() =>
      expect(args.onWrite).toHaveBeenCalledWith(
        expect.objectContaining({ body: { force: null, skipConflicts: 'true' } }),
      ),
    );
  },
};

/** Phones: the stub above the body, the menu and the dialogs as sheets. */
export const Phone: Story = {
  args: { state: 'two' },
  globals: MOBILE_VIEWPORT,
  beforeEach: forceMobileMediaQuery,
  play: async ({ canvas }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Actions for English' }, { timeout: 5000 }),
    );
    const sheet = await dialog('English');
    await userEvent.click(sheet.getByRole('button', { name: 'Record a payment' }));
    await expect(await dialog('Record a payment')).toBeDefined();
  },
};

/** «Повернути все одно» brings every lesson back on top of the others (L-111). */
export const ReturnAnyway: Story = {
  args: { state: 'paused', returnConflicts: true },
  play: async ({ canvas, args }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Bring back now' }, { timeout: 5000 }),
    );
    const confirm = await dialog('Bring back from the pause now?');
    await userEvent.click(await confirm.findByRole('button', { name: 'Bring back anyway' }));
    await waitFor(() =>
      expect(args.onWrite).toHaveBeenCalledWith(
        expect.objectContaining({ body: { force: 'true', skipConflicts: null } }),
      ),
    );
    await overlaysClosed();
  },
};
