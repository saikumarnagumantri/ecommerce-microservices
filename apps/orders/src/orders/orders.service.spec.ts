import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OrdersService } from './orders.service';
import { Order, OrderStatus, PaymentMethod } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderEvent } from './entities/order-event.entity';
import { Shipment } from './entities/shipment.entity';
import { OrderItemDispatchStatus } from './entities/order-item.entity';
import * as cartClient from './external/cart.client';
import * as usersClient from './external/users.client';
import * as inventoryClient from './external/inventory.client';

jest.mock('./external/cart.client');
jest.mock('./external/users.client');
jest.mock('./external/inventory.client');

type MockRepo<T extends object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

function fakeDataSource(nextOrderId = 1) {
  const saved: { orders: Order[]; items: OrderItem[]; events: OrderEvent[] } = { orders: [], items: [], events: [] };
  const fakeManager = {
    save: jest.fn(async (entity: unknown, data?: unknown) => {
      if (entity === Order) {
        const order = { id: nextOrderId, ...(data as object) } as Order;
        saved.orders.push(order);
        return order;
      }
      if (entity === OrderItem) {
        const rows = (Array.isArray(data) ? data : [data]) as OrderItem[];
        saved.items.push(...rows);
        return rows;
      }
      if (entity === OrderEvent) {
        saved.events.push(data as OrderEvent);
        return data;
      }
      return data;
    }),
  };
  const dataSource = {
    transaction: jest.fn((cb: (m: typeof fakeManager) => Promise<unknown>) => cb(fakeManager)),
  } as unknown as DataSource;
  return { dataSource, saved };
}

