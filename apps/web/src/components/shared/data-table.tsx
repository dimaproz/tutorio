'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table';
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from 'lucide-react';
import type { ListSort } from '@/components/shared/list-controls';
import { LoadingRegion } from '@/components/shared/loading';
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
  /**
   * `rows` lays each row out as a card-like grid instead of table cells. The
   * table semantics are unchanged: it is still a table with column headers,
   * so sorting and screen-reader navigation keep working.
   */
  variant?: 'default' | 'rows';
  /** `grid-template-columns` for the `rows` variant. */
  layout?: string;
  /** Marks the row that is currently highlighted, e.g. the next lesson's student. */
  isRowHighlighted?: (row: TData) => boolean;
  /** Quiets a row that is no longer operational, e.g. an archived record. */
  isRowDimmed?: (row: TData) => boolean;
  /**
   * `fixed` rows are 76px; `auto` rows grow with cells that wrap, such as a
   * group's weekday pills, keeping 76px as the minimum.
   */
  rowHeight?: 'fixed' | 'auto';
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
  variant = 'default',
  layout,
  isRowHighlighted,
  isRowDimmed,
  rowHeight = 'fixed',
}: DataTableProps<TData>) {
  const rows = variant === 'rows';
  const gridStyle = rows && layout ? { gridTemplateColumns: layout } : undefined;
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
    <LoadingRegion
      loading={loading}
      size="lg"
      className={cn(rows ? 'rounded-card' : 'overflow-x-auto rounded-lg')}
    >
      <Table className={cn(rows && 'w-full')}>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              style={gridStyle}
              className={cn(
                rows && 'grid items-center gap-4 border-0 px-4 pt-3 pb-2 hover:bg-transparent',
              )}
            >
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
                    className={cn(
                      rows &&
                        'h-auto min-w-0 p-0 text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase',
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => sort?.onSort(sortField as string)}
                        // A sortable column reads exactly like a static one.
                        // The indicator is the affordance: it appears on hover
                        // and focus, and stays once the column is sorted.
                        // The UA stylesheet resets text-transform on buttons,
                        // so it has to be inherited back from the header cell.
                        className="group/sort inline-flex items-center gap-1.5 rounded-sm text-inherit [text-transform:inherit] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
        {/* The header keeps its rule, so the first row steps off it: a hovered
            row's outline would otherwise sit flush against the line. */}
        <TableBody className={cn(rows && '[&>tr:first-child]:mt-2')}>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              style={gridStyle}
              data-highlighted={isRowHighlighted?.(row.original) || undefined}
              data-dimmed={isRowDimmed?.(row.original) || undefined}
              className={cn(
                rows &&
                  // `relative` makes the row the containing block for a cell's
                  // stretched link. Without it the link resolves against the
                  // nearest positioned ancestor and covers the whole table.
                  'relative grid items-center gap-4 rounded-row border-0 px-4 transition-[background-color,box-shadow] duration-150 hover:bg-surface-hover hover:shadow-[inset_0_0_0_1px_var(--border)] data-[dimmed]:text-muted-foreground data-[dimmed]:[&_img]:grayscale data-[highlighted]:bg-surface-hover',
                rows && (rowHeight === 'auto' ? 'min-h-19 py-3' : 'h-19'),
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className={cn(rows && 'min-w-0 p-0')}>
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
  const reveal =
    'size-3.5 shrink-0 opacity-0 transition-opacity group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100';

  if (!active) {
    return <ChevronsUpDownIcon className={reveal} aria-hidden="true" />;
  }
  return order === 'asc' ? (
    <ArrowUpIcon className="size-3.5 shrink-0" aria-hidden="true" />
  ) : (
    <ArrowDownIcon className="size-3.5 shrink-0" aria-hidden="true" />
  );
}
