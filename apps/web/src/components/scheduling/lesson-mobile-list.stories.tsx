import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { LessonResponse } from '@tutorio/validation';
import { LessonMobileList } from './lesson-mobile-list';
import { StudentStoryProviders } from '@/stories/student-story-support';

const lesson: LessonResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  workspaceId: '22222222-2222-4222-8222-222222222222',
  enrollmentId: '33333333-3333-4333-8333-333333333333',
  groupId: null,
  seriesId: null,
  charges: [],
  teacherId: '44444444-4444-4444-8444-444444444444',
  startsAtUtc: '2026-09-10T14:00:00.000Z',
  durationMin: 60,
  priceMinor: 50000,
  currency: 'UAH',
  status: 'SCHEDULED',
  isDetached: false,
  rescheduledCount: 0,
  kind: 'REGULAR',
  originalLessonId: null,
  makeupLessonId: null,
  topic: null,
  rescheduledAt: null,
  cancelledBy: null,
  cancelledReason: null,
  cancelledAt: null,
  completedAt: null,
  paidAt: null,
  notes: null,
  attendance: null,
  cancellationDeadlineHours: 12,
  student: { id: '55555555-5555-4555-8555-555555555555', fullName: 'Anna Shevchenko' },
  group: null,
  teacher: { id: '44444444-4444-4444-8444-444444444444', name: 'Dmytro Tutor', color: null },
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  deletedAt: null,
};

const onOpenDialog = fn();
const meta = { title: 'Scheduling/Lesson mobile list' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  render: () => <StudentStoryProviders><LessonMobileList lessons={[lesson]} emptyMessage="No lessons" onOpenDialog={onOpenDialog} /></StudentStoryProviders>,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('One-to-one')).toBeVisible();
    await expect(canvas.getByText(/500/)).toBeVisible();
    const trigger = canvas.getByRole('button', { name: 'Open menu' });
    await userEvent.click(trigger);
    await expect(await within(document.body).findByRole('menuitem', { name: 'Mark completed' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(document.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeInTheDocument();
      expect(document.querySelector('[data-aria-hidden="true"][aria-hidden="true"]')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  },
};

export const Empty: Story = {
  render: () => <StudentStoryProviders><LessonMobileList lessons={[]} emptyMessage="No upcoming lessons" onOpenDialog={onOpenDialog} /></StudentStoryProviders>,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const UkrainianDark: Story = {
  render: () => <StudentStoryProviders><LessonMobileList lessons={[lesson]} emptyMessage="Уроків немає" onOpenDialog={onOpenDialog} /></StudentStoryProviders>,
  globals: { locale: 'uk', theme: 'dark' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
