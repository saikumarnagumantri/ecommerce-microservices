export const CART_EMPTY = 'Cannot place an order from an empty cart';
export const ORDER_NOT_FOUND = 'Order not found';
export const CANNOT_CANCEL = 'Only a placed or confirmed order can be cancelled';
export const DISPATCH_REASON_REQUIRED = 'A reason and comment are required when holding back any item from dispatch';

/** The only transitions an admin (or the cancel flow) may make. Anything else is a 409. */
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['DISPATCHED', 'PARTIALLY_DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED'],
  PARTIALLY_DISPATCHED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

/** Why some items were held back from a dispatch. Validated with class-validator's @IsIn — see DispatchOrderDto. */
export const PARTIAL_DISPATCH_REASONS = ['OUT_OF_STOCK', 'ITEM_DAMAGED', 'ITEM_DISCONTINUED', 'COURIER_LIMIT', 'OTHER'] as const;
export type PartialDispatchReason = (typeof PARTIAL_DISPATCH_REASONS)[number];

/** Why an admin cancelled an order. Validated with class-validator's @IsIn — see CancelOrderDto. */
export const CANCEL_REASONS = ['CUSTOMER_REQUESTED', 'OUT_OF_STOCK', 'DUPLICATE_ORDER', 'SUSPECTED_FRAUD', 'UNDELIVERABLE_ADDRESS', 'OTHER'] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];
