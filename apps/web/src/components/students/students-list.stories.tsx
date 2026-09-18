import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { StudentListItem, StudentListResponse } from '@tutorio/validation';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { QueryErrorAlert } from '@/components/shared/page-shell';
import { StudentCard } from './student-card';
import { StudentMetricCard, StudentsEmptyState, StudentsList } from './students-list';
import { StudentsListSkeleton } from './students-list-skeleton';
import { queryKeys } from '@/lib/api/keys';

const items = [
  {
    id: 'd6bf671d-7a0f-4cf3-8a67-c7a46a2bf4e9',
    fullName: 'Anna Shevchenko',
    email: 'anna@example.test',
    phone: '+380501112233',
    telegramUsername: 'anna_s',
    timezone: 'Europe/Kyiv',
    status: 'ACTIVE',
    hourlyRateMinor: null,
    currency: null,
    avatarKey: 'user-1',
    createdAt: '2026-09-09T10:00:00.000Z',
    deletedAt: null,
    activeEnrollmentCount: 1,
    groupNames: [],
  },
  {
    id: 'fa63b64f-4ea3-4f75-b6b0-4dd0df11a4a7',
    fullName: 'Oleksii Koval',
    email: null,
    phone: null,
    telegramUsername: null,
    timezone: 'Europe/Kyiv',
    status: 'ON_HOLD',
    hourlyRateMinor: null,
    currency: null,
    avatarKey: null,
    createdAt: '2026-08-30T10:00:00.000Z',
    deletedAt: null,
    activeEnrollmentCount: 1,
    groupNames: ['B1 English'],
  },
  {
    id: 'd638c281-6d61-49c2-8af7-24802763a7bb',
    fullName: 'Kateryna Bondarenko',
    email: null,
    phone: null,
    telegramUsername: null,
    timezone: 'Europe/Kyiv',
    status: 'ARCHIVED',
    hourlyRateMinor: null,
    currency: null,
    avatarKey: null,
    createdAt: '2026-08-18T10:00:00.000Z',
    deletedAt: '2026-09-01T10:00:00.000Z',
    activeEnrollmentCount: 0,
    groupNames: [],
  },
] satisfies StudentListItem[];

const response: StudentListResponse = {
  items,
  page: 1,
  pageSize: 20,
  total: items.length,
  totalPages: 2,
};

function StudentsListWithCachedQueries() {
  const [client] = useState(() => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(
      queryKeys.students.lists({
        page: 1,
        state: 'active',
        sort: 'fullName',
        order: 'asc',
      }),
      response,
    );
    queryClient.setQueryData(queryKeys.groups.lists({ page: 1, pageSize: 100 }), {
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
      totalPages: 1,
    });
    queryClient.setQueryData(queryKeys.students.lists({ page: 1, pageSize: 1, state: 'active' }), {
      ...response,
      items: items.slice(0, 1),
      pageSize: 1,
      total: 12,
      totalPages: 12,
    });
    queryClient.setQueryData(
      queryKeys.students.lists({ page: 1, pageSize: 1, state: 'active', status: 'ACTIVE' }),
      { ...response, items: items.slice(0, 1), pageSize: 1, total: 9, totalPages: 9 },
    );
    queryClient.setQueryData(
      queryKeys.students.lists({ page: 1, pageSize: 1, state: 'active', status: 'ON_HOLD' }),
      { ...response, items: items.slice(1, 2), pageSize: 1, total: 3, totalPages: 3 },
    );
    queryClient.setQueryData(
      queryKeys.students.lists({ page: 1, pageSize: 1, state: 'deleted', status: 'ARCHIVED' }),
      { ...response, items: items.slice(2, 3), pageSize: 1, total: 2, totalPages: 2 },
    );
    return queryClient;
  });

  return (
    <QueryClientProvider client={client}>
      <StudentsList />
    </QueryClientProvider>
  );
}

const meta = { title: 'Students/Collection' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  render: () => <StudentsListWithCachedQueries />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('columnheader', { name: /Student/ })).toBeVisible();
    await expect(canvas.getAllByText('B1 English').at(-1)).toBeVisible();
    await expect(canvas.getAllByText('Individual').at(-1)).toBeVisible();
    await expect(canvas.getAllByText('Not configured').at(-1)).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Anna Shevchenko' })).toHaveAttribute(
      'href',
      '/app/students/d6bf671d-7a0f-4cf3-8a67-c7a46a2bf4e9',
    );
    const menus = canvas.getAllByRole('button', { name: /Open menu/ });
    await userEvent.click(menus.at(-1)!);
    const menu = within(document.body);
    const restore = (await menu.findAllByRole('menuitem', { name: 'Restore', hidden: true })).find(
      (item) => item.checkVisibility(),
    );
    await expect(restore).toBeDefined();
    const edits = menu.queryAllByRole('menuitem', { name: 'Edit', hidden: true });
    await expect(edits.every((item) => !item.checkVisibility())).toBe(true);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(menu.queryByRole('menu')).not.toBeInTheDocument());
  },
};

export const MetricLoading: Story = {
  render: () => (
    <StudentMetricCard label="Total students" query={{ isPending: true, isError: false }} />
  ),
};

export const PartialMetricError: Story = {
  render: () => <StudentMetricCard label="Archived" query={{ isPending: false, isError: true }} />,
};

export const InitialLoading: Story = {
  render: () => <StudentsListSkeleton caption="Students" loadingLabel="Loading…" />,
};

export const FilteredEmpty: Story = {
  render: () => (
    <StudentsEmptyState filtered onClearFilters={() => undefined} onCreate={() => undefined} />
  ),
};

export const QueryError: Story = {
  render: () => (
    <QueryErrorAlert
      error={new Error('Unavailable')}
      title="Could not load students"
      onRetry={() => undefined}
    />
  ),
};

export const NarrowMobile: Story = {
  render: () => (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <StudentCard student={items[1]} />
    </QueryClientProvider>
  ),
  globals: { locale: 'uk' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const LongUkrainianName: Story = {
  render: () => (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <StudentCard
        student={{
          ...items[0],
          fullName: 'Катерина Олександрівна Шевченко-Бондаренко-Довгополова',
          activeEnrollmentCount: 0,
        }}
      />
    </QueryClientProvider>
  ),
  globals: { locale: 'uk', theme: 'dark' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
