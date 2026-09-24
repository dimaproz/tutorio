import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
  FRESH_STUDENT,
  FRESH_STUDENT_ID,
  SAMPLE_STUDENTS,
  StoryBackend,
} from '@/stories/story-backend';
import { StoryAppShell } from '@/stories/story-shell';
import { StudentDetailView } from './student-detail';

const PROFILE = {
  active: SAMPLE_STUDENTS[0].id,
  fresh: FRESH_STUDENT_ID,
  hold: SAMPLE_STUDENTS[6].id,
  archived: SAMPLE_STUDENTS[7].id,
} as const;

type Args = {
  profile: keyof typeof PROFILE;
  request: 'ready' | 'pending' | 'error';
};

/**
 * The student profile in the app frame. `profile` picks the four reference
 * states — active, freshly created (with the set-up checklist), on a break
 * and archived; `request` shows loading and a failed load. Status changes in
 * the hero run against the in-memory backend.
 */
function StudentProfileScreen({ profile, request }: Args) {
  const studentId = PROFILE[profile];
  return (
    <StoryBackend students={[...SAMPLE_STUDENTS, FRESH_STUDENT]} detail={request}>
      <StoryAppShell pathname={`/app/students/${studentId}`}>
        <StudentDetailView studentId={studentId} />
      </StoryAppShell>
    </StoryBackend>
  );
}

const meta = {
  title: 'Students/Screens/Profile',
  component: StudentProfileScreen,
  parameters: {
    layout: 'fullscreen',
    fullBleed: true,
  },
  args: { profile: 'active', request: 'ready' },
  argTypes: {
    profile: { control: 'inline-radio', options: ['active', 'fresh', 'hold', 'archived'] },
    request: { control: 'inline-radio', options: ['ready', 'pending', 'error'] },
  },
} satisfies Meta<typeof StudentProfileScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { level: 1, name: 'Anna Shevchenko' }),
    ).toBeVisible();
    // The next-lesson ticket and the ring metric read the student's own data.
    await expect(await canvas.findByText('6 of 8')).toBeVisible();
  },
};

/** Right after creation: the set-up checklist, zeros and empty asides. */
export const Fresh: Story = {
  args: { profile: 'fresh' },
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: `/app/students/${FRESH_STUDENT_ID}`, query: { setup: '1' } },
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Student created — choose the next step')).toBeVisible();
    await expect(await canvas.findByRole('button', { name: 'Add parent' })).toBeVisible();
  },
};

export const OnHold: Story = {
  args: { profile: 'hold' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Student is on a break')).toBeVisible();
  },
};

export const Archived: Story = {
  args: { profile: 'archived' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('This student is archived')).toBeVisible();
  },
};

/** Opening the status pill lists the three statuses with the current one checked. */
export const StatusMenu: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Student status: Active/ }));
    const menu = within(await within(document.body).findByRole('menu'));
    await expect(menu.getByRole('menuitemradio', { name: /Active/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await userEvent.click(menu.getByRole('menuitemradio', { name: /On a break/ }));
    const dialog = within(await within(document.body).findByRole('dialog'));
    await expect(dialog.getByText('Send the student on a break?')).toBeVisible();
  },
};
