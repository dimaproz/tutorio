import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AlertCircleIcon, CheckIcon, MailIcon, PlusIcon, UsersIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { BackButton } from '@/components/shared/back-button';
import { CollectionFrame } from '@/components/shared/collection-frame';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataTable } from '@/components/shared/data-table';
import { SectionTitle } from '@/components/shared/detail-view';
import { DetailFrame } from '@/components/shared/detail-frame';
import { EmptyState } from '@/components/shared/empty-state';
import { ListPagination, type ListSort } from '@/components/shared/list-controls';
import { LoadingPanel } from '@/components/shared/loading';
import { PageHeader } from '@/components/shared/page-shell';
import { PersonMiniCard } from '@/components/shared/person-mini-card';
import { RowActionsTrigger } from '@/components/shared/row-actions-trigger';
import { StatusBadge } from '@/components/shared/status-badges';

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
  state?: 'ready' | 'loading' | 'error' | 'empty';
}) {
  const [sortOrder, setSortOrder] = useState<ListSort['order']>('asc');
  const [page, setPage] = useState(1);
  const columns: ColumnDef<StudentReferenceRow, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Student',
      meta: { sortField: 'name' },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-muted-foreground">{row.original.email}</span>
        </div>
      ),
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
  const hasRows = state === 'ready';

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
          <EmptyState
            icon={<UsersIcon />}
            title="No students yet"
            text="Create a student to schedule their first lesson."
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
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Anna Shevchenko</h1>
            <StatusBadge label="Active" tone="success" icon={CheckIcon} />
          </div>
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
            <CardContent className="text-sm">anna@example.test</CardContent>
          </Card>
        ) : undefined
      }
      aside={
        state === 'ready' ? (
          <PersonMiniCard fullName="Olena Shevchenko" subtitle="Parent" />
        ) : undefined
      }
    />
  );
}

function StatusReference() {
  return (
    <div className="flex max-w-sm flex-wrap gap-2">
      <StatusBadge label="Active" tone="success" icon={CheckIcon} />
      <StatusBadge label="Awaiting a very long localized lifecycle decision" tone="warning" />
      <StatusBadge label="Archived" tone="secondary" />
      <StatusBadge label="Payment failed" tone="destructive" />
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
