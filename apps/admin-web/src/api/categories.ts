import { apiClient } from './client';
import { Category } from './types';

export const getCategories = (): Promise<Category[]> => apiClient.get('/categories').then((r) => r.data);

export const createCategory = (input: { name: string; parentId?: number | null }): Promise<Category> =>
  apiClient.post('/admin/categories', input).then((r) => r.data);

export const updateCategory = (id: number, input: { name?: string; parentId?: number | null }): Promise<Category> =>
  apiClient.patch(`/admin/categories/${id}`, input).then((r) => r.data);

export const deleteCategory = (id: number): Promise<void> =>
  apiClient.delete(`/admin/categories/${id}`).then(() => undefined);
