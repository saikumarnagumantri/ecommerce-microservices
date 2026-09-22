import axios from 'axios';
import { INTERNAL_KEY_HEADER } from '@salescart/common';

const PRODUCTS_URL = process.env.PRODUCTS_URL ?? 'http://localhost:3002/products';

export const getProductsByIds = async (ids: number[]) => {
  const res = await axios.get(`${PRODUCTS_URL}/bulk-by-product`, {
    params: { productIds: ids.join(',') },
    headers: { [INTERNAL_KEY_HEADER]: process.env.INTERNAL_API_KEY ?? '' },
  });
  return res.data;
};
