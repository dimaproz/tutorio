import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
  AlertCircleIcon,
  CheckIcon,
  MailIcon,
  PlusIcon,
  UsersIcon,
  WalletIcon,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { BackButton } from '@/components/shared/back-button';
import { CollectionEmptyState } from '@/components/shared/collection-empty-state';
import { CollectionFrame } from '@/components/shared/collection-frame';
import { CollectionToolbar } from '@/components/shared/collection-toolbar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { InfoRow, ProfileHeader, ProfileTag, SectionTitle } from '@/components/shared/detail-view';
import { DetailFrame } from '@/components/shared/detail-frame';
import { ListPagination, ListSearchInput, type ListSort } from '@/components/shared/list-controls';
import { LoadingPanel } from '@/components/shared/loading';
import { MetricCard } from '@/components/shared/metric-card';
import { PageHeader, QueryRefreshIndicator } from '@/components/shared/page-shell';
import { PersonMiniCard } from '@/components/shared/person-mini-card';
import { RowActionsTrigger } from '@/components/shared/row-actions-trigger';
import { StatusBadge } from '@/components/shared/status-badges';
import { StatusSelect } from '@/components/shared/status-select';
import { PersonCell } from '@/components/shared/table-cells';

interface StudentReferenceRow {
  name: string;
  email: string;
  status: 'active' | 'paused';
}

const studentRows: StudentReferenceRow[] = [
  { name: 'Anna Shevchenko', email: 'anna@example.test', status: 'active' },
];

function CollectionReference({
  state = 'ready',
}: {
  state?: 'ready' | 'refreshing' | 'loading' | 'error' | 'empty';
}) {
  const [sortOrder, setSortOrder] = useState<ListSort['order']>('asc');
  const [page, setPage] = useState(1);
  const columns: ColumnDef<StudentReferenceRow, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Student',
      meta: { sortField: 'name' },
      cell: ({ row }) => <PersonCell fullName={row.original.name} subtitle={row.original.email} />,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge
          label={row.original.status === 'active' ? 'Active' : 'Paused'}
          tone={row.original.status === 'active' ? 'success' : 'warning'}
        />
      ),
    },
  ];
  const sort: ListSort = {
    field: 'name',
    order: sortOrder,
    onSort: () => setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc')),
  };
  const hasRows = state === 'ready' || state === 'refreshing';

  return (
    <CollectionFrame
      header={
        <PageHeader
          title="Students"
          description="Keep contacts, pricing, and active learning relationships together."
          action={
            <Button>
              <PlusIcon data-icon="inline-start" />
              Add student
            </Button>
          }
        />
      }
      toolbar={
        <CollectionToolbar>
          <ListSearchInput label="Search students" placeholder="Search by name, email, or phone" />
          <Button variant="outline">Active</Button>
        </CollectionToolbar>
      }
      refresh={<QueryRefreshIndicator isFetching={state === 'refreshing'} />}
      loading={state === 'loading' ? <LoadingPanel /> : undefined}
      error={
        state === 'error' ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Students could not be loaded</AlertTitle>
            <AlertDescription>Try again after checking your connection.</AlertDescription>
          </Alert>
        ) : undefined
      }
      empty={
        state === 'empty' ? (
          <CollectionEmptyState
            icon={UsersIcon}
            title="No students yet"
            description="Create a student to schedule their first lesson."
            action={<Button>Add student</Button>}
          />
        ) : undefined
      }
      desktop={
        hasRows ? (
          <DataTable columns={columns} data={studentRows} caption="Students" sort={sort} />
        ) : undefined
      }
      mobile={
        hasRows ? (
          <Card>
            <CardContent className="pt-6">Anna Shevchenko · Active</CardContent>
          </Card>
        ) : undefined
      }
      pagination={
        hasRows ? <ListPagination page={page} totalPages={3} onPageChange={setPage} /> : undefined
      }
    />
  );
}