describe('OrdersService', () => {
  let orderRepo: MockRepo<Order>;
  let itemRepo: MockRepo<OrderItem>;
  let eventRepo: MockRepo<OrderEvent>;
  let shipmentRepo: MockRepo<Shipment>;

  async function buildService(dataSource: DataSource) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(OrderItem), useValue: itemRepo },
        { provide: getRepositoryToken(OrderEvent), useValue: eventRepo },
        { provide: getRepositoryToken(Shipment), useValue: shipmentRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    return module.get<OrdersService>(OrdersService);
  }

  beforeEach(() => {
    orderRepo = { findOneBy: jest.fn(), save: jest.fn(), delete: jest.fn(), createQueryBuilder: jest.fn() };
    itemRepo = { findBy: jest.fn().mockResolvedValue([]), save: jest.fn() };
    eventRepo = { save: jest.fn(), find: jest.fn().mockResolvedValue([]) };
    shipmentRepo = { findOneBy: jest.fn().mockResolvedValue(null), save: jest.fn(), update: jest.fn() };
    jest.clearAllMocks();
    (itemRepo.findBy as jest.Mock).mockResolvedValue([]);
    (eventRepo.find as jest.Mock).mockResolvedValue([]);
    (shipmentRepo.findOneBy as jest.Mock).mockResolvedValue(null);
  });

  describe('placeOrder', () => {
    it('rejects an empty cart before touching anything else', async () => {
      (cartClient.getCart as jest.Mock).mockResolvedValue({ userId: 1, items: [], total: 0 });
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await expect(service.placeOrder(1, { addressId: 5 }, 'Bearer t')).rejects.toThrow(BadRequestException);
      expect(usersClient.getAddress).not.toHaveBeenCalled();
    });

    it('creates the order, reserves stock with the order id as refId, and clears the cart', async () => {
      (cartClient.getCart as jest.Mock).mockResolvedValue({
        userId: 1,
        items: [{ productId: 101, quantity: 2, name: 'Laptop', price: 1000, isAvailable: true }],
        total: 2000,
      });
      (usersClient.getAddress as jest.Mock).mockResolvedValue({
        id: 5, line1: 'L1', line2: null, city: 'C', state: 'S', postalCode: 'P', country: 'IN',
      });
      (inventoryClient.reserveStock as jest.Mock).mockResolvedValue(undefined);
      (cartClient.clearCart as jest.Mock).mockResolvedValue(undefined);

      const { dataSource, saved } = fakeDataSource(42);
      const service = await buildService(dataSource);

      const result = await service.placeOrder(1, { addressId: 5 }, 'Bearer t');

      expect(result.id).toBe(42);
      expect(result.totalAmount).toBe(2000);
      expect(result.paymentMethod).toBe(PaymentMethod.COD);
      expect(inventoryClient.reserveStock).toHaveBeenCalledWith({
        items: { 101: { quantity: 2 } },
        refId: '42',
      });
      expect(cartClient.clearCart).toHaveBeenCalled();
      expect(saved.orders).toHaveLength(1);
      expect(saved.items).toHaveLength(1);
    });

    it('deletes the just-created order when stock reservation fails (compensation)', async () => {
      (cartClient.getCart as jest.Mock).mockResolvedValue({
        userId: 1,
        items: [{ productId: 101, quantity: 99, name: 'Laptop', price: 1000, isAvailable: true }],
        total: 99000,
      });
      (usersClient.getAddress as jest.Mock).mockResolvedValue({
        id: 5, line1: 'L1', line2: null, city: 'C', state: 'S', postalCode: 'P', country: 'IN',
      });
      (inventoryClient.reserveStock as jest.Mock).mockRejectedValue(new Error('insufficient stock'));

      const { dataSource } = fakeDataSource(7);
      const service = await buildService(dataSource);

      await expect(service.placeOrder(1, { addressId: 5 }, 'Bearer t')).rejects.toThrow(BadRequestException);
      expect(orderRepo.delete).toHaveBeenCalledWith(7);
      expect(cartClient.clearCart).not.toHaveBeenCalled();
    });

    it('still returns the order even if clearing the cart afterwards fails', async () => {
      (cartClient.getCart as jest.Mock).mockResolvedValue({
        userId: 1,
        items: [{ productId: 101, quantity: 1, name: 'Laptop', price: 1000, isAvailable: true }],
        total: 1000,
      });
      (usersClient.getAddress as jest.Mock).mockResolvedValue({
        id: 5, line1: 'L1', line2: null, city: 'C', state: 'S', postalCode: 'P', country: 'IN',
      });
      (inventoryClient.reserveStock as jest.Mock).mockResolvedValue(undefined);
      (cartClient.clearCart as jest.Mock).mockRejectedValue(new Error('cart down'));

      const { dataSource } = fakeDataSource(8);
      const service = await buildService(dataSource);

      await expect(service.placeOrder(1, { addressId: 5 }, 'Bearer t')).resolves.toMatchObject({ id: 8 });
    });
  });

  describe('state machine', () => {
    it('rejects confirming an order that is not PLACED', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.DISPATCHED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await expect(service.confirm(1, 99)).rejects.toThrow(ConflictException);
    });

    it('allows PLACED -> CONFIRMED', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.PLACED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      const result = await service.confirm(1, 99);
      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 1, status: OrderStatus.CONFIRMED, actorId: 99 }),
      );
    });
  });

  describe('dispatch', () => {
    const twoPendingItems = [
      { id: 1, orderId: 1, productId: 101, name: 'Laptop', price: 1000, quantity: 1, dispatchStatus: OrderItemDispatchStatus.PENDING },
      { id: 2, orderId: 1, productId: 102, name: 'Mouse', price: 20, quantity: 2, dispatchStatus: OrderItemDispatchStatus.PENDING },
    ];

    beforeEach(() => {
      itemRepo.findBy!.mockResolvedValue(twoPendingItems);
    });

    it('rejects dispatch on a PLACED (not yet confirmed) order', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.PLACED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await expect(
        service.dispatch(1, { carrier: 'BlueDart', trackingNumber: 'ABC123', dispatchedProductIds: [101, 102] }, 99),
      ).rejects.toThrow(ConflictException);
    });

    it('dispatching every pending item creates a non-partial shipment and moves CONFIRMED -> DISPATCHED', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.CONFIRMED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      const result = await service.dispatch(1, { carrier: 'BlueDart', trackingNumber: 'ABC123', dispatchedProductIds: [101, 102] }, 99);

      expect(result.status).toBe(OrderStatus.DISPATCHED);
      expect(shipmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 1, carrier: 'BlueDart', trackingNumber: 'ABC123', isPartial: false, reason: null, comment: null }),
      );
      expect(itemRepo.save).toHaveBeenCalledWith([
        { ...twoPendingItems[0], dispatchStatus: OrderItemDispatchStatus.DISPATCHED },
        { ...twoPendingItems[1], dispatchStatus: OrderItemDispatchStatus.DISPATCHED },
      ]);
      expect(inventoryClient.releaseStock).not.toHaveBeenCalled();
    });

    it('rejects a partial selection with no reason or comment', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.CONFIRMED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await expect(
        service.dispatch(1, { carrier: 'BlueDart', trackingNumber: 'ABC123', dispatchedProductIds: [101] }, 99),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a partial selection with a whitespace-only comment', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.CONFIRMED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await expect(
        service.dispatch(1, { carrier: 'BlueDart', trackingNumber: 'ABC123', dispatchedProductIds: [101], reason: 'OUT_OF_STOCK', comment: '   ' }, 99),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not mark any item dispatched if creating the shipment fails, so a retry is still possible', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.CONFIRMED } as Order);
      shipmentRepo.save!.mockRejectedValue(new Error('db down'));
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await expect(
        service.dispatch(1, { carrier: 'BlueDart', trackingNumber: 'ABC123', dispatchedProductIds: [101, 102] }, 99),
      ).rejects.toThrow('db down');

      expect(itemRepo.save).not.toHaveBeenCalled();
    });

    it('accepts a partial dispatch with reason and comment, releases stock for held-back items, moves to PARTIALLY_DISPATCHED', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.CONFIRMED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      const result = await service.dispatch(
        1,
        { carrier: 'BlueDart', trackingNumber: 'ABC123', dispatchedProductIds: [101], reason: 'OUT_OF_STOCK', comment: 'Only 1 left' },
        99,
      );

      expect(result.status).toBe(OrderStatus.PARTIALLY_DISPATCHED);
      expect(shipmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isPartial: true, reason: 'OUT_OF_STOCK', comment: 'Only 1 left' }),
      );
      expect(itemRepo.save).toHaveBeenCalledWith([
        { ...twoPendingItems[0], dispatchStatus: OrderItemDispatchStatus.DISPATCHED },
        { ...twoPendingItems[1], dispatchStatus: OrderItemDispatchStatus.UNAVAILABLE },
      ]);
      expect(inventoryClient.releaseStock).toHaveBeenCalledWith({
        items: { 102: { quantity: 2 } },
        refId: '1',
      });
    });

    it('rejects dispatching a product id that is not part of the order', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.CONFIRMED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await expect(
        service.dispatch(1, { carrier: 'BlueDart', trackingNumber: 'ABC123', dispatchedProductIds: [999] }, 99),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('adminCancel', () => {
    it('requires a reason and comment, releases stock, and records them on the order', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.PLACED } as Order);
      itemRepo.findBy!.mockResolvedValue([{ productId: 101, quantity: 3 }]);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      const result = await service.adminCancel(1, 99, { reason: 'OUT_OF_STOCK', comment: 'No stock left' });

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(inventoryClient.releaseStock).toHaveBeenCalledWith({
        items: { 101: { quantity: 3 } },
        refId: '1',
      });
      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ cancelReason: 'OUT_OF_STOCK', cancelComment: 'No stock left' }),
      );
    });

    it('rejects cancelling a DISPATCHED order', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.DISPATCHED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await expect(
        service.adminCancel(1, 99, { reason: 'OUT_OF_STOCK', comment: 'No stock left' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('hasUnseenUpdate', () => {
    it('flags the order unseen when an admin cancels it', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, userId: 1, status: OrderStatus.PLACED } as Order);
      itemRepo.findBy!.mockResolvedValue([{ productId: 101, quantity: 3 }]);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await service.adminCancel(1, 99, { reason: 'OUT_OF_STOCK', comment: 'No stock left' });

      expect(orderRepo.save).toHaveBeenCalledWith(expect.objectContaining({ hasUnseenUpdate: true }));
    });

    it('does not flag the order when the customer cancels their own order', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, userId: 1, status: OrderStatus.PLACED } as Order);
      itemRepo.findBy!.mockResolvedValue([{ productId: 101, quantity: 3 }]);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await service.cancelForUser(1, 1);

      expect(orderRepo.save).toHaveBeenCalledWith(expect.not.objectContaining({ hasUnseenUpdate: true }));
    });

    it('flags the order unseen when an admin dispatches it', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.CONFIRMED } as Order);
      itemRepo.findBy!.mockResolvedValue([
        { id: 1, orderId: 1, productId: 101, name: 'Laptop', price: 1000, quantity: 1, dispatchStatus: OrderItemDispatchStatus.PENDING },
      ]);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await service.dispatch(1, { carrier: 'BlueDart', trackingNumber: 'ABC123', dispatchedProductIds: [101] }, 99);

      expect(orderRepo.save).toHaveBeenCalledWith(expect.objectContaining({ hasUnseenUpdate: true }));
    });

    it('does not flag the order when an admin merely confirms it', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, status: OrderStatus.PLACED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await service.confirm(1, 99);

      expect(orderRepo.save).toHaveBeenCalledWith(expect.not.objectContaining({ hasUnseenUpdate: true }));
    });

    it('clears the flag when the owning customer opens the order, but an admin viewing it leaves the flag alone', async () => {
      const order = { id: 1, userId: 1, status: OrderStatus.DISPATCHED, hasUnseenUpdate: true } as Order;
      orderRepo.findOneBy!.mockResolvedValue(order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await service.getOrderDetailForUser(1, 1);
      expect(orderRepo.save).toHaveBeenCalledWith(expect.objectContaining({ hasUnseenUpdate: false }));

      (orderRepo.save as jest.Mock).mockClear();
      await service.adminGetDetail(1);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('cancelForUser', () => {
    it('throws NotFoundException for another user\'s order', async () => {
      orderRepo.findOneBy!.mockResolvedValue(null);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await expect(service.cancelForUser(1, 999)).rejects.toThrow(NotFoundException);
    });

    it('rejects cancelling a DISPATCHED order', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, userId: 1, status: OrderStatus.DISPATCHED } as Order);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      await expect(service.cancelForUser(1, 1)).rejects.toThrow(ConflictException);
    });

    it('releases stock and transitions to CANCELLED for a PLACED order', async () => {
      orderRepo.findOneBy!.mockResolvedValue({ id: 1, userId: 1, status: OrderStatus.PLACED } as Order);
      itemRepo.findBy!.mockResolvedValue([{ productId: 101, quantity: 3 }]);
      const { dataSource } = fakeDataSource();
      const service = await buildService(dataSource);

      const result = await service.cancelForUser(1, 1);

      expect(inventoryClient.releaseStock).toHaveBeenCalledWith({
        items: { 101: { quantity: 3 } },
        refId: '1',
      });
      expect(result.status).toBe(OrderStatus.CANCELLED);
    });
  });
});
