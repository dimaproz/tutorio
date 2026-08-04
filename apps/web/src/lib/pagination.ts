export const PAGE_ELLIPSIS = 'ellipsis';

export type PageSlot = number | typeof PAGE_ELLIPSIS;

/**
 * Seven slots at most: either every page, or three pages at each end, or the
 * current page with one neighbour on each side. The pager's width never jumps
 * as the user moves through the pages, which a growing window would do.
 */
export function buildPageSlots(page: number, totalPages: number): PageSlot[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (page <= 3 || page >= totalPages - 2) {
    return [1, 2, 3, PAGE_ELLIPSIS, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, PAGE_ELLIPSIS, page - 1, page, page + 1, PAGE_ELLIPSIS, totalPages];
}
