import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import axios from 'axios';
import { randomBytes, randomUUID } from 'crypto';
import { PaginationQueryDto } from '@salescart/common';
import { Order, OrderStatus, PaymentMethod } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderEvent } from './entities/order-event.entity';
import { Shipment } from './entities/shipment.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { DispatchOrderDto } from './dto/dispatch.dto';
import { AdminOrderQueryDto } from './dto/order-query.dto';
import { BulkConfirmResultDto, OrderDetailDto, PagedOrdersDto } from './dto/order-response.dto';

function generateOrderCode(): string {
  return `SC-${randomBytes(4).toString('hex').toUpperCase()}`;
}
import { clearCart, getCart } from './external/cart.client';
import { getAddress } from './external/users.client';
import { releaseStock, reserveStock } from './external/inventory.client';
import { ALLOWED_TRANSITIONS, CANNOT_CANCEL, CART_EMPTY, ORDER_NOT_FOUND } from './constants/orders.constants';

function externalErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as { message?: unknown } | undefined;
    if (typeof body?.message === 'string') return body.message;
    if (Array.isArray(body?.message)) return body.message.join(', ');
  }
  return fallback;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly itemRepo: Repository<OrderItem>,
    @InjectRepository(OrderEvent) private readonly eventRepo: Repository<OrderEvent>,
    @InjectRepository(Shipment) private readonly shipmentRepo: Repository<Shipment>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Places an order from the calling user's cart. There is no
   * distributed transaction across cart/inventory/orders, so this is a
   * saga with an explicit compensation: the order is created locally
   * first, stock is reserved second, and if that reservation fails the
   * just-created order is deleted so nothing is left half-placed.
   * Failing to clear the cart afterwards does not undo an otherwise
   * successful order — that's a lesser, recoverable problem.
   */
  async placeOrder(userId: number, dto: CreateOrderDto, authHeader: string): Promise<OrderDetailDto> {
    const cart = await getCart(authHeader);
    if (cart.items.length === 0) {
      throw new BadRequestException(CART_EMPTY);
    }

    const address = await getAddress(dto.addressId, authHeader);
    const totalAmount = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const order = await this.dataSource.transaction(async (manager) => {
      const savedOrder = await manager.save(Order, {
        publicId: randomUUID(),
        orderCode: generateOrderCode(),
        userId,
        status: OrderStatus.PLACED,
        totalAmount,
        shippingAddress: {
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
        },
        paymentMethod: PaymentMethod.COD,
      });
      await manager.save(
        OrderItem,
        cart.items.map((i) => ({
          orderId: savedOrder.id,
          productId: i.productId,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
        })),
      );
      await manager.save(OrderEvent, {
        orderId: savedOrder.id,
        status: OrderStatus.PLACED,
        note: 'Order placed',
        actorId: userId,
      });
      return savedOrder;
    });

    try {
      await reserveStock({
        items: Object.fromEntries(cart.items.map((i) => [i.productId, { quantity: i.quantity }])),
        refId: String(order.id),
      });
    } catch (err) {
      await this.orderRepo.delete(order.id); // cascades to items/events
      throw new BadRequestException(externalErrorMessage(err, 'Could not reserve stock for this order'));
    }

    try {
      await clearCart(authHeader);
    } catch (err) {
      this.logger.error(`Order ${order.id} placed, but failed to clear the cart: ${err instanceof Error ? err.message : err}`);
    }

    return this.toDetail(order);
  }

  async getOrdersForUser(userId: number, query: PaginationQueryDto): Promise<PagedOrdersDto> {
    return this.pagedList((qb) => qb.andWhere('o.userId = :userId', { userId }), query);
  }

  async getOrderDetailForUser(userId: number, orderId: number): Promise<OrderDetailDto> {
    const order = await this.orderRepo.findOneBy({ id: orderId, userId });
    if (!order) throw new NotFoundException(ORDER_NOT_FOUND);
    return this.toDetail(order);
  }

  async cancelForUser(userId: number, orderId: number): Promise<OrderDetailDto> {
    const order = await this.orderRepo.findOneBy({ id: orderId, userId });
    if (!order) throw new NotFoundException(ORDER_NOT_FOUND);

    if (!['PLACED', 'CONFIRMED'].includes(order.status)) {
      throw new ConflictException(CANNOT_CANCEL);
    }

    return this.transition(order, OrderStatus.CANCELLED, userId, 'Cancelled by customer', async () => {
      const items = await this.itemRepo.findBy({ orderId: order.id });
      await releaseStock({
        items: Object.fromEntries(items.map((i) => [i.productId, { quantity: i.quantity }])),
        refId: String(order.id),
      });
    });
  }

  // ---------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------

  async adminList(query: AdminOrderQueryDto): Promise<PagedOrdersDto> {
    return this.pagedList((qb) => {
      if (query.status) qb.andWhere('o.status = :status', { status: query.status });
      if (query.dateFrom) qb.andWhere('o.createdAt >= :dateFrom', { dateFrom: query.dateFrom });
      if (query.dateTo) qb.andWhere('o.createdAt <= :dateTo', { dateTo: query.dateTo });
    }, query);
  }

  async adminGetDetail(orderId: number): Promise<OrderDetailDto> {
    const order = await this.orderRepo.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException(ORDER_NOT_FOUND);
    return this.toDetail(order);
  }

  async confirm(orderId: number, adminId: number): Promise<OrderDetailDto> {
    const order = await this.findOrThrow(orderId);
    return this.transition(order, OrderStatus.CONFIRMED, adminId, 'Confirmed by admin');
  }

  /**
   * Confirms many orders in one call — same "each row succeeds or fails
   * independently" shape as bulk product creation, since a batch of 20
   * orders shouldn't all fail because one was already cancelled.
   */
  async confirmBulk(orderIds: number[], adminId: number): Promise<BulkConfirmResultDto> {
    const confirmed: number[] = [];
    const failed: { orderId: number; error: string }[] = [];

    for (const orderId of orderIds) {
      try {
        await this.confirm(orderId, adminId);
        confirmed.push(orderId);
      } catch (err) {
        failed.push({ orderId, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return { confirmed, failed };
  }

  async deliver(orderId: number, adminId: number): Promise<OrderDetailDto> {
    const order = await this.findOrThrow(orderId);
    return this.transition(order, OrderStatus.DELIVERED, adminId, 'Marked delivered by admin', async () => {
      await this.shipmentRepo.update({ orderId: order.id }, { deliveredAt: new Date() });
    });
  }

  async adminCancel(orderId: number, adminId: number): Promise<OrderDetailDto> {
    const order = await this.findOrThrow(orderId);
    if (!['PLACED', 'CONFIRMED'].includes(order.status)) {
      throw new ConflictException(CANNOT_CANCEL);
    }
    return this.transition(order, OrderStatus.CANCELLED, adminId, 'Cancelled by admin', async () => {
      const items = await this.itemRepo.findBy({ orderId: order.id });
      await releaseStock({
        items: Object.fromEntries(items.map((i) => [i.productId, { quantity: i.quantity }])),
        refId: String(order.id),
      });
    });
  }

  async dispatch(orderId: number, dto: DispatchOrderDto, adminId: number): Promise<OrderDetailDto> {
    const order = await this.findOrThrow(orderId);
    return this.transition(order, OrderStatus.DISPATCHED, adminId, `Dispatched via ${dto.carrier} (${dto.trackingNumber})`, async () => {
      await this.shipmentRepo.save({
        orderId: order.id,
        carrier: dto.carrier,
        trackingNumber: dto.trackingNumber,
        dispatchedAt: new Date(),
        deliveredAt: null,
      });
    });
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  private async findOrThrow(orderId: number): Promise<Order> {
    const order = await this.orderRepo.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException(ORDER_NOT_FOUND);
    return order;
  }

  /**
   * Enforces the state machine, applies the status change, records the
   * event, and runs any side effect (stock release, shipment row) — all
   * only after the transition itself is confirmed legal.
   */
  private async transition(
    order: Order,
    target: OrderStatus,
    actorId: number,
    note: string,
    sideEffect?: () => Promise<void>,
  ): Promise<OrderDetailDto> {
    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(target)) {
      throw new ConflictException(`Cannot move an order from ${order.status} to ${target}`);
    }

    if (sideEffect) await sideEffect();

    order.status = target;
    await this.orderRepo.save(order);
    await this.eventRepo.save({ orderId: order.id, status: target, note, actorId });

    return this.toDetail(order);
  }

  private async pagedList(
    applyFilters: (qb: ReturnType<Repository<Order>['createQueryBuilder']>) => void,
    query: PaginationQueryDto,
  ): Promise<PagedOrdersDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.orderRepo.createQueryBuilder('o');
    applyFilters(qb);
    qb.orderBy('o.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [rows, total] = await qb.getManyAndCount();
    return {
      data: rows.map((o) => ({
        id: o.id,
        publicId: o.publicId,
        orderCode: o.orderCode,
        userId: o.userId,
        status: o.status,
        totalAmount: o.totalAmount,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private async toDetail(order: Order): Promise<OrderDetailDto> {
    const [items, events, shipment] = await Promise.all([
      this.itemRepo.findBy({ orderId: order.id }),
      this.eventRepo.find({ where: { orderId: order.id }, order: { createdAt: 'ASC' } }),
      this.shipmentRepo.findOneBy({ orderId: order.id }),
    ]);

    return {
      id: order.id,
      publicId: order.publicId,
      orderCode: order.orderCode,
      userId: order.userId,
      status: order.status,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
      shippingAddress: order.shippingAddress,
      items: items.map((i) => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity })),
      events: events.map((e) => ({ status: e.status, note: e.note, createdAt: e.createdAt })),
      shipment: shipment
        ? {
            carrier: shipment.carrier,
            trackingNumber: shipment.trackingNumber,
            dispatchedAt: shipment.dispatchedAt,
            deliveredAt: shipment.deliveredAt,
          }
        : null,
    };
  }
}
