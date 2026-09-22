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

export interface Address {
  id: number;
  userId: number;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface Category {
  id: number;
  name: string;
  parentId: number | null;
}

export interface ProductSummary {
  id: number;
  name: string;
  brand: string;
  categoryId: number;
  originalPrice: number;
  discountPrice: number;
  isActive: boolean;
  primaryImageUrl: string | null;
  isAvailable: boolean;
  createdAt: string;
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

export interface CartItem {
  productId: number;
  quantity: number;
  name: string;
  price: number;
  subtotal: number;
  isAvailable: boolean;
  wasCapped: boolean;
}

export interface Cart {
  userId: number;
  items: CartItem[];
  total: number;
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

export interface OrderDetail extends OrderSummary {
  items: OrderItem[];
  shippingAddress: Pick<Address, 'line1' | 'line2' | 'city' | 'state' | 'postalCode' | 'country'>;
  events: OrderEvent[];
  shipment: Shipment | null;
}
