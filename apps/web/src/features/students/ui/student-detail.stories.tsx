import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { getRouter } from '@storybook/nextjs-vite/navigation.mock';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { StudentDetailView, StudentProfileContent } from './student-detail';
import { STORY_NOW, STORY_STUDENT_ID, StudentStoryProviders, storyStudent } from '@/stories/student-story-support';

const meta = { title: 'Students/Detail' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  render: () => <StudentStoryProviders><StudentProfileContent student={storyStudent} nowMs={STORY_NOW} /></StudentStoryProviders>,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: 'Anna Shevchenko' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Schedule lesson' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Edit profile' })).toBeVisible();
  },
};

export const SetupState: Story = {
  render: () => <StudentStoryProviders><StudentProfileContent student={storyStudent} nowMs={STORY_NOW} /></StudentStoryProviders>,
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: `/app/students/${STORY_STUDENT_ID}`, query: { setup: '1' } } } },
  play: async ({ canvas }) => {
    const router = getRouter();
    router.replace.mockClear();
    await expect(canvas.getByText('Student created — choose the next step')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss setup suggestions' }));
    await expect(router.replace).toHaveBeenCalledWith(`/app/students/${STORY_STUDENT_ID}`, { scroll: false });
  },
};

export const SetupParentPaths: Story = {
  render: () => <StudentStoryProviders parents={[]}><StudentProfileContent student={storyStudent} nowMs={STORY_NOW} /></StudentStoryProviders>,
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: `/app/students/${STORY_STUDENT_ID}`, query: { setup: '1' } } } },
  play: async ({ canvas }) => {
    const setupCard = canvas.getByText('Student created — choose the next step').closest<HTMLElement>('[data-slot="card"]');
    await expect(setupCard).not.toBeNull();
    await userEvent.click(within(setupCard!).getByRole('button', { name: 'Add parent' }));
    await expect(canvas.getByRole('combobox', { name: 'Link an existing parent' })).toHaveFocus();
    await expect(canvas.getByRole('button', { name: 'Create parent' })).toBeVisible();
  },
};

export const SetupActionsKeepStudentLocked: Story = {
  render: () => <StudentStoryProviders><StudentProfileContent student={storyStudent} nowMs={STORY_NOW} /></StudentStoryProviders>,
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: `/app/students/${STORY_STUDENT_ID}`, query: { setup: '1' } } } },
  play: async ({ canvas }) => {
    const body = within(document.body);
    const setupCard = canvas.getByText('Student created — choose the next step').closest<HTMLElement>('[data-slot="card"]');
    await expect(setupCard).not.toBeNull();
    const setup = within(setupCard!);

    await userEvent.click(setup.getByRole('button', { name: 'Schedule' }));
    const lessonDialog = await body.findByRole('dialog', { name: 'New lesson' });
    await expect(within(lessonDialog).queryByRole('combobox', { name: 'Student' })).not.toBeInTheDocument();
    await userEvent.click(within(lessonDialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(body.queryByRole('dialog', { name: 'New lesson' })).not.toBeInTheDocument());

    await userEvent.click(setup.getByRole('button', { name: 'Add package' }));
    const packageDialog = await body.findByRole('dialog', { name: 'New package' });
    await expect(within(packageDialog).queryByRole('tab', { name: 'Student' })).not.toBeInTheDocument();
    await expect(within(packageDialog).queryByRole('tab', { name: 'Group' })).not.toBeInTheDocument();
    await userEvent.click(within(packageDialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(body.queryByRole('dialog', { name: 'New package' })).not.toBeInTheDocument());

    await userEvent.click(setup.getByRole('button', { name: 'Set up' }));
    const enrollmentDialog = await body.findByRole('dialog', { name: 'New enrollment' });
    await expect(within(enrollmentDialog).getByText(storyStudent.fullName)).toBeInTheDocument();
    await expect(within(enrollmentDialog).queryByRole('combobox', { name: 'Student' })).not.toBeInTheDocument();
    await userEvent.click(within(enrollmentDialog).getByRole('button', { name: 'Cancel' }));
  },
};

export const Archived: Story = {
  render: () => {
    const archived = { ...storyStudent, status: 'ARCHIVED' as const, deletedAt: '2026-09-08T10:00:00.000Z' };
    return <StudentStoryProviders student={archived}><StudentProfileContent student={archived} nowMs={STORY_NOW} /></StudentStoryProviders>;
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('This student is archived')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Restore' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Schedule lesson' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'More student actions' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Create parent' })).not.toBeInTheDocument();
  },
};

export const InitialLoading: Story = {
  render: () => <StudentStoryProviders cacheStudent={false} studentQueryState="pending"><StudentDetailView studentId={STORY_STUDENT_ID} /></StudentStoryProviders>,
};

export const QueryError: Story = {
  render: () => <StudentStoryProviders cacheStudent={false} studentQueryState="error"><StudentDetailView studentId={STORY_STUDENT_ID} /></StudentStoryProviders>,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Could not load this student')).toBeVisible();
  },
};

export const NarrowMobileUkrainian: Story = {
  render: () => <StudentStoryProviders><StudentProfileContent student={storyStudent} nowMs={STORY_NOW} /></StudentStoryProviders>,
  globals: { locale: 'uk' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const DarkTheme: Story = {
  render: () => <StudentStoryProviders><StudentProfileContent student={storyStudent} nowMs={STORY_NOW} /></StudentStoryProviders>,
  globals: { theme: 'dark' },
};
