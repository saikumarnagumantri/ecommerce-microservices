import axios from 'axios';
import { INTERNAL_KEY_HEADER } from '@salescart/common';

const INVENTORY_URL = process.env.INVENTORY_URL ?? 'http://localhost:3003/inventory';

export interface OrderLines {
  items: Record<number, { quantity: number }>;
  refId: string;
}

const headers = { [INTERNAL_KEY_HEADER]: process.env.INTERNAL_API_KEY ?? '' };

/** Throws (with the underlying 400 message) if any line has insufficient stock — the whole reservation is all-or-nothing. */
export const reserveStock = async (lines: OrderLines): Promise<void> => {
  await axios.patch(`${INVENTORY_URL}/update-stock-ordered`, lines, { headers });
};

export const releaseStock = async (lines: OrderLines): Promise<void> => {
  await axios.patch(`${INVENTORY_URL}/update-stock-cancelled`, lines, { headers });
};
