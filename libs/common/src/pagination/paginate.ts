export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Pages an in-memory array. Services on a real database (post-E0-4) should
 * push `page`/`limit` into their query (LIMIT/OFFSET) instead of loading
 * everything and slicing here — this helper exists for the services still
 * on in-memory data today, and for combining results already fetched.
 */
export function paginate<T>(items: T[], page = 1, limit = 20): PaginatedResult<T> {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safeLimit = Math.max(1, Math.floor(limit) || 20);
  const total = items.length;
  const start = (safePage - 1) * safeLimit;

  return {
    data: items.slice(start, start + safeLimit),
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}
