import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { StudentDetailView } from '@/features/students';
import { PACKAGES_CLOCK, TICKET_IDS, type TicketStory } from '@/stories/packages-story-backend';
import { BILLING_STUDENT_ID } from '@/stories/student-billing-story-backend';
import { StoryBackend } from '@/stories/story-backend';
import { forceMobileMediaQuery, MOBILE_VIEWPORT, StoryClock } from '@/stories/story-helpers';
import { StoryAppShell } from '@/stories/story-shell';
import { PackageTicketModal } from './package-ticket-modal';

const STARTER = 'cdcdcdcd-0000-4000-8000-000000000009';

type Write = { method: string; path: string; body: unknown };
type Args = { state: TicketStory | 'unused'; onWrite: (write: Write) => void };

/**
 * The package ticket (S07 board 02) over Anna's profile: `state` opens it
 * new (waiting behind «Starter»), half used and paid in part, used up,
 * expired with two lessons left, or extended by a pause; `unused` is the
 * one package that can be deleted. The named stories are the operation
 * dialogs of board 03 and their interaction tests; every write reaches
 * `onWrite`. The clock is Friday 25 September 2026.
 */
function TicketScreen({ state, onWrite }: Args) {
  const [packageId, setPackageId] = useState<string | null>(
    state === 'unused' ? STARTER : TICKET_IDS[state],
  );
  return (
    <StoryBackend key={state} profileBilling={{ state: 'three' }} packagesStory={{ onWrite }}>
      <StoryClock now={PACKAGES_CLOCK}>
        <StoryAppShell pathname={`/app/students/${BILLING_STUDENT_ID}`}>
          <StudentDetailView studentId={BILLING_STUDENT_ID} />
          <PackageTicketModal
            packageId={packageId}
            onClose={() => setPackageId(null)}
            studentHref={(id) => `/app/students/${id}`}
            nowMs={PACKAGES_CLOCK}
          />
        </StoryAppShell>
      </StoryClock>
    </StoryBackend>
  );
}

const meta = {
  title: 'Packages/Screens/Ticket',
  component: TicketScreen,
  parameters: {
    layout: 'fullscreen',
    fullBleed: true,
    nextjs: {
      appDirectory: true,
      navigation: { pathname: `/app/students/${BILLING_STUDENT_ID}`, query: {} },
    },
  },
  args: { state: 'partial', onWrite: fn() },
  argTypes: {
    state: {
      control: 'select',
      options: ['new', 'partial', 'used', 'expired', 'paused', 'unused'],
    },
    onWrite: { table: { disable: true } },
  },
} satisfies Meta<typeof TicketScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);
const dialog = async (name: string | RegExp) => {
  const element = await body().findByRole('dialog', { name }, { timeout: 5000 });
  await waitFor(() => expect(getComputedStyle(element).opacity).toBe('1'), { timeout: 5000 });
  return within(element);
};
const ticket = () => dialog('B2 preparation');
const wrote = (onWrite: Args['onWrite'], path: RegExp) =>
  waitFor(() =>
    expect(
      (onWrite as ReturnType<typeof fn>).mock.calls.some(([write]) =>
        path.test((write as Write).path),
      ),
    ).toBe(true),
  );
const bodyOf = (onWrite: Args['onWrite'], path: RegExp) =>
  (onWrite as ReturnType<typeof fn>).mock.calls.find(([write]) =>
    path.test((write as Write).path),
  )?.[0].body as Record<string, unknown>;

/** 02 · Half used, paid in part: «Записати оплату» leads; the lessons it paid for. */
export const Playground: Story = {
  play: async () => {
    const view = await ticket();
    await expect(view.getByText('Active')).toBeVisible();
    await expect(view.getByRole('button', { name: 'Record payment' })).toBeVisible();
    await expect(view.getByText('2,000 ₴ left')).toBeVisible();
    await expect(await view.findByText('Lessons · 4', {}, { timeout: 5000 })).toBeVisible();
    await expect(view.getByText('Cancelled (charged)')).toBeVisible();
  },
};

