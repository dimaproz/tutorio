import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { StudentDetailView } from '@/features/students';
import { PACKAGES_CLOCK } from '@/stories/packages-story-backend';
import { BILLING_STUDENT_ID } from '@/stories/student-billing-story-backend';
import { StoryBackend } from '@/stories/story-backend';
import { forceMobileMediaQuery, MOBILE_VIEWPORT, StoryClock } from '@/stories/story-helpers';
import { StoryAppShell } from '@/stories/story-shell';
import { PackageSaleDialog } from './package-sale-dialog';

const ENGLISH = 'e6e6e6e6-0000-4000-8000-000000000001';

type Write = { method: string; path: string; body: unknown };
type Args = { onWrite: (write: Write) => void };

/**
 * «Новий пакет» (S07 board 01) over Anna's profile: English with Dmytro,
 * 500 ₴ a lesson, Mondays and Fridays at 17:00, «B2 preparation» 6 of 8 in
 * use. The named stories are the board's states and the interaction tests:
 * each kind, both price directions, the errors and «Пакет продано». Every
 * write reaches `onWrite`. The clock is Friday 25 September 2026.
 */
function SaleScreen({ onWrite }: Args) {
  const [open, setOpen] = useState(true);
  return (
    <StoryBackend profileBilling={{ state: 'three' }} packagesStory={{ onWrite }}>
      <StoryClock now={PACKAGES_CLOCK}>
        <StoryAppShell pathname={`/app/students/${BILLING_STUDENT_ID}`}>
          <StudentDetailView studentId={BILLING_STUDENT_ID} />
          <PackageSaleDialog
            open={open}
            onOpenChange={setOpen}
            studentId={BILLING_STUDENT_ID}
            enrollmentId={ENGLISH}
            nowMs={PACKAGES_CLOCK}
          />
        </StoryAppShell>
      </StoryClock>
    </StoryBackend>
  );
}

const meta = {
  title: 'Packages/Screens/Sale',
  component: SaleScreen,
  parameters: {
    layout: 'fullscreen',
    fullBleed: true,
    nextjs: {
      appDirectory: true,
      navigation: { pathname: `/app/students/${BILLING_STUDENT_ID}`, query: {} },
    },
  },
  args: { onWrite: fn() },
  argTypes: { onWrite: { table: { disable: true } } },
} satisfies Meta<typeof SaleScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);
const sale = async () => {
  const element = await body().findByRole('dialog', { name: 'New package' }, { timeout: 5000 });
  await waitFor(() => expect(getComputedStyle(element).opacity).toBe('1'), { timeout: 5000 });
  return within(element);
};
const sold = (onWrite: Args['onWrite']) =>
  waitFor(() =>
    expect(onWrite).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', path: '/packages' }),
    ),
  );
const soldBody = (onWrite: Args['onWrite']) =>
  (onWrite as ReturnType<typeof fn>).mock.calls.find(
    ([write]) => (write as Write).path === '/packages',
  )?.[0].body as Record<string, unknown>;

/** 01 · By count: 8 lessons at the direction's rate, until 25 October, with the preview. */
export const Playground: Story = {
  play: async () => {
    const form = await sale();
    await expect(
      await form.findByText('Anna Shevchenko · English', {}, { timeout: 5000 }),
    ).toBeDefined();
    const preview = within(await form.findByRole('region', { name: 'It will look like this' }));
    await waitFor(() => expect(preview.getByText('4,000 ₴')).toBeVisible(), { timeout: 5000 });
    await expect(form.getByText('8 × 500 ₴')).toBeVisible();
  },
};

/** The count sale sent: the teacher's direction, 8 lessons, the price per lesson. */
export const SellByCount: Story = {
  play: async ({ args }) => {
    const form = await sale();
    await waitFor(() => expect(form.getByText('8 × 500 ₴')).toBeVisible(), { timeout: 5000 });
    await userEvent.click(form.getByRole('button', { name: 'Sell package' }));
    await sold(args.onWrite);
    await expect(soldBody(args.onWrite)).toMatchObject({
      studentId: BILLING_STUDENT_ID,
      teacherId: '55555555-5555-4555-8555-555555555555',
      sizingMode: 'FIXED_COUNT',
      lessonsTotal: 8,
      pricePerLessonMinor: 50000,
      currency: 'UAH',
    });
    await expect(await body().findByRole('dialog', { name: 'Package sold' })).toBeDefined();
  },
};

