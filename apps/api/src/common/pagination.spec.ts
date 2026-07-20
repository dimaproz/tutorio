import {
  buildPaginatedResponse,
  deletedAtFilter,
  toSkipTake,
} from './pagination';

describe('toSkipTake', () => {
  it('converts page/pageSize to Prisma skip/take', () => {
    expect(toSkipTake({ page: 1, pageSize: 20 })).toEqual({
      skip: 0,
      take: 20,
    });
    expect(toSkipTake({ page: 4, pageSize: 25 })).toEqual({
      skip: 75,
      take: 25,
    });
  });
});

describe('buildPaginatedResponse', () => {
  it('computes totalPages by ceiling division', () => {
    expect(
      buildPaginatedResponse(['a'], 41, { page: 2, pageSize: 20 }),
    ).toEqual({
      items: ['a'],
      page: 2,
      pageSize: 20,
      total: 41,
      totalPages: 3,
    });
  });

  it('returns zero totalPages for an empty result set', () => {
    expect(
      buildPaginatedResponse([], 0, { page: 1, pageSize: 20 }).totalPages,
    ).toBe(0);
  });
});

describe('deletedAtFilter', () => {
  it('maps the shared record states to Prisma filters', () => {
    expect(deletedAtFilter('active')).toEqual({ deletedAt: null });
    expect(deletedAtFilter('deleted')).toEqual({ deletedAt: { not: null } });
    expect(deletedAtFilter('all')).toEqual({});
  });
});