function DetailReference({ state = 'ready' }: { state?: 'ready' | 'loading' | 'error' }) {
  return (
    <DetailFrame
      back={<BackButton href="/app/students" label="Back to students" />}
      identity={
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <ProfileHeader
            fullName="Anna Shevchenko"
            badge={<StatusBadge label="Active" tone="success" icon={CheckIcon} />}
            tags={<ProfileTag>English B2</ProfileTag>}
            subtitle="Added 10 September 2026"
          />
          <Button>Edit</Button>
        </div>
      }
      loading={state === 'loading' ? <LoadingPanel /> : undefined}
      error={
        state === 'error' ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Student could not be loaded</AlertTitle>
            <AlertDescription>Try again after checking your connection.</AlertDescription>
          </Alert>
        ) : undefined
      }
      main={
        state === 'ready' ? (
          <Card>
            <CardHeader>
              <SectionTitle icon={MailIcon}>Contact details</SectionTitle>
            </CardHeader>
            <CardContent>
              <InfoRow icon={MailIcon} label="Email" href="mailto:anna@example.test">
                anna@example.test
              </InfoRow>
            </CardContent>
          </Card>
        ) : undefined
      }
      aside={
        state === 'ready' ? (
          <div className="flex flex-col gap-4">
            <MetricCard
              icon={WalletIcon}
              label="Hourly rate"
              value="€30"
              description="Default individual lesson rate"
            />
            <PersonMiniCard fullName="Olena Shevchenko" subtitle="Parent" />
          </div>
        ) : undefined
      }
    />
  );
}

function StatusReference() {
  const [value, setValue] = useState('active');
  return (
    <div className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <StatusBadge label="Active" tone="success" icon={CheckIcon} />
        <StatusBadge label="Awaiting a very long localized lifecycle decision" tone="warning" />
        <StatusBadge label="Archived" tone="secondary" />
        <StatusBadge label="Payment failed" tone="destructive" />
      </div>
      <StatusSelect
        aria-label="Student lifecycle"
        value={value}
        onValueChange={setValue}
        options={[
          { value: 'active', label: 'Active', tone: 'success', icon: CheckIcon },
          {
            value: 'paused',
            label: 'Awaiting a very long localized lifecycle decision',
            tone: 'warning',
            icon: AlertCircleIcon,
          },
        ]}
      />
    </div>
  );
}

function ActionsReference() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <RowActionsTrigger label="Open student actions" />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setConfirmOpen(true)}>Archive student</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Archive student?"
        description="The student will move to archived records."
        confirmLabel="Archive"
        onConfirm={() => setConfirmOpen(false)}
      />
    </>
  );
}

const meta = { title: 'Shared/Reference compositions' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Collection: Story = {
  render: () => <CollectionReference />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Student/ }));
    await waitFor(() =>
      expect(canvas.getByRole('columnheader', { name: /Student/ })).toHaveAttribute(
        'aria-sort',
        'descending',
      ),
    );
  },
};
export const CollectionRefreshing: Story = {
  render: () => <CollectionReference state="refreshing" />,
};
export const CollectionLoading: Story = {
  render: () => <CollectionReference state="loading" />,
};
export const CollectionError: Story = {
  render: () => <CollectionReference state="error" />,
};
export const CollectionEmpty: Story = {
  render: () => <CollectionReference state="empty" />,
};
export const CollectionMobile: Story = {
  render: () => <CollectionReference />,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Detail: Story = { render: () => <DetailReference /> };
export const DetailLoading: Story = {
  render: () => <DetailReference state="loading" />,
};
export const DetailError: Story = {
  render: () => <DetailReference state="error" />,
};
export const DetailMobile: Story = {
  render: () => <DetailReference />,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const StatusPresentation: Story = { render: () => <StatusReference /> };
export const ActionsAndConfirmation: Story = {
  render: () => <ActionsReference />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open student actions' }));
    await userEvent.click(await within(document.body).findByText('Archive student'));
    await waitFor(() => expect(within(document.body).getByRole('alertdialog')).toBeVisible());
  },
};
