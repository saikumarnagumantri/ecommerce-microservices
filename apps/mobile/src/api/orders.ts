import { apiClient } from './client';
import { OrderDetail, OrderSummary, Paged } from './types';

export const placeOrder = (addressId: number): Promise<OrderDetail> =>
  apiClient.post('/orders', { addressId }).then((r) => r.data);

export const getOrders = (page = 1, limit = 20): Promise<Paged<OrderSummary>> =>
  apiClient.get('/orders', { params: { page, limit } }).then((r) => r.data);

export const getOrder = (id: number): Promise<OrderDetail> => apiClient.get(`/orders/${id}`).then((r) => r.data);

export const cancelOrder = (id: number): Promise<OrderDetail> =>
  apiClient.post(`/orders/${id}/cancel`).then((r) => r.data);
