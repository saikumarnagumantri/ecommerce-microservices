import { apiClient } from './client';
import { BulkCreateProductsResult, Category, Paged, ProductDetail, ProductFeature, ProductMedia, ProductSummary } from './types';

export interface ProductQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: number;
}

export const getProducts = (query: ProductQuery = {}): Promise<Paged<ProductSummary>> =>
  apiClient.get('/admin/products', { params: query }).then((r) => r.data);

export const getProduct = (id: number): Promise<ProductDetail> =>
  apiClient.get(`/admin/products/${id}`).then((r) => r.data);

export const getCategories = (): Promise<Category[]> => apiClient.get('/categories').then((r) => r.data);

export interface ProductInput {
  name: string;
  description: string;
  categoryId: number;
  brand: string;
  originalPrice: number;
  discountPrice: number;
  initialStock?: number;
}

export const createProduct = (input: ProductInput): Promise<ProductDetail> =>
  apiClient.post('/admin/products', input).then((r) => r.data);

export const createProductsBulk = (products: ProductInput[]): Promise<BulkCreateProductsResult> =>
  apiClient.post('/admin/products/bulk', { products }).then((r) => r.data);

export const updateProduct = (
  id: number,
  input: Partial<ProductInput> & { isActive?: boolean; forceOutOfStock?: boolean },
): Promise<ProductDetail> => apiClient.patch(`/admin/products/${id}`, input).then((r) => r.data);

export const deleteProduct = (id: number): Promise<void> =>
  apiClient.delete(`/admin/products/${id}`).then(() => undefined);

export const replaceFeatures = (id: number, features: Array<Pick<ProductFeature, 'label' | 'value'>>): Promise<ProductDetail> =>
  apiClient.put(`/admin/products/${id}/features`, { features }).then((r) => r.data);

export const addMedia = (
  id: number,
  input: { type: 'IMAGE' | 'VIDEO'; url: string; isPrimary?: boolean },
): Promise<ProductMedia> => apiClient.post(`/admin/products/${id}/media`, input).then((r) => r.data);

export const updateMedia = (
  productId: number,
  mediaId: number,
  input: { sortOrder?: number; isPrimary?: boolean },
): Promise<ProductMedia> => apiClient.patch(`/admin/products/${productId}/media/${mediaId}`, input).then((r) => r.data);

export const removeMedia = (productId: number, mediaId: number): Promise<void> =>
  apiClient.delete(`/admin/products/${productId}/media/${mediaId}`).then(() => undefined);
