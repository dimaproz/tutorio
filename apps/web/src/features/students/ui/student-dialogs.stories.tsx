import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { getRouter } from '@storybook/nextjs-vite/navigation.mock';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { StudentEditDialog } from './student-edit-dialog';
import { StudentQuickCreateDialog } from './student-quick-create-dialog';
import { STORY_STUDENT_ID, StudentStoryProviders, storyStudent } from '@/stories/student-story-support';

function QuickCreateStory({ navigateOnSuccess = false, initialTimezone }: { navigateOnSuccess?: boolean; initialTimezone?: string }) {
  const [open, setOpen] = useState(true);
  return <StudentStoryProviders><StudentQuickCreateDialog open={open} onOpenChange={setOpen} navigateOnSuccess={navigateOnSuccess} initialTimezone={initialTimezone} /></StudentStoryProviders>;
}

function EditStory() {
  const [open, setOpen] = useState(true);
  return <StudentStoryProviders><StudentEditDialog open={open} onOpenChange={setOpen} studentId={STORY_STUDENT_ID} /></StudentStoryProviders>;
}

const meta = { title: 'Students/Dialogs' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const QuickCreateDefault: Story = {
  render: () => <QuickCreateStory />,
  play: async () => {
    const body = within(document.body);
    await expect(body.getByRole('dialog', { name: 'New student' })).toBeInTheDocument();
    await expect(body.getByLabelText('Full name')).toHaveFocus();
    await expect(body.queryByLabelText('Email')).not.toBeInTheDocument();
  },
};

export const QuickCreateSuccess: Story = {
  render: () => <QuickCreateStory navigateOnSuccess initialTimezone="Europe/Kyiv" />,
  play: async () => {
    const body = within(document.body);
    const router = getRouter();
    router.push.mockClear();
    let requestInput: RequestInfo | URL | undefined;
    let requestInit: RequestInit | undefined;
    const fetchMock = fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requestInput = input;
      requestInit = init;
      return new Response(JSON.stringify(storyStudent), { status: 201, headers: { 'content-type': 'application/json' } });
    });
    const previousFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;
    try {
      await userEvent.type(body.getByLabelText('Full name'), 'Anna Shevchenko');
      await userEvent.click(body.getByRole('button', { name: 'Create student' }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      await expect(String(requestInput)).toBe('/api/backend/students');
      await expect(requestInit?.method).toBe('POST');
      await expect(JSON.parse(String(requestInit?.body))).toEqual({
        fullName: 'Anna Shevchenko',
        timezone: 'Europe/Kyiv',
        status: 'ACTIVE',
      });
      await expect(String(requestInput)).not.toMatch(/parents|enrollments|packages|lessons/);
      await expect(router.push).toHaveBeenCalledWith(`/app/students/${storyStudent.id}?setup=1`);
    } finally {
      globalThis.fetch = previousFetch;
      router.push.mockClear();
    }
  },
};

export const QuickCreateExpanded: Story = {
  render: () => <QuickCreateStory />,
  play: async () => {
    const body = within(document.body);
    await userEvent.click(body.getByRole('button', { name: 'Add more details' }));
    await waitFor(() => expect(body.getByLabelText('Email')).toBeVisible());
    await waitFor(() => expect(body.getByLabelText('Timezone')).toBeVisible());
  },
};

export const QuickCreateValidationError: Story = {
  render: () => <QuickCreateStory />,
  play: async () => {
    const body = within(document.body);
    await userEvent.click(body.getByRole('button', { name: 'Create student' }));
    await waitFor(() => expect(body.getByLabelText('Full name')).toHaveAttribute('aria-invalid', 'true'));
    await expect(body.getByLabelText('Full name')).toHaveFocus();
  },
};

export const QuickCreateDirtyClose: Story = {
  render: () => <QuickCreateStory />,
  play: async () => {
    const body = within(document.body);
    await userEvent.type(body.getByLabelText('Full name'), 'Anna');
    await userEvent.click(body.getByRole('button', { name: 'Cancel' }));
    await expect(body.getByRole('alertdialog', { name: 'Discard changes?' })).toBeInTheDocument();
  },
};

export const QuickCreateRequestError: Story = {
  render: () => <QuickCreateStory />,
  play: async () => {
    const body = within(document.body);
    const submit = body.getByRole('button', { name: 'Create student' });
    await userEvent.type(body.getByLabelText('Full name'), 'Anna');
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ code: 'UNEXPECTED' }), { status: 500, headers: { 'content-type': 'application/json' } });
    try {
      await userEvent.click(submit);
      await expect(await body.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
      await expect(body.getByDisplayValue('Anna')).toBeInTheDocument();
    } finally {
      globalThis.fetch = previousFetch;
    }
  },
};

export const QuickCreatePending: Story = {
  render: () => <QuickCreateStory />,
  play: async () => {
    const body = within(document.body);
    const submit = body.getByRole('button', { name: 'Create student' });
    await userEvent.type(body.getByLabelText('Full name'), 'Anna');
    const previousFetch = globalThis.fetch;
    globalThis.fetch = () => new Promise<Response>(() => undefined);
    try {
      await userEvent.click(submit);
      await waitFor(() => expect(submit).toBeDisabled());
    } finally {
      globalThis.fetch = previousFetch;
    }
  },
};

export const QuickCreateNarrowUkrainian: Story = {
  render: () => <QuickCreateStory />,
  globals: { locale: 'uk' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const EditReady: Story = {
  render: () => <EditStory />,
  play: async () => {
    const body = within(document.body);
    await expect(body.getByRole('dialog', { name: 'Edit student' })).toBeInTheDocument();
    await expect(body.getByDisplayValue('Anna Shevchenko')).toBeInTheDocument();
  },
};

export const EditLoading: Story = {
  render: () => <StudentStoryProviders cacheStudent={false} studentQueryState="pending"><StudentEditDialog open onOpenChange={() => undefined} studentId={STORY_STUDENT_ID} /></StudentStoryProviders>,
};

export const EditDirtyClose: Story = {
  render: () => <EditStory />,
  play: async () => {
    const body = within(document.body);
    await userEvent.type(body.getByLabelText('Full name'), ' Junior');
    await userEvent.click(body.getByRole('button', { name: 'Cancel' }));
    await expect(body.getByRole('alertdialog', { name: 'Discard changes?' })).toBeInTheDocument();
  },
};

export const EditMutationError: Story = {
  render: () => <EditStory />,
  play: async () => {
    const body = within(document.body);
    const submit = body.getByRole('button', { name: 'Save changes' });
    await userEvent.type(body.getByLabelText('Full name'), ' Junior');
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ code: 'UNEXPECTED' }), { status: 500, headers: { 'content-type': 'application/json' } });
    try {
      await userEvent.click(submit);
      await expect(await body.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
      await expect(body.getByDisplayValue('Anna Shevchenko Junior')).toBeInTheDocument();
    } finally {
      globalThis.fetch = previousFetch;
    }
  },
};

export const EditLoadFailure: Story = {
  render: () => <StudentStoryProviders cacheStudent={false} studentQueryState="error"><StudentEditDialog open onOpenChange={() => undefined} studentId={STORY_STUDENT_ID} /></StudentStoryProviders>,
  play: async () => {
    const body = within(document.body);
    await expect(await body.findByText('Could not load the profile')).toBeInTheDocument();
    await expect(body.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    await expect(body.queryByRole('button', { name: 'Create student' })).not.toBeInTheDocument();
  },
};
