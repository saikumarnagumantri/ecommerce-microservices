import axios from 'axios';
import { INTERNAL_KEY_HEADER } from '@salescart/common';

const INVENTORY_URL = process.env.INVENTORY_URL ?? 'http://localhost:3003/inventory';

export const getInventoryByIds = async (ids: number[]) => {
  const res = await axios.get(`${INVENTORY_URL}/bulk-by-product`, {
    params: { productIds: ids.join(',') },
    headers: { [INTERNAL_KEY_HEADER]: process.env.INTERNAL_API_KEY ?? '' },
  });
  return res.data;
};
