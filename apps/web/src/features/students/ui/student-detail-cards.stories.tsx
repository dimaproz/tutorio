import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { PackageResponse, ParentListItem } from '@tutorio/validation';
import { StudentPackagesCard } from './student-packages-card';
import { StudentParentsCard } from './student-parents-card';
import { StudentSetupCard } from './student-setup-card';
import { StudentLearningCard } from './student-learning-card';
import { STORY_STUDENT_ID, StudentStoryProviders, storyStudent } from '@/stories/student-story-support';

const storyPackage: PackageResponse = {
  id: '77777777-7777-4777-8777-777777777777',
  workspaceId: storyStudent.workspaceId,
  studentId: STORY_STUDENT_ID,
  groupId: null,
  name: 'B2 preparation',
  sizingMode: 'FIXED_COUNT',
  lessonsTotal: 8,
  endDate: null,
  pricePerLessonMinorSnapshot: 50000,
  totalPriceMinorSnapshot: 400000,
  effectiveTotalMinor: 400000,
  remainingCredits: 6,
  consumedCredits: 2,
  paidMinor: 400000,
  currency: 'UAH',
  paymentStatus: 'PAID',
  purchasedAt: '2026-09-01T10:00:00.000Z',
  expiresAt: null,
  notes: null,
  student: { id: STORY_STUDENT_ID, fullName: storyStudent.fullName },
  group: null,
  shares: [],
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  deletedAt: null,
};

const availableParent: ParentListItem = {
  id: '88888888-8888-4888-8888-888888888888',
  fullName: 'Oleksii Shevchenko',
  phone: '+380501111111',
  telegramUsername: null,
  avatarKey: null,
  deletedAt: null,
  students: [],
};

function Packages({ populated = false, readOnly = false, queryState, status = 'PAID', archived = false }: { populated?: boolean; readOnly?: boolean; queryState?: 'pending' | 'error'; status?: PackageResponse['paymentStatus']; archived?: boolean }) {
  const [open, setOpen] = useState(false);
  const pkg = { ...storyPackage, paymentStatus: status, deletedAt: archived ? '2026-09-08T10:00:00.000Z' : null };
  return <StudentStoryProviders packages={populated ? [pkg] : []} packageQueryState={queryState}><StudentPackagesCard studentId={STORY_STUDENT_ID} createOpen={open} onCreateOpenChange={setOpen} readOnly={readOnly} /></StudentStoryProviders>;
}

function Parents({ empty = false, readOnly = false, withOption = false, queryState }: { empty?: boolean; readOnly?: boolean; withOption?: boolean; queryState?: 'pending' | 'error' }) {
  const [open, setOpen] = useState(false);
  const student = empty ? { ...storyStudent, parents: [] } : storyStudent;
  return <StudentStoryProviders student={student} parents={withOption ? [availableParent] : []} parentQueryState={queryState}><StudentParentsCard student={student} createOpen={open} onCreateOpenChange={setOpen} readOnly={readOnly} /></StudentStoryProviders>;
}

function DismissibleSetup() {
  const [visible, setVisible] = useState(true);
  return visible ? <StudentSetupCard onDismiss={() => setVisible(false)} onAction={() => undefined} /> : <p>Setup dismissed</p>;
}

function Learning({ queryState }: { queryState?: 'pending' | 'error' | 'missing' }) {
  const [open, setOpen] = useState(false);
  return <StudentStoryProviders enrollmentQueryState={queryState}><StudentLearningCard student={storyStudent} createOpen={open} onCreateOpenChange={setOpen} /></StudentStoryProviders>;
}

const meta = { title: 'Students/Detail cards' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const SetupDefault: Story = { render: () => <StudentSetupCard onDismiss={() => undefined} onAction={() => undefined} /> };

export const SetupLongUkrainian: Story = {
  render: () => <StudentSetupCard onDismiss={() => undefined} onAction={() => undefined} />,
  globals: { locale: 'uk' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const SetupDismissed: Story = {
  render: () => <DismissibleSetup />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss setup suggestions' }));
    await expect(canvas.getByText('Setup dismissed')).toBeVisible();
  },
};

export const PackagesEmpty: Story = { render: () => <Packages /> };
export const PackagesLoading: Story = { render: () => <Packages queryState="pending" /> };
export const PackagesPopulated: Story = {
  render: () => <Packages populated />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Paid')).toBeVisible();
    await expect(canvas.getByText('6 of 8 lessons left', { exact: false })).toBeVisible();
  },
};
export const PackagesPartial: Story = { render: () => <Packages populated status="PARTIAL" /> };
export const PackagesPending: Story = { render: () => <Packages populated status="PENDING" /> };
export const PackagesError: Story = { render: () => <Packages queryState="error" /> };
export const PackagesArchivedReadOnly: Story = {
  render: () => <Packages populated readOnly archived />,
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button', { name: 'Add package' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: /B2 preparation/ })).toBeVisible();
  },
};

