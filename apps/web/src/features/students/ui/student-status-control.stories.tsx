import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { StudentStatusDto } from '@tutorio/validation';
import { SAMPLE_STUDENTS, StoryBackend } from '@/stories/story-backend';
import { forceMobileMediaQuery } from '@/stories/story-helpers';
import { StudentHoldDialog } from './student-hold-dialog';
import { StudentStatusControl } from './student-status-control';

type Args = {
  status: StudentStatusDto;
  size: 'sm' | 'md' | 'lg';
  note: string;
};

/**
 * StudentStatusControl: the pill with its dropdown on desktop and its bottom
 * sheet on phones (viewport toolbar: Handoff mobile 390). Choosing "On a
 * break" opens the hold dialog, "Archived" the archive confirmation; resume
 * and restore apply at once.
 */
function StudentStatusControlStory({ status, size, note }: Args) {
  const student = { ...SAMPLE_STUDENTS[0], status };

  return (
    <StoryBackend>
      <div
        className={`w-fit rounded-block p-6 ${size === 'sm' ? 'bg-tint-indigo' : 'bg-background'}`}
      >
        <StudentStatusControl student={student} size={size} note={note || undefined} />
      </div>
    </StoryBackend>
  );
}

const meta = {
  title: 'Students/Components/StudentStatusControl',
  component: StudentStatusControlStory,
  args: { status: 'ACTIVE', size: 'sm', note: '' },
  argTypes: {
    status: { control: 'inline-radio', options: ['ACTIVE', 'ON_HOLD', 'ARCHIVED'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof StudentStatusControlStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Student status: Active/ }));
    const body = within(document.body);
    const menu = within(await body.findByRole('menu', {}, { timeout: 5000 }));
    const archived = menu.getByRole('menuitemradio', { name: /Archived/ });
    await waitFor(() => expect(archived).toBeVisible());
    await userEvent.click(archived);
    const dialog = within(await body.findByRole('alertdialog', {}, { timeout: 5000 }));
    await expect(dialog.getByText('Archive the student?')).toBeVisible();
  },
};

export const PhoneSheet: Story = {
  args: { status: 'ON_HOLD' },
  beforeEach: forceMobileMediaQuery,
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Student status/ }));
    const sheet = within(await within(document.body).findByRole('dialog'));
    await expect(sheet.getByRole('radio', { name: /On a break/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  },
};

type HoldArgs = { fullName: string; lessons: number; pending: boolean; onConfirm: () => void };

/** HoldDialog on its own: the lesson cancellation appears only with lessons to cancel. */
export const HoldDialog: StoryObj<HoldArgs> = {
  args: { fullName: 'Anna Shevchenko', lessons: 2, pending: false, onConfirm: fn() },
  argTypes: { lessons: { control: { type: 'range', min: 0, max: 6 } } },
  render: ({ fullName, lessons, pending, onConfirm }) => (
    <StudentHoldDialog
      open
      onOpenChange={() => undefined}
      fullName={fullName}
      scheduledLessons={lessons}
      pending={pending}
      onConfirm={onConfirm}
    />
  ),
  play: async ({ args }) => {
    const dialog = within(await within(document.body).findByRole('dialog'));
    await expect(
      dialog.getByRole('checkbox', { name: /Cancel 2 scheduled lessons/ }),
    ).toBeChecked();
    await userEvent.click(dialog.getByRole('button', { name: 'Send on a break' }));
    await expect(args.onConfirm).toHaveBeenCalledWith({ cancelLessons: true });
  },
};

/** The lessons could not be counted: retry, or pause and keep every lesson. */
export const HoldDialogCountFailed: StoryObj<HoldArgs & { onRetryCount: () => void }> = {
  args: {
    fullName: 'Anna Shevchenko',
    lessons: 0,
    pending: false,
    onConfirm: fn(),
    onRetryCount: fn(),
  },
  render: ({ fullName, pending, onConfirm, onRetryCount }) => (
    <StudentHoldDialog
      open
      onOpenChange={() => undefined}
      fullName={fullName}
      countFailed
      onRetryCount={onRetryCount}
      pending={pending}
      onConfirm={onConfirm}
    />
  ),
  play: async ({ args }) => {
    const dialog = within(await within(document.body).findByRole('dialog'));
    await waitFor(() =>
      expect(dialog.getByText('Couldn’t check the scheduled lessons')).toBeVisible(),
    );
    await expect(dialog.queryByRole('checkbox')).toBeNull();
    await userEvent.click(dialog.getByRole('button', { name: 'Try again' }));
    await expect(args.onRetryCount).toHaveBeenCalled();
    await userEvent.click(
      dialog.getByRole('button', { name: 'Send on a break without cancelling lessons' }),
    );
    await expect(args.onConfirm).toHaveBeenCalledWith({ cancelLessons: false });
  },
};
