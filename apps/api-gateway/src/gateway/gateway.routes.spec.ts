import { matchRoute } from './gateway.routes';

describe('matchRoute', () => {
  it('matches an admin-prefixed path before any ambiguity with its non-admin sibling', () => {
    expect(matchRoute('/admin/orders/5/dispatch')?.auth).toBe('admin');
    expect(matchRoute('/orders/5')?.auth).toBe('authenticated');
    expect(matchRoute('/admin/products')?.auth).toBe('admin');
    expect(matchRoute('/products/101')?.auth).toBe('public');
  });

  it('does not match a path that only shares a prefix substring', () => {
    // "/orderstuff" must not match the "/orders" rule.
    expect(matchRoute('/orderstuff')).toBeUndefined();
  });

  it('returns undefined for an unconfigured path', () => {
    expect(matchRoute('/nonexistent')).toBeUndefined();
  });

  it('classifies every documented route group correctly', () => {
    expect(matchRoute('/auth/login')?.auth).toBe('public');
    expect(matchRoute('/me')?.auth).toBe('authenticated');
    expect(matchRoute('/cart')?.auth).toBe('authenticated');
    expect(matchRoute('/categories')?.auth).toBe('public');
    expect(matchRoute('/media/x.jpg')?.auth).toBe('public');
    expect(matchRoute('/upload')?.auth).toBe('admin');
  });
});
