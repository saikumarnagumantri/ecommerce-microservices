import { apiClient } from './client';
import { Category, Paged, ProductDetail, ProductSummary } from './types';

export interface ProductQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: number;
}

export const getProducts = (query: ProductQuery = {}): Promise<Paged<ProductSummary>> =>
  apiClient.get('/products', { params: query }).then((r) => r.data);

export const getProduct = (id: number): Promise<ProductDetail> =>
  apiClient.get(`/products/${id}`).then((r) => r.data);

export const getCategories = (): Promise<Category[]> => apiClient.get('/categories').then((r) => r.data);