/** 01 · New: nothing used, waiting behind «Starter» (L-81). */
export const New: Story = {
  args: { state: 'new' },
  play: async () => {
    const view = await ticket();
    await expect(view.getByText('Starts once «Starter» runs out')).toBeVisible();
    await expect(
      await view.findByText(
        'No lesson has been taken from this package yet.',
        {},
        { timeout: 5000 },
      ),
    ).toBeVisible();
  },
};

/** 04 · Expired with two lessons: «Продовжити» leads. */
export const Expired: Story = {
  args: { state: 'expired' },
  play: async () => {
    const view = await ticket();
    await expect(view.getByText(/Expired on .*20.* · 2 lessons unused/)).toBeVisible();
    await expect(view.getByRole('button', { name: 'Extend' })).toBeVisible();
  },
};

/** 05 · Extended by a pause: +14 days, the badge and the callout (L-102). */
export const Paused: Story = {
  args: { state: 'paused' },
  play: async () => {
    const view = await ticket();
    await expect(view.getByText('Extended by 14 days for a pause')).toBeVisible();
    await expect(view.getByText('Extended')).toBeVisible();
  },
};

/** Board 03 · 01–02: a payment in part, then more than is left (OVERPAYMENT). */
export const Payment: Story = {
  play: async ({ args }) => {
    await userEvent.click((await ticket()).getByRole('button', { name: 'Record payment' }));
    const pay = await dialog('Package payment');
    await expect(pay.getByText('Left to pay')).toBeVisible();
    const amount = pay.getByLabelText('Amount');
    await userEvent.clear(amount);
    await userEvent.type(amount, '2500');
    await userEvent.click(pay.getByRole('button', { name: 'Record 2,500 ₴' }));
    await expect(await pay.findByText('No more than is left to pay for the package')).toBeVisible();
    await userEvent.clear(amount);
    await userEvent.type(amount, '1000');
    await expect(pay.getByText('1,000 ₴ will be left to pay')).toBeVisible();
    await userEvent.click(pay.getByRole('button', { name: 'Record 1,000 ₴' }));
    await wrote(args.onWrite, /^\/payments$/);
    await expect(bodyOf(args.onWrite, /^\/payments$/)).toMatchObject({
      packageId: TICKET_IDS.partial,
      amountMinor: 100000,
      method: 'BANK_TRANSFER',
      currency: 'UAH',
    });
  },
};

/** Board 03 · 03: extend an expired package by a month. */
export const Extend: Story = {
  args: { state: 'expired' },
  play: async ({ args }) => {
    await userEvent.click((await ticket()).getByRole('button', { name: 'Extend' }));
    const extend = await dialog('Extend the package');
    await userEvent.click(extend.getByRole('button', { name: '+1 month' }));
    await expect(extend.getByText('The price and payments stay')).toBeVisible();
    await userEvent.click(extend.getByRole('button', { name: /Extend to/ }));
    await wrote(args.onWrite, /\/extend$/);
    await expect(bodyOf(args.onWrite, /\/extend$/)).toHaveProperty('expiresAt');
  },
};

/** Board 03 · 04: two lessons to B1 English at 350 ₴ — two there and 300 ₴ left over (L-85). */
export const Transfer: Story = {
  args: { state: 'expired' },
  play: async ({ args }) => {
    await userEvent.click((await ticket()).getByRole('button', { name: 'Transfer' }));
    const move = await dialog('Transfer lessons');
    // The directions arrive after the dialog: the first same-currency one is picked.
    await waitFor(() => expect(move.getByRole('combobox')).toHaveTextContent('B1 English'), {
      timeout: 5000,
    });
    await userEvent.click(move.getByRole('combobox'));
    const list = within(await body().findByRole('listbox', {}, { timeout: 5000 }));
    await waitFor(() => expect(list.getByText('another currency')).toBeVisible());
    await userEvent.keyboard('{Escape}');
    await expect(await move.findByText('300 ₴ left over', {}, { timeout: 5000 })).toBeVisible();
    await expect(move.getByText('1,000 ₴ → 700 ₴')).toBeVisible();
    await userEvent.click(move.getByRole('button', { name: 'Transfer 2 lessons' }));
    await wrote(args.onWrite, /\/transfer$/);
    await expect(bodyOf(args.onWrite, /\/transfer$/)).toMatchObject({
      toEnrollmentId: 'e6e6e6e6-0000-4000-8000-000000000002',
      credits: 2,
    });
  },
};

