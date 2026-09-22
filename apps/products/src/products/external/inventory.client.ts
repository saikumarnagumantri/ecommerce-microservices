import axios from 'axios';
import { INTERNAL_KEY_HEADER } from '@salescart/common';

const INVENTORY_URL = process.env.INVENTORY_URL ?? 'http://localhost:3003/inventory';

const client = axios.create({
  headers: { [INTERNAL_KEY_HEADER]: process.env.INTERNAL_API_KEY ?? '' },
});

export interface InventorySnapshot {
  productId: number;
  stock: number;
  isAvailable: boolean;
}

export const createInventoryRow = async (productId: number, stock: number): Promise<void> => {
  await client.post(`${INVENTORY_URL}/new-product-inventory`, { productId, stock });
};

export const getInventoryByProductId = async (productId: number): Promise<InventorySnapshot | null> => {
  try {
    const res = await client.get(`${INVENTORY_URL}/${productId}`);
    return res.data;
  } catch {
    return null;
  }
};

export const getInventoryByIds = async (ids: number[]): Promise<InventorySnapshot[]> => {
  if (ids.length === 0) return [];
  try {
    const res = await client.get(`${INVENTORY_URL}/bulk-by-product`, {
      params: { productIds: ids.join(',') },
    });
    return res.data;
  } catch {
    return [];
  }
};
