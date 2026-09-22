import { apiClient } from './client';
import { BulkConfirmResult, OrderDetail, OrderStatus, OrderSummary, Paged } from './types';

export interface OrderQuery {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  dateFrom?: string;
  dateTo?: string;
}

export const getOrders = (query: OrderQuery = {}): Promise<Paged<OrderSummary>> =>
  apiClient.get('/admin/orders', { params: query }).then((r) => r.data);

export const getOrder = (id: number): Promise<OrderDetail> => apiClient.get(`/admin/orders/${id}`).then((r) => r.data);

export const confirmOrder = (id: number): Promise<OrderDetail> =>
  apiClient.patch(`/admin/orders/${id}/confirm`).then((r) => r.data);

export const confirmOrdersBulk = (orderIds: number[]): Promise<BulkConfirmResult> =>
  apiClient.patch('/admin/orders/confirm-bulk', { orderIds }).then((r) => r.data);

export const dispatchOrder = (id: number, carrier: string, trackingNumber: string): Promise<OrderDetail> =>
  apiClient.post(`/admin/orders/${id}/dispatch`, { carrier, trackingNumber }).then((r) => r.data);

export const deliverOrder = (id: number): Promise<OrderDetail> =>
  apiClient.patch(`/admin/orders/${id}/deliver`).then((r) => r.data);

export const cancelOrder = (id: number): Promise<OrderDetail> =>
  apiClient.post(`/admin/orders/${id}/cancel`).then((r) => r.data);
