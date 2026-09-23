import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentMethod } from '../entities/order.entity';
import type { ShippingAddressSnapshot } from '../entities/order.entity';
import { OrderItemDispatchStatus } from '../entities/order-item.entity';

export class OrderItemResponseDto {
  @ApiProperty({ example: 101 })
  productId!: number;

  @ApiProperty({ example: 'UltraBook Pro 15' })
  name!: string;

  @ApiProperty({ example: 1350 })
  price!: number;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ enum: OrderItemDispatchStatus })
  dispatchStatus!: OrderItemDispatchStatus;
}

export class OrderEventResponseDto {
  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class ShipmentResponseDto {
  @ApiProperty({ example: 'BlueDart' })
  carrier!: string;

  @ApiProperty({ example: 'BD48217730IN' })
  trackingNumber!: string;

  @ApiProperty()
  dispatchedAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  deliveredAt!: Date | null;

  @ApiProperty({ example: false })
  isPartial!: boolean;

  @ApiPropertyOptional({ nullable: true, example: 'OUT_OF_STOCK' })
  reason!: string | null;

  @ApiPropertyOptional({ nullable: true })
  comment!: string | null;
}

export class OrderSummaryDto {
  @ApiProperty({ example: 1042 })
  id!: number;

  @ApiProperty({ example: 'b3f1c2a4-9d3e-4f1a-8b2c-1234567890ab', description: 'Stable public identifier for this order.' })
  publicId!: string;

  @ApiProperty({ example: 'SC-4F2A9E11', description: 'Short human-readable order code, shown to the customer.' })
  orderCode!: string;

  @ApiProperty({ example: 2 })
  userId!: number;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiProperty({ example: 1749 })
  totalAmount!: number;

  @ApiProperty({ enum: PaymentMethod })
  paymentMethod!: PaymentMethod;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ example: false, description: "True when this order has an admin-triggered update the customer hasn't seen yet." })
  hasUnseenUpdate!: boolean;
}

export class OrderDetailDto extends OrderSummaryDto {
  @ApiProperty({ type: [OrderItemResponseDto] })
  items!: OrderItemResponseDto[];

  @ApiProperty()
  shippingAddress!: ShippingAddressSnapshot;

  @ApiProperty({ type: [OrderEventResponseDto] })
  events!: OrderEventResponseDto[];

  @ApiPropertyOptional({ type: ShipmentResponseDto, nullable: true })
  shipment!: ShipmentResponseDto | null;
}

export class BulkConfirmFailureDto {
  @ApiProperty({ example: 1042 })
  orderId!: number;

  @ApiProperty({ example: 'Cannot move an order from CANCELLED to CONFIRMED' })
  error!: string;
}

export class BulkConfirmResultDto {
  @ApiProperty({ type: [Number], example: [1042, 1043] })
  confirmed!: number[];

  @ApiProperty({ type: [BulkConfirmFailureDto] })
  failed!: BulkConfirmFailureDto[];
}

export class PagedOrdersDto {
  @ApiProperty({ type: [OrderSummaryDto] })
  data!: OrderSummaryDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}
