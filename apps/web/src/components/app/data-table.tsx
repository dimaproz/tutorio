'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table';
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from 'lucide-react';
import type { ListSort } from '@/components/app/list-controls';
import { LoadingRegion } from '@/components/shared';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

declare module '@tanstack/react-table' {
  // The generics are part of the library's interface signature and have to be
  // repeated verbatim for the augmentation to apply.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Query field this column sorts by. Omit to make the column static. */
    sortField?: string;
  }
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Screen-reader caption describing the table contents. */
  caption: string;
  /** Supply to activate sorting on columns that declare a `sortField`. */
  sort?: ListSort;
  /** Blurs the current rows under a spinner while the next page loads. */
  loading?: boolean;
}

/**
 * Thin rendering layer over TanStack Table. Pagination, sorting and filtering
 * are server-side and live in the URL, so every row model except the core one
 * stays disabled — otherwise the library would re-paginate an already
 * paginated page.
 */
export function DataTable<TData>({
  columns,
  data,
  caption,
  sort,
  loading = false,
}: DataTableProps<TData>) {
  // TanStack Table intentionally returns imperative table methods. React
  // Compiler safely skips this boundary; memoizing it would risk stale rows.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  return (
    <LoadingRegion loading={loading} size="lg" className="overflow-x-auto rounded-lg">
      <Table>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sortField = header.column.columnDef.meta?.sortField;
                const sortable = Boolean(sort && sortField);
                const active = sortable && sort?.field === sortField;
                const content = header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext());

                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      active ? (sort?.order === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => sort?.onSort(sortField as string)}
                        className={cn(
                          '-mx-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50',
                          active && 'text-primary',
                        )}
                      >
                        {content}
                        <SortIndicator active={active} order={sort?.order} />
                      </button>
                    ) : (
                      content
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </LoadingRegion>
  );
}

function SortIndicator({ active, order }: { active: boolean; order?: ListSort['order'] }) {
  if (!active) {
    return <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />;
  }
  return order === 'asc' ? (
    <ArrowUpIcon className="size-3.5" aria-hidden="true" />
  ) : (
    <ArrowDownIcon className="size-3.5" aria-hidden="true" />
  );
}
