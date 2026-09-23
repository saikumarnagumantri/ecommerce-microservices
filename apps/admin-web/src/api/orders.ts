import { apiClient } from './client';
import { BulkConfirmResult, CancelReason, OrderDetail, OrderStatus, OrderSummary, Paged, PartialDispatchReason } from './types';

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

export const dispatchOrder = (
  id: number,
  carrier: string,
  trackingNumber: string,
  dispatchedProductIds: number[],
  reason?: PartialDispatchReason,
  comment?: string,
): Promise<OrderDetail> =>
  apiClient.post(`/admin/orders/${id}/dispatch`, { carrier, trackingNumber, dispatchedProductIds, reason, comment }).then((r) => r.data);

export const deliverOrder = (id: number): Promise<OrderDetail> =>
  apiClient.patch(`/admin/orders/${id}/deliver`).then((r) => r.data);

export const cancelOrder = (id: number, reason: CancelReason, comment: string): Promise<OrderDetail> =>
  apiClient.post(`/admin/orders/${id}/cancel`, { reason, comment }).then((r) => r.data);