/** Board 03 · 05: take back the unused lessons and return what they cost, by transfer. */
export const Refund: Story = {
  args: { state: 'expired' },
  play: async ({ args }) => {
    await userEvent.click((await ticket()).getByRole('button', { name: 'Refund' }));
    const refund = await dialog('Refund');
    await userEvent.type(refund.getByLabelText('Reason'), 'Moved away');
    await userEvent.click(refund.getByRole('button', { name: 'Refund 1,000 ₴' }));
    await wrote(args.onWrite, /\/refund$/);
    await expect(bodyOf(args.onWrite, /\/refund$/)).toMatchObject({
      credits: 2,
      amountMinor: 100000,
      method: 'BANK_TRANSFER',
      note: 'Moved away',
    });
  },
};

/** Board 03 · 06: one more lesson, with the reason. */
export const Correction: Story = {
  play: async ({ args }) => {
    const view = await ticket();
    await userEvent.click(view.getByRole('button', { name: 'More package actions' }));
    await userEvent.click(await body().findByRole('menuitem', { name: 'Correct lessons' }));
    const adjust = await dialog('Correct lessons');
    await expect(adjust.getByText('+1 correction')).toBeVisible();
    await userEvent.click(adjust.getByRole('button', { name: 'Save' }));
    await expect(await adjust.findByText('Add a reason')).toBeVisible();
    await userEvent.type(adjust.getByLabelText('Why'), 'Cancelled by the teacher');
    await userEvent.click(adjust.getByRole('button', { name: 'Save' }));
    await wrote(args.onWrite, /\/adjust$/);
    await expect(bodyOf(args.onWrite, /\/adjust$/)).toEqual({
      delta: 1,
      note: 'Cancelled by the teacher',
    });
  },
};

/** Board 03 · 08: a used package cannot be deleted; the dialog offers the refund. */
export const DeleteBlocked: Story = {
  play: async ({ args }) => {
    const view = await ticket();
    await userEvent.click(view.getByRole('button', { name: 'More package actions' }));
    await userEvent.click(await body().findByRole('menuitem', { name: 'Delete' }));
    const blocked = await dialog('Cannot delete');
    await expect(blocked.getByText('4 lessons have been taken from the package')).toBeVisible();
    await userEvent.click(blocked.getByRole('button', { name: 'Refund the unused' }));
    await expect(await dialog('Refund')).toBeDefined();
    await expect(args.onWrite).not.toHaveBeenCalled();
  },
};

/** Board 03 · 07: an unused package is deleted. */
export const Delete: Story = {
  args: { state: 'unused' },
  play: async ({ args }) => {
    const view = await dialog('Starter');
    await userEvent.click(view.getByRole('button', { name: 'More package actions' }));
    await userEvent.click(await body().findByRole('menuitem', { name: 'Delete' }));
    const remove = await dialog('Delete the package?');
    await userEvent.click(remove.getByRole('button', { name: 'Delete' }));
    await wrote(args.onWrite, new RegExp(`/packages/${STARTER}$`));
  },
};

/** The phone: the ticket as a bottom sheet. */
export const Phone: Story = {
  globals: MOBILE_VIEWPORT,
  beforeEach: forceMobileMediaQuery,
  play: async () => {
    const view = await ticket();
    await expect(view.getByRole('button', { name: 'Record payment' })).toBeVisible();
  },
};
