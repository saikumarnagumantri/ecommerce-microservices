export type Role = 'CUSTOMER' | 'ADMIN';

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: UserProfile;
}

export interface Category {
  id: number;
  name: string;
  parentId: number | null;
}

export interface ProductFeature {
  label: string;
  value: string;
  sortOrder: number;
}

export type MediaType = 'IMAGE' | 'VIDEO';

export interface ProductMedia {
  id: number;
  type: MediaType;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductSummary {
  id: number;
  name: string;
  brand: string;
  categoryId: number;
  originalPrice: number;
  discountPrice: number;
  isActive: boolean;
  forceOutOfStock: boolean;
  primaryImageUrl: string | null;
  isAvailable: boolean;
  createdAt: string;
}

export interface ProductDetail extends ProductSummary {
  description: string;
  features: ProductFeature[];
  media: ProductMedia[];
  stock: number;
}

export interface Paged<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InventoryRow {
  productId: number;
  stock: number;
  isAvailable: boolean;
}

export interface UploadResponse {
  url: string;
  type: MediaType;
  size: number;
  mimeType: string;
}

export type OrderStatus = 'PLACED' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';

export interface OrderItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
}

export interface OrderEvent {
  status: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface Shipment {
  carrier: string;
  trackingNumber: string;
  dispatchedAt: string;
  deliveredAt: string | null;
}

export interface OrderSummary {
  id: number;
  publicId: string;
  orderCode: string;
  userId: number;
  status: OrderStatus;
  totalAmount: number;
  paymentMethod: 'COD';
  createdAt: string;
}

export interface BulkConfirmResult {
  confirmed: number[];
  failed: Array<{ orderId: number; error: string }>;
}

export interface BulkCreateProductsResult {
  created: ProductDetail[];
  failed: Array<{ index: number; error: string }>;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItem[];
  shippingAddress: { line1: string; line2: string | null; city: string; state: string; postalCode: string; country: string };
  events: OrderEvent[];
  shipment: Shipment | null;
}
