import type {
  PaginatedResponse,
  PaginationQueryDto,
  RecordStateDto,
} from '@tutorio/validation';

// Offset pagination shared by every Stage 2 list endpoint.

export function toSkipTake(query: PaginationQueryDto): {
  skip: number;
  take: number;
} {
  return {
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  };
}

export function buildPaginatedResponse<TItem>(
  items: TItem[],
  total: number,
  query: PaginationQueryDto,
): PaginatedResponse<TItem> {
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

// Prisma `deletedAt` filter for the shared active/deleted/all state filter.
// Callers enforce that non-`active` states are OWNER-only.
export function deletedAtFilter(
  state: RecordStateDto,
): { deletedAt: null } | { deletedAt: { not: null } } | Record<string, never> {
  switch (state) {
    case 'active':
      return { deletedAt: null };
    case 'deleted':
      return { deletedAt: { not: null } };
    case 'all':
      return {};
  }
}
