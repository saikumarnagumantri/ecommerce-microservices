import axios from 'axios';

const PRODUCTS_URL = 'http://localhost:3002/products';

export const getProductsByIds = async (ids: number[]) => {
  const res = await axios.get(`${PRODUCTS_URL}?ids=${ids.join(',')}`);
  return res.data;
};
