import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InventoryService } from './inventory.service';
import { Inventory } from '../entities/inventory.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';

type MockRepo = Partial<Record<keyof Repository<Inventory>, jest.Mock>>;

/** Fakes DataSource.transaction against an in-memory inventory + movement log via a manager stub. */
function fakeDataSource(invRows: Inventory[], movements: InventoryMovement[] = []) {
  const fakeManager = {
    createQueryBuilder: () => ({
      setLock: () => ({
        where: () => ({ getMany: async () => invRows.map((r) => ({ ...r })) }),
      }),
    }),
    findOneBy: async (entity: unknown, where: { productId: number }) => {
      if (entity === Inventory) {
        return invRows.find((r) => r.productId === where.productId) ?? null;
      }
      return null;
    },
    save: jest.fn(async (arg1: unknown, arg2?: unknown) => {
      if (typeof arg1 === 'function') {
        // manager.save(EntityClass, data) — used for movement rows
        if (arg1 === InventoryMovement) {
          const m = { id: movements.length + 1, ...(arg2 as object) } as InventoryMovement;
          movements.push(m);
          return m;
        }
        return arg2;
      }
      const arr = Array.isArray(arg1) ? arg1 : [arg1];
      for (const s of arr as Inventory[]) {
        const row = invRows.find((r) => r.productId === s.productId);
        if (row) Object.assign(row, s);
        else invRows.push(s);
      }
      return arg1;
    }),
  };
  return {
    transaction: jest.fn((cb: (m: typeof fakeManager) => Promise<unknown>) => cb(fakeManager)),
  } as unknown as DataSource;
}

async function buildService(repo: MockRepo, invRows: Inventory[], movements: InventoryMovement[] = []) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      InventoryService,
      { provide: getRepositoryToken(Inventory), useValue: repo },
      { provide: getRepositoryToken(InventoryMovement), useValue: {} },
      { provide: DataSource, useValue: fakeDataSource(invRows, movements) },
    ],
  }).compile();
  return module.get<InventoryService>(InventoryService);
}

describe('InventoryService', () => {
  let service: InventoryService;
  let repo: MockRepo;

  beforeEach(async () => {
    repo = { find: jest.fn(), findOneBy: jest.fn(), findBy: jest.fn(), save: jest.fn() };
    service = await buildService(repo, []);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getInventoryByProductId throws NotFoundException when missing', async () => {
    repo.findOneBy!.mockResolvedValue(null);
    await expect(service.getInventoryByProductId(999)).rejects.toThrow(NotFoundException);
  });

  it('getInventoryByProductId maps stock > 0 to isAvailable true', async () => {
    repo.findOneBy!.mockResolvedValue({ productId: 101, stock: 5, isAvailable: true });
    await expect(service.getInventoryByProductId(101)).resolves.toEqual({
      productId: 101,
      stock: 5,
      isAvailable: true,
    });
  });

  it('getLowStock passes the threshold through and reports availability', async () => {
    repo.find!.mockResolvedValue([{ productId: 202, stock: 2, isAvailable: true }]);
    const result = await service.getLowStock(5);
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ order: { stock: 'ASC' } }),
    );
    expect(result).toEqual([{ productId: 202, stock: 2, isAvailable: true }]);
  });

  describe('updateInventoryStockByOrder', () => {
    it('applies every line when all have sufficient stock, and logs an ORDER movement per line', async () => {
      const rows: Inventory[] = [
        { productId: 101, stock: 20, isAvailable: true },
        { productId: 202, stock: 30, isAvailable: true },
      ];
      const movements: InventoryMovement[] = [];
      const svc = await buildService(repo, rows, movements);

      await expect(
        svc.updateInventoryStockByOrder({
          items: { 101: { quantity: 5 }, 202: { quantity: 3 } },
          refId: 'order-1',
        }),
      ).resolves.toBe(true);

      expect(rows.find((r) => r.productId === 101)!.stock).toBe(15);
      expect(rows.find((r) => r.productId === 202)!.stock).toBe(27);
      expect(movements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ productId: 101, delta: -5, reason: 'ORDER', refId: 'order-1' }),
          expect.objectContaining({ productId: 202, delta: -3, reason: 'ORDER', refId: 'order-1' }),
        ]),
      );
    });

    it('rejects a non-positive quantity without touching any row', async () => {
      const rows: Inventory[] = [{ productId: 101, stock: 20, isAvailable: true }];
      const svc = await buildService(repo, rows);

      await expect(
        svc.updateInventoryStockByOrder({ items: { 101: { quantity: 0 } } }),
      ).rejects.toThrow(BadRequestException);
      expect(rows[0].stock).toBe(20);
    });

    it('leaves every row (and the movement log) untouched when any single line has insufficient stock', async () => {
      const rows: Inventory[] = [
        { productId: 101, stock: 20, isAvailable: true },
        { productId: 202, stock: 30, isAvailable: true },
      ];
      const movements: InventoryMovement[] = [];
      const svc = await buildService(repo, rows, movements);

      await expect(
        svc.updateInventoryStockByOrder({ items: { 101: { quantity: 5 }, 202: { quantity: 9999 } } }),
      ).rejects.toThrow(BadRequestException);

      expect(rows.find((r) => r.productId === 101)!.stock).toBe(20);
      expect(rows.find((r) => r.productId === 202)!.stock).toBe(30);
      expect(movements).toHaveLength(0);
    });
  });

  describe('restock', () => {
    it('adds to stock and logs a RESTOCK movement', async () => {
      const rows: Inventory[] = [{ productId: 101, stock: 10, isAvailable: true }];
      const movements: InventoryMovement[] = [];
      const svc = await buildService(repo, rows, movements);

      const result = await svc.restock(101, { quantity: 15 });

      expect(result.stock).toBe(25);
      expect(movements).toEqual([
        expect.objectContaining({ productId: 101, delta: 15, reason: 'RESTOCK' }),
      ]);
    });

    it('throws NotFoundException for an unknown product', async () => {
      const svc = await buildService(repo, []);
      await expect(svc.restock(999, { quantity: 5 })).rejects.toThrow(NotFoundException);
    });
  });

  describe('adjustStock', () => {
    it('rejects an adjustment that would take stock below zero', async () => {
      const rows: Inventory[] = [{ productId: 101, stock: 5, isAvailable: true }];
      const svc = await buildService(repo, rows);
      await expect(svc.adjustStock(101, { delta: -10 })).rejects.toThrow(BadRequestException);
      expect(rows[0].stock).toBe(5);
    });

    it('applies a valid negative adjustment and logs it', async () => {
      const rows: Inventory[] = [{ productId: 101, stock: 10, isAvailable: true }];
      const movements: InventoryMovement[] = [];
      const svc = await buildService(repo, rows, movements);

      const result = await svc.adjustStock(101, { delta: -3 });

      expect(result.stock).toBe(7);
      expect(movements).toEqual([
        expect.objectContaining({ productId: 101, delta: -3, reason: 'ADJUST' }),
      ]);
    });
  });
});
