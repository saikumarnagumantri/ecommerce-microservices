import { apiClient } from './client';
import { InventoryRow } from './types';

export const getInventory = (): Promise<InventoryRow[]> => apiClient.get('/admin/inventory').then((r) => r.data);

export const getLowStock = (threshold = 5): Promise<InventoryRow[]> =>
  apiClient.get('/admin/inventory/low-stock', { params: { threshold } }).then((r) => r.data);

export const restock = (productId: number, quantity: number): Promise<InventoryRow> =>
  apiClient.post(`/admin/inventory/${productId}/restock`, { quantity }).then((r) => r.data);

export const adjustStock = (productId: number, delta: number): Promise<InventoryRow> =>
  apiClient.patch(`/admin/inventory/${productId}/adjust`, { delta }).then((r) => r.data);

export const setStock = (productId: number, stock: number): Promise<string> =>
  apiClient.patch(`/admin/inventory/${productId}`, { stock }).then((r) => r.data);