export const LearningQueryErrorCannotCreate: Story = {
  render: () => <Learning queryState="error" />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Could not load this enrollment')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Edit' })).toBeDisabled();
    await expect(within(document.body).queryByRole('dialog', { name: 'New enrollment' })).not.toBeInTheDocument();
  },
};

export const LearningMissingCannotCreate: Story = {
  render: () => <Learning queryState="missing" />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Could not load this enrollment')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Edit' })).toBeDisabled();
    await expect(within(document.body).queryByRole('dialog', { name: 'New enrollment' })).not.toBeInTheDocument();
  },
};

export const ParentsLoading: Story = { render: () => <Parents queryState="pending" /> };
export const ParentsEmpty: Story = { render: () => <Parents empty /> };
export const ParentsPopulated: Story = { render: () => <Parents /> };
export const ParentsError: Story = { render: () => <Parents queryState="error" /> };
export const ParentsLink: Story = {
  render: () => <Parents withOption />,
  play: async ({ canvas }) => {
    let sentBody: BodyInit | null | undefined;
    const fetchMock = fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentBody = init?.body;
      return new Response(JSON.stringify(storyStudent), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const previousFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;
    try {
      await userEvent.click(canvas.getByRole('combobox', { name: 'Link an existing parent' }));
      await userEvent.click(await within(document.body).findByRole('option', { name: /Oleksii Shevchenko/ }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      await expect(String(sentBody)).toContain(availableParent.id);
    } finally {
      globalThis.fetch = previousFetch;
    }
  },
};
export const ParentsUnlink: Story = {
  render: () => <Parents />,
  play: async ({ canvas }) => {
    let sentBody: BodyInit | null | undefined;
    const fetchMock = fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentBody = init?.body;
      return new Response(JSON.stringify({ ...storyStudent, parents: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const previousFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Unlink Iryna Shevchenko' }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      await expect(String(sentBody)).toContain('"parentIds":[]');
    } finally {
      globalThis.fetch = previousFetch;
    }
  },
};
export const ParentsLinkRetry: Story = {
  render: () => <Parents withOption />,
  play: async ({ canvas }) => {
    let attempts = 0;
    const fetchMock = fn(async () => {
      attempts += 1;
      return attempts === 1
        ? new Response(JSON.stringify({ code: 'UNEXPECTED' }), { status: 500, headers: { 'content-type': 'application/json' } })
        : new Response(JSON.stringify(storyStudent), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const previousFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;
    try {
      await userEvent.click(canvas.getByRole('combobox', { name: 'Link an existing parent' }));
      await userEvent.click(await within(document.body).findByRole('option', { name: /Oleksii Shevchenko/ }));
      await userEvent.click(await canvas.findByRole('button', { name: 'Retry linking' }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    } finally {
      globalThis.fetch = previousFetch;
    }
  },
};
export const ParentsCreateThenRetryLink: Story = {
  render: () => <Parents empty />,
  play: async ({ canvas }) => {
    const createdParent = {
      id: availableParent.id,
      workspaceId: storyStudent.workspaceId,
      fullName: availableParent.fullName,
      phone: null,
      telegramUsername: null,
      avatarKey: null,
      notes: null,
      createdAt: '2026-09-20T10:00:00.000Z',
      updatedAt: '2026-09-20T10:00:00.000Z',
      deletedAt: null,
    };
    let patchAttempts = 0;
    const fetchMock = fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/backend/parents') && init?.method === 'POST') {
        return new Response(JSON.stringify(createdParent), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.includes('/api/backend/parents')) {
        return new Response(JSON.stringify({ items: [{ ...availableParent, fullName: createdParent.fullName }], page: 1, pageSize: 100, total: 1, totalPages: 1 }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.endsWith(`/api/backend/students/${STORY_STUDENT_ID}`) && init?.method === 'PATCH') {
        patchAttempts += 1;
        return patchAttempts === 1
          ? new Response(JSON.stringify({ code: 'UNEXPECTED' }), { status: 500, headers: { 'content-type': 'application/json' } })
          : new Response(JSON.stringify(storyStudent), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const previousFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Create parent' }));
      const body = within(document.body);
      await userEvent.type(await body.findByLabelText('Full name'), createdParent.fullName);
      await userEvent.click(body.getByRole('button', { name: 'Create parent' }));
      await expect(await canvas.findByRole('button', { name: 'Retry linking' })).toBeVisible();
      await userEvent.click(canvas.getByRole('combobox', { name: 'Link an existing parent' }));
      await expect(await body.findByRole('option', { name: new RegExp(createdParent.fullName) })).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      await userEvent.click(canvas.getByRole('button', { name: 'Retry linking' }));
      await waitFor(() => expect(patchAttempts).toBe(2));
    } finally {
      globalThis.fetch = previousFetch;
    }
  },
};
export const ParentsArchivedReadOnly: Story = {
  render: () => <Parents readOnly />,
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button', { name: 'Create parent' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('link', { name: /Iryna Shevchenko/ })).toBeVisible();
  },
};
