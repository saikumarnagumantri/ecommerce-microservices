import { paginate } from './paginate';

describe('paginate', () => {
  const items = Array.from({ length: 45 }, (_, i) => i + 1);

  it('defaults to page 1, limit 20', () => {
    const result = paginate(items);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.data).toEqual(items.slice(0, 20));
    expect(result.total).toBe(45);
    expect(result.totalPages).toBe(3);
  });

  it('slices the requested page', () => {
    const result = paginate(items, 2, 20);
    expect(result.data).toEqual(items.slice(20, 40));
  });

  it('returns an empty page past the end without erroring', () => {
    const result = paginate(items, 10, 20);
    expect(result.data).toEqual([]);
    expect(result.total).toBe(45);
  });

  it('clamps a non-positive or non-numeric page/limit to a sane minimum', () => {
    const result = paginate(items, 0, -5);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(1);
  });

  it('always reports at least 1 total page, even for an empty list', () => {
    const result = paginate([], 1, 20);
    expect(result.totalPages).toBe(1);
    expect(result.data).toEqual([]);
  });
});
