import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { StudentStatusDto } from '@tutorio/validation';
import { SAMPLE_STUDENTS, StoryBackend } from '@/stories/story-backend';
import { forceMobileMediaQuery } from '@/stories/story-helpers';
import { StudentStatusControl } from './student-status-control';

type Args = {
  status: StudentStatusDto;
  size: 'sm' | 'md' | 'lg';
  note: string;
};

/**
 * StudentStatusControl: the pill with its dropdown on desktop and its bottom
 * sheet on phones (viewport toolbar: Handoff mobile 390). Choosing "Paused"
 * opens the pause dialog, "Archived" the archive confirmation; resume
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
    await expect(sheet.getByRole('radio', { name: /Paused/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  },
};

/** «На паузі» opens the pause dialog with dates (S06 decision 8). */
export const Pause: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Student status: Active/ }));
    const body = within(document.body);
    const menu = within(await body.findByRole('menu', {}, { timeout: 5000 }));
    const paused = menu.getByRole('menuitemradio', { name: /Paused/ });
    await waitFor(() => expect(paused).toBeVisible());
    await userEvent.click(paused);
    const dialog = within(await body.findByRole('dialog', {}, { timeout: 5000 }));
    await waitFor(() => expect(dialog.getByRole('heading', { name: 'Pause' })).toBeVisible());
  },
};