/** 02 · A period from the schedule: the credits come from Mondays and Fridays, editable. */
export const ByPeriod: Story = {
  play: async ({ args }) => {
    const form = await sale();
    await userEvent.click(form.getByRole('radio', { name: /Period from the schedule/ }));
    await expect(await form.findByText('From the schedule', {}, { timeout: 5000 })).toBeVisible();
    await userEvent.click(form.getByRole('button', { name: 'Sell package' }));
    await sold(args.onWrite);
    const sent = soldBody(args.onWrite);
    await expect(sent).toMatchObject({ sizingMode: 'BY_PERIOD', pricePerLessonMinor: 50000 });
    await expect(sent).not.toHaveProperty('lessonsTotal');
  },
};

/** 03 · A period, 3 a week: no schedule needed. */
export const Weekly: Story = {
  play: async ({ args }) => {
    const form = await sale();
    await userEvent.click(form.getByRole('radio', { name: /Period, N a week/ }));
    await userEvent.click(await form.findByRole('radio', { name: '3' }));
    await expect(form.getByText('No schedule needed — add lessons as it suits')).toBeVisible();
    await userEvent.click(form.getByRole('button', { name: 'Sell package' }));
    await sold(args.onWrite);
    await expect(soldBody(args.onWrite)).toMatchObject({
      sizingMode: 'BY_PERIOD_WEEKLY',
      lessonsPerWeek: 3,
    });
  },
};

/** 04 · The price per package typed: the per-lesson price follows (decision 2). */
export const TotalPrice: Story = {
  play: async ({ args }) => {
    const form = await sale();
    const total = form.getByLabelText('Per package');
    await userEvent.clear(total);
    await userEvent.type(total, '3600');
    await waitFor(() => expect(form.getByLabelText('Per lesson')).toHaveValue('450'));
    await userEvent.click(form.getByRole('button', { name: 'Sell package' }));
    await sold(args.onWrite);
    const sent = soldBody(args.onWrite);
    await expect(sent).toMatchObject({ totalPriceMinor: 360000 });
    await expect(sent).not.toHaveProperty('pricePerLessonMinor');
  },
};

/** 05 · The errors: a count from 1 and a price above zero; the preview waits. */
export const Errors: Story = {
  play: async ({ args }) => {
    const form = await sale();
    const count = form.getByLabelText('How many lessons');
    await userEvent.clear(count);
    await userEvent.type(count, '0');
    const price = form.getByLabelText('Per lesson');
    await userEvent.clear(price);
    await userEvent.type(price, '0');
    await userEvent.click(form.getByRole('button', { name: 'Sell package' }));
    await expect(await form.findByText('Enter how many lessons — at least 1')).toBeVisible();
    await expect(form.getByText('More than 0')).toBeVisible();
    await expect(
      form.getByText('Enter the count and the price — the package appears here'),
    ).toBeVisible();
    await expect(args.onWrite).not.toHaveBeenCalled();
  },
};

/** 06 · «Пакет продано» with its next actions: record the payment, open the schedule. */
export const Sold: Story = {
  play: async () => {
    const form = await sale();
    await userEvent.click(form.getByRole('button', { name: 'Sell package' }));
    const done = within(
      await body().findByRole('dialog', { name: 'Package sold' }, { timeout: 5000 }),
    );
    await waitFor(() => expect(done.getByText('No payment recorded yet')).toBeVisible());
    await userEvent.click(done.getByRole('button', { name: 'Record payment · 4,000 ₴' }));
    await expect(
      await body().findByRole('dialog', { name: 'Package payment' }, { timeout: 5000 }),
    ).toBeDefined();
  },
};

/** The phone: full screen with the price summary in the footer. */
export const Phone: Story = {
  globals: MOBILE_VIEWPORT,
  beforeEach: forceMobileMediaQuery,
  play: async () => {
    const form = await sale();
    await waitFor(() => expect(form.getByText(/4,000 ₴ · 8 lessons/)).toBeVisible(), {
      timeout: 5000,
    });
  },
};
