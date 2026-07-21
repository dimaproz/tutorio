// Serializes list filters into a gateway query string. Empty and default
// values are omitted so query keys and URLs stay stable and comparable.

export type FilterValue = string | number | undefined | null;

export function buildQueryString(params: Record<string, FilterValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}

/** Reads a positive integer page from URL search params, defaulting to 1. */
export function parsePageParam(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** Record state is owner-only for anything other than `active`. */
export function parseStateParam(
  value: string | null,
  isOwner: boolean,
): 'active' | 'deleted' | 'all' {
  if (!isOwner) {
    return 'active';
  }
  return value === 'deleted' || value === 'all' ? value : 'active';
}
