import axios from 'axios';

const INVENTORY_URL = 'http://localhost:3003/inventory';

export const getInventoryByIds = async (ids: number[]) => {
  const res = await axios.get(`${INVENTORY_URL}?productIds=${ids.join(',')}`);
  return res.data;
};
