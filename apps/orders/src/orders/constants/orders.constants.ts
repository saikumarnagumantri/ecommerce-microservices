export const CART_EMPTY = 'Cannot place an order from an empty cart';
export const ORDER_NOT_FOUND = 'Order not found';
export const CANNOT_CANCEL = 'Only a placed or confirmed order can be cancelled';

/** The only transitions an admin (or the cancel flow) may make. Anything else is a 409. */
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};
